import { MediaConvertClient, CreateJobCommand, GetJobCommand } from '@aws-sdk/client-mediaconvert';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { gunzipSync } from 'zlib';

const REGION = 'us-west-2';
const BUCKET = 'hackathon8-output-video';
const TABLE = 'highlight-clips-stage';
const HLS_URL = 'https://c4af3793bf76b33c.mediapackage.us-west-2.amazonaws.com/out/v1/038b4469b5c541dc8816deef6ccd4aae/index.m3u8';
const DEFAULT_CHANNEL_ID = '6220813';
const MEDIACONVERT_ROLE = 'arn:aws:iam::083304596944:role/MediaConvertRole';
const TIME_SHIFT_WINDOW_HOURS = 24;

const mc = new MediaConvertClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
const s3 = new S3Client({ region: REGION });

export const handler = async (event) => {
  console.log('Event:', JSON.stringify(event));
  
  // API Gateway 요청 처리
  if (event.httpMethod) {
    return handleApiRequest(event);
  }
  
  // MediaConvert Job 상태 변경 이벤트 처리 (EventBridge)
  if (event.source === 'aws.mediaconvert' && event['detail-type'] === 'MediaConvert Job State Change') {
    return handleMediaConvertEvent(event);
  }
  
  // 기존 CloudWatch Logs / EventBridge 이벤트 처리
  return handleLegacyEvent(event);
};

// API Gateway 요청 핸들러
async function handleApiRequest(event) {
  const { httpMethod, path, pathParameters, body } = event;
  
  try {
    // POST /clips - 클립 생성
    if (httpMethod === 'POST' && path === '/clips') {
      return await createClip(JSON.parse(body || '{}'));
    }
    
    // GET /clips/:id - 클립 상태 조회
    if (httpMethod === 'GET' && pathParameters?.clipId) {
      return await getClipStatus(pathParameters.clipId);
    }
    
    // GET /channels/:channelId/clips - 채널별 클립 목록 조회
    if (httpMethod === 'GET' && pathParameters?.channelId && path.includes('/clips')) {
      return await getChannelClips(pathParameters.channelId);
    }
    
    // GET /clips/:id/download - 다운로드 URL 생성
    if (httpMethod === 'GET' && pathParameters?.clipId && path.includes('/download')) {
      return await getDownloadUrl(pathParameters.clipId);
    }
    
    return response(404, { error: 'Not found' });
  } catch (err) {
    console.error('API Error:', err);
    return response(500, { error: err.message });
  }
}

// POST /clips - 클립 생성
async function createClip(body) {
  const { channelId, eventId, startPts, endPts, timescale, timestamp, tags = [] } = body;
  
  // 필수 파라미터 검증 (Requirements 1.3)
  const missing = [];
  if (!startPts && startPts !== 0) missing.push('startPts');
  if (!endPts) missing.push('endPts');
  if (!channelId) missing.push('channelId');
  if (!timestamp) missing.push('timestamp');
  
  if (missing.length > 0) {
    return response(400, { 
      error: 'Missing required parameters', 
      missing 
    });
  }
  
  // Time-shift 윈도우 검증 (Requirements 2.3)
  const eventTime = new Date(timestamp).getTime();
  const now = Date.now();
  const hoursSinceEvent = (now - eventTime) / (1000 * 60 * 60);
  
  if (hoursSinceEvent > TIME_SHIFT_WINDOW_HOURS) {
    return response(400, { 
      error: 'Event outside time-shift window',
      message: `Event occurred ${hoursSinceEvent.toFixed(1)} hours ago. Maximum allowed is ${TIME_SHIFT_WINDOW_HOURS} hours.`
    });
  }
  
  // 클립 ID 생성 (Requirements 1.4)
  const clipId = randomUUID();
  const scale = timescale || 90000;
  
  // PTS를 초 단위로 변환
  const startSeconds = Math.floor(startPts / scale);
  const endSeconds = Math.ceil(endPts / scale);
  const duration = endSeconds - startSeconds;
  
  // Time-shift URL 생성 (Requirements 2.1, 2.2)
  const { startTime, endTime, timeShiftUrl } = generateTimeShiftUrl(timestamp, duration);
  
  const outputKey = `clips/${channelId}/${clipId}`;
  
  try {
    // MediaConvert Job 생성 (Requirements 3.1)
    const jobResult = await mc.send(new CreateJobCommand({
      Role: MEDIACONVERT_ROLE,
      Settings: {
        Inputs: [{
          FileInput: timeShiftUrl,
          InputClippings: [{
            StartTimecode: '00:00:00:00',
            EndTimecode: secsToTimecode(duration)
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
      },
      UserMetadata: {
        clipId: clipId
      }
    }));
    
    const jobId = jobResult.Job?.Id;
    
    // DynamoDB에 메타데이터 저장 (Requirements 3.2)
    await ddb.send(new PutCommand({
      TableName: TABLE,
      Item: {
        id: clipId,
        channelId,
        eventId: eventId || null,
        type: tags[0] || 'default',
        tags,
        startPts, 
        endPts, 
        timescale: scale,
        duration,
        timestamp: eventTime,
        clipUrl: `https://${BUCKET}.s3.${REGION}.amazonaws.com/${outputKey}.mp4`,
        thumbnailUrl: `https://${BUCKET}.s3.${REGION}.amazonaws.com/${outputKey}.0000000.jpg`,
        status: 'PROCESSING',
        jobId,
        createdAt: now,
        updatedAt: now
      }
    }));
    
    console.log('Clip created:', clipId, 'Job:', jobId);
    
    return response(201, {
      clipId,
      status: 'PROCESSING',
      message: 'Clip generation started'
    });
  } catch (err) {
    console.error('Failed to create clip:', err);
    
    // 실패 시 FAILED 상태로 저장
    await ddb.send(new PutCommand({
      TableName: TABLE,
      Item: {
        id: clipId,
        channelId,
        eventId: eventId || null,
        type: tags[0] || 'default',
        tags,
        startPts, 
        endPts, 
        timescale: scale,
        duration,
        timestamp: eventTime,
        status: 'FAILED',
        error: err.message,
        createdAt: now,
        updatedAt: now
      }
    }));
    
    return response(500, { 
      error: 'Failed to create MediaConvert job',
      clipId,
      status: 'FAILED'
    });
  }
}

// GET /clips/:id - 클립 상태 조회 (Requirements 4.1)
async function getClipStatus(clipId) {
  const result = await ddb.send(new GetCommand({
    TableName: TABLE,
    Key: { id: clipId }
  }));
  
  if (!result.Item) {
    return response(404, { error: 'Clip not found' });
  }
  
  return response(200, result.Item);
}

// GET /channels/:channelId/clips - 채널별 클립 목록 조회
async function getChannelClips(channelId) {
  const result = await ddb.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'channelId-timestamp-index',
    KeyConditionExpression: 'channelId = :channelId',
    ExpressionAttributeValues: {
      ':channelId': channelId
    },
    ScanIndexForward: false // 최신순 정렬
  }));
  
  return response(200, { clips: result.Items || [] });
}

// GET /clips/:id/download - 다운로드 URL 생성 (Requirements 5.1)
async function getDownloadUrl(clipId) {
  const clipResult = await ddb.send(new GetCommand({
    TableName: TABLE,
    Key: { id: clipId }
  }));
  
  if (!clipResult.Item) {
    return response(404, { error: 'Clip not found' });
  }
  
  const clip = clipResult.Item;
  
  if (clip.status !== 'COMPLETED') {
    return response(400, { error: 'Clip is not ready for download', status: clip.status });
  }
  
  // S3 presigned URL 생성
  const clipUrl = clip.clipUrl;
  const key = clipUrl.split('.amazonaws.com/')[1];
  
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: key
    });
    
    const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
    
    return response(200, { 
      downloadUrl: presignedUrl,
      filename: `clip-${clipId}.mp4`
    });
  } catch (err) {
    console.error('Failed to generate presigned URL:', err);
    
    // S3 파일이 없는 경우 상태 업데이트 (Requirements 5.3)
    await ddb.send(new UpdateCommand({
      TableName: TABLE,
      Key: { id: clipId },
      UpdateExpression: 'SET #status = :status, #error = :error, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#error': 'error'
      },
      ExpressionAttributeValues: {
        ':status': 'FAILED',
        ':error': 'Clip file not found in S3',
        ':updatedAt': Date.now()
      }
    }));
    
    return response(404, { error: 'Clip file not found in S3' });
  }
}

// Time-shift URL 생성 (Requirements 2.1, 2.2)
function generateTimeShiftUrl(timestamp, duration) {
  const eventDate = new Date(timestamp);
  
  // 이벤트 종료 시점 = timestamp
  // 이벤트 시작 시점 = timestamp - duration
  const endTime = eventDate;
  const startTime = new Date(eventDate.getTime() - (duration * 1000));
  
  // ISO 8601 형식으로 변환
  const startParam = startTime.toISOString();
  const endParam = endTime.toISOString();
  
  const timeShiftUrl = `${HLS_URL}?start=${startParam}&end=${endParam}`;
  
  return { startTime, endTime, timeShiftUrl };
}

// MediaConvert Job 상태 변경 이벤트 처리 (Requirements 3.3, 3.4)
async function handleMediaConvertEvent(event) {
  const { detail } = event;
  const jobId = detail.jobId;
  const status = detail.status;
  
  console.log('MediaConvert event:', jobId, status);
  
  // clipId를 UserMetadata에서 가져오거나 jobId로 조회
  const clipId = detail.userMetadata?.clipId;
  
  if (!clipId) {
    console.log('No clipId in metadata, skipping');
    return { statusCode: 200 };
  }
  
  const now = Date.now();
  
  if (status === 'COMPLETE') {
    // 성공: COMPLETED로 업데이트 (Requirements 3.3)
    await ddb.send(new UpdateCommand({
      TableName: TABLE,
      Key: { id: clipId },
      UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status'
      },
      ExpressionAttributeValues: {
        ':status': 'COMPLETED',
        ':updatedAt': now
      }
    }));
    console.log('Clip completed:', clipId);
  } else if (status === 'ERROR') {
    // 실패: FAILED로 업데이트 (Requirements 3.4)
    const errorMessage = detail.errorMessage || 'MediaConvert job failed';
    
    await ddb.send(new UpdateCommand({
      TableName: TABLE,
      Key: { id: clipId },
      UpdateExpression: 'SET #status = :status, #error = :error, updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#error': 'error'
      },
      ExpressionAttributeValues: {
        ':status': 'FAILED',
        ':error': errorMessage,
        ':updatedAt': now
      }
    }));
    console.log('Clip failed:', clipId, errorMessage);
  }
  
  return { statusCode: 200 };
}

// 기존 CloudWatch Logs / EventBridge 이벤트 처리 (레거시 지원)
async function handleLegacyEvent(event) {
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
      const outputKey = `clips/${DEFAULT_CHANNEL_ID}/${clipId}`;

      // 현재 시간 기준 상대 오프셋 계산 (라이브 스트림용)
      const eventTime = new Date(evt.time || Date.now()).getTime();
      const now = Date.now();
      
      // Time-shift URL 생성
      const { timeShiftUrl } = generateTimeShiftUrl(eventTime, duration);

      // MediaConvert Job 생성
      await mc.send(new CreateJobCommand({
        Role: MEDIACONVERT_ROLE,
        Settings: {
          Inputs: [{
            FileInput: timeShiftUrl,
            InputClippings: [{
              StartTimecode: '00:00:00:00',
              EndTimecode: secsToTimecode(duration)
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
        },
        UserMetadata: {
          clipId: clipId
        }
      }));

      // DynamoDB에 저장
      await ddb.send(new PutCommand({
        TableName: TABLE,
        Item: {
          id: clipId,
          channelId: DEFAULT_CHANNEL_ID,
          type: tags[0] || 'default',
          tags,
          startPts, endPts, timescale,
          duration,
          clipUrl: `https://${BUCKET}.s3.${REGION}.amazonaws.com/${outputKey}.mp4`,
          thumbnailUrl: `https://${BUCKET}.s3.${REGION}.amazonaws.com/${outputKey}.0000000.jpg`,
          timestamp: eventTime,
          status: 'PROCESSING',
          createdAt: now,
          updatedAt: now
        }
      }));

      console.log('Job created for clip:', clipId);
    } catch (err) {
      console.error('Error:', err);
    }
  }

  return { statusCode: 200 };
}

// 유틸리티 함수
function secsToTimecode(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}:00`;
}

function pad(n) { return n.toString().padStart(2, '0'); }

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    },
    body: JSON.stringify(body)
  };
}
