import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { gunzipSync } from 'zlib';
import { execSync } from 'child_process';
import { readFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';

const REGION = 'us-west-2';
const BUCKET = 'hackathon8-output-video';
const TABLE = 'highlight-clips-stage';
const HLS_URL = 'https://d2byorho3b7g5y.cloudfront.net/out/v1/038b4469b5c541dc8816deef6ccd4aae/index.m3u8';
const DEFAULT_CHANNEL_ID = '6220813';
const TIME_SHIFT_WINDOW_HOURS = 24;
const EVENT_DELAY_MS = parseInt(process.env.EVENT_DELAY_MS || '60000', 10); // 기본 60초

// FFmpeg 경로 (Lambda Layer)
const FFMPEG_PATH = '/opt/bin/ffmpeg';
const TMP_DIR = '/tmp';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
const s3 = new S3Client({ region: REGION });

export const handler = async (event) => {
  console.log('Event:', JSON.stringify(event));
  
  // API Gateway 요청 처리
  if (event.httpMethod) {
    return handleApiRequest(event);
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
  const { timeShiftUrl } = generateTimeShiftUrl(timestamp, duration);
  const outputKey = `clips/${channelId}/${clipId}`;
  
  try {
    // FFmpeg로 클립 생성
    const outputPath = await createClipWithFFmpeg(timeShiftUrl, clipId, duration);
    
    // S3에 업로드
    const clipBuffer = readFileSync(outputPath);
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: `${outputKey}.mp4`,
      Body: clipBuffer,
      ContentType: 'video/mp4'
    }));
    
    // 임시 파일 삭제
    if (existsSync(outputPath)) unlinkSync(outputPath);
    
    // 썸네일 생성
    const thumbnailPath = await createThumbnailWithFFmpeg(timeShiftUrl, clipId);
    if (thumbnailPath && existsSync(thumbnailPath)) {
      const thumbBuffer = readFileSync(thumbnailPath);
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: `${outputKey}.jpg`,
        Body: thumbBuffer,
        ContentType: 'image/jpeg'
      }));
      unlinkSync(thumbnailPath);
    }
    
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
        thumbnailUrl: `https://${BUCKET}.s3.${REGION}.amazonaws.com/${outputKey}.jpg`,
        status: 'COMPLETED',
        createdAt: now,
        updatedAt: now
      }
    }));
    
    console.log('Clip created:', clipId);
    
    return response(201, {
      clipId,
      status: 'COMPLETED',
      message: 'Clip generation completed'
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

// FFmpeg로 HLS를 MP4 클립으로 변환 (재시도 로직 포함)
async function createClipWithFFmpeg(hlsUrl, clipId, duration, retryCount = 0) {
  const outputPath = `${TMP_DIR}/${clipId}.mp4`;
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 2000;
  
  // /tmp 디렉토리 확인
  if (!existsSync(TMP_DIR)) {
    mkdirSync(TMP_DIR, { recursive: true });
  }
  
  console.log(`Creating clip with FFmpeg (attempt ${retryCount + 1}):`, hlsUrl);
  
  // FFmpeg 명령어 실행 - URL을 single quote로 감싸서 특수문자 보호
  const cmd = `${FFMPEG_PATH} -i '${hlsUrl}' -t ${duration} -c copy -movflags +faststart -y "${outputPath}"`;
  
  try {
    execSync(cmd, { 
      timeout: 120000,
      stdio: 'pipe'
    });
    console.log('FFmpeg completed:', outputPath);
    return outputPath;
  } catch (err) {
    const errorMsg = err.stderr?.toString() || err.message;
    
    // 404 에러 감지 시 재시도
    if (errorMsg.includes('404') && retryCount < MAX_RETRIES) {
      console.log(`404 error, retrying in ${RETRY_DELAY_MS}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
      await sleep(RETRY_DELAY_MS);
      return createClipWithFFmpeg(hlsUrl, clipId, duration, retryCount + 1);
    }
    
    console.error('FFmpeg error:', errorMsg);
    // 재인코딩으로 재시도
    const fallbackCmd = `${FFMPEG_PATH} -i '${hlsUrl}' -t ${duration} -c:v libx264 -c:a aac -movflags +faststart -y "${outputPath}"`;
    try {
      execSync(fallbackCmd, { 
        timeout: 180000,
        stdio: 'pipe'
      });
      return outputPath;
    } catch (fallbackErr) {
      const fallbackErrorMsg = fallbackErr.stderr?.toString() || fallbackErr.message;
      
      // 재인코딩에서도 404 에러 시 재시도
      if (fallbackErrorMsg.includes('404') && retryCount < MAX_RETRIES) {
        console.log(`404 error on fallback, retrying in ${RETRY_DELAY_MS}ms...`);
        await sleep(RETRY_DELAY_MS);
        return createClipWithFFmpeg(hlsUrl, clipId, duration, retryCount + 1);
      }
      throw fallbackErr;
    }
  }
}

// sleep 헬퍼 함수
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// FFmpeg로 썸네일 생성
function createThumbnailWithFFmpeg(hlsUrl, clipId) {
  const outputPath = `${TMP_DIR}/${clipId}.jpg`;
  
  console.log('Creating thumbnail with FFmpeg');
  
  // 첫 프레임에서 썸네일 추출 - URL을 single quote로 감싸서 특수문자 보호
  const cmd = `${FFMPEG_PATH} -i '${hlsUrl}' -vframes 1 -q:v 2 -y "${outputPath}"`;
  
  try {
    execSync(cmd, { 
      timeout: 30000,
      stdio: 'pipe'
    });
    console.log('Thumbnail created:', outputPath);
    return outputPath;
  } catch (err) {
    console.error('Thumbnail error:', err.message);
    return null;
  }
}

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
    // EventBridge 이벤트는 딜레이 후 처리 (Time-shift 데이터 준비 대기)
    console.log(`EventBridge event detected, waiting ${EVENT_DELAY_MS}ms for Time-shift data...`);
    await sleep(EVENT_DELAY_MS);
  }

  for (const evt of events) {
    try {
      const detail = evt.detail || {};
      const { startPts, endPts, timescale = 90000, tags = [] } = detail;
      
      // startPts가 0일 수 있으므로 undefined/null 체크
      if (startPts === undefined || startPts === null || !endPts) {
        console.log('Missing startPts or endPts', { startPts, endPts });
        continue;
      }

      const duration = Math.ceil((endPts - startPts) / timescale);
      const clipId = randomUUID();
      const outputKey = `clips/${DEFAULT_CHANNEL_ID}/${clipId}`;

      const eventTime = new Date(evt.time || Date.now()).getTime();
      const now = Date.now();
      
      // Time-shift URL 생성
      const { timeShiftUrl } = generateTimeShiftUrl(eventTime, duration);

      try {
        // FFmpeg로 클립 생성 (재시도 로직 포함)
        const outputPath = await createClipWithFFmpeg(timeShiftUrl, clipId, duration);
        
        // S3에 업로드
        const clipBuffer = readFileSync(outputPath);
        await s3.send(new PutObjectCommand({
          Bucket: BUCKET,
          Key: `${outputKey}.mp4`,
          Body: clipBuffer,
          ContentType: 'video/mp4'
        }));
        if (existsSync(outputPath)) unlinkSync(outputPath);
        
        // 썸네일 생성
        const thumbnailPath = createThumbnailWithFFmpeg(timeShiftUrl, clipId);
        if (thumbnailPath && existsSync(thumbnailPath)) {
          const thumbBuffer = readFileSync(thumbnailPath);
          await s3.send(new PutObjectCommand({
            Bucket: BUCKET,
            Key: `${outputKey}.jpg`,
            Body: thumbBuffer,
            ContentType: 'image/jpeg'
          }));
          unlinkSync(thumbnailPath);
        }

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
            thumbnailUrl: `https://${BUCKET}.s3.${REGION}.amazonaws.com/${outputKey}.jpg`,
            timestamp: eventTime,
            status: 'COMPLETED',
            createdAt: now,
            updatedAt: now
          }
        }));

        console.log('Clip created:', clipId);
      } catch (err) {
        console.error('FFmpeg error:', err);
        
        // 실패 시 FAILED 상태로 저장
        await ddb.send(new PutCommand({
          TableName: TABLE,
          Item: {
            id: clipId,
            channelId: DEFAULT_CHANNEL_ID,
            type: tags[0] || 'default',
            tags,
            startPts, endPts, timescale,
            duration,
            timestamp: eventTime,
            status: 'FAILED',
            error: err.message,
            createdAt: now,
            updatedAt: now
          }
        }));
      }
    } catch (err) {
      console.error('Error:', err);
    }
  }

  return { statusCode: 200 };
}
