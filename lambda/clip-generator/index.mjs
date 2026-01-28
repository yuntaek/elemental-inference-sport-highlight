import { MediaConvertClient, CreateJobCommand } from '@aws-sdk/client-mediaconvert';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';
import { gunzipSync } from 'zlib';

const REGION = 'us-west-2';
const BUCKET = 'hackathon8-output-video';
const TABLE = 'highlight-clips';
const HLS_URL = 'https://c4af3793bf76b33c.mediapackage.us-west-2.amazonaws.com/out/v1/038b4469b5c541dc8816deef6ccd4aae/index.m3u8';
const CHANNEL_ID = '6220813';
const MEDIACONVERT_ROLE = 'arn:aws:iam::083304596944:role/MediaConvertRole';

const mc = new MediaConvertClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

export const handler = async (event) => {
  console.log('Event:', JSON.stringify(event));
  
  let events = [];
  
  // CloudWatch Logs Subscription 형식
  if (event.awslogs?.data) {
    const payload = Buffer.from(event.awslogs.data, 'base64');
    const parsed = JSON.parse(gunzipSync(payload).toString());
    events = parsed.logEvents.map(e => JSON.parse(e.message));
  } 
  // EventBridge 직접 형식
  else if (event.detail) {
    events = [event];
  }

  for (const evt of events) {
    try {
      const detail = evt.detail || {};
      const { startPts, endPts, timescale = 90000, tags = [] } = detail;
      
      if (!startPts || !endPts) {
        console.log('Missing startPts or endPts');
        continue;
      }

      const startSec = Math.floor(startPts / timescale);
      const duration = Math.ceil((endPts - startPts) / timescale);
      const clipId = randomUUID();
      const outputKey = `clips/${CHANNEL_ID}/${clipId}`;

      // 현재 시간 기준 상대 오프셋 계산 (라이브 스트림용)
      // 이벤트 발생 시점부터 현재까지의 시간차를 계산
      const eventTime = new Date(evt.time || Date.now()).getTime();
      const now = Date.now();
      const delayFromNow = Math.floor((now - eventTime) / 1000) + duration + 10; // 버퍼 추가
      
      // 라이브 스트림에서 상대 시간으로 클리핑 (00:00:00:00부터 시작)
      const clipStart = 0;
      const clipEnd = duration;

      // MediaConvert Job 생성
      await mc.send(new CreateJobCommand({
        Role: MEDIACONVERT_ROLE,
        Settings: {
          Inputs: [{
            FileInput: HLS_URL,
            InputClippings: [{
              StartTimecode: secsToTimecode(clipStart),
              EndTimecode: secsToTimecode(clipEnd)
            }]
          }],
          OutputGroups: [{
            Name: 'File Group',
            OutputGroupSettings: {
              Type: 'FILE_GROUP_SETTINGS',
              FileGroupSettings: { Destination: `s3://${BUCKET}/${outputKey}` }
            },
            Outputs: [{
              ContainerSettings: { Container: 'MP4' },
              VideoDescription: {
                CodecSettings: {
                  Codec: 'H_264',
                  H264Settings: { 
                    RateControlMode: 'QVBR', 
                    QvbrSettings: { QvbrQualityLevel: 7 },
                    MaxBitrate: 5000000
                  }
                }
              },
              AudioDescriptions: [{
                CodecSettings: { 
                  Codec: 'AAC', 
                  AacSettings: { 
                    Bitrate: 96000, 
                    SampleRate: 48000,
                    CodingMode: 'CODING_MODE_2_0'
                  } 
                }
              }]
            }]
          }]
        }
      }));

      // DynamoDB에 저장
      await ddb.send(new PutCommand({
        TableName: TABLE,
        Item: {
          id: clipId,
          channelId: CHANNEL_ID,
          type: tags[0] || 'default',
          tags,
          startPts, endPts, timescale,
          duration,
          clipUrl: `https://${BUCKET}.s3.${REGION}.amazonaws.com/${outputKey}.mp4`,
          thumbnailUrl: `https://${BUCKET}.s3.${REGION}.amazonaws.com/${outputKey}.0000000.jpg`,
          timestamp: Date.now(),
          status: 'PROCESSING'
        }
      }));

      console.log('Job created for clip:', clipId);
    } catch (err) {
      console.error('Error:', err);
    }
  }

  return { statusCode: 200 };
};

function secsToTimecode(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}:00`;
}

function pad(n) { return n.toString().padStart(2, '0'); }
