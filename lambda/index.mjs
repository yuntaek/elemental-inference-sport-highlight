import { MediaLiveClient, ListChannelsCommand, DescribeChannelCommand, DescribeThumbnailsCommand } from '@aws-sdk/client-medialive';
import { MediaPackageClient, ListOriginEndpointsCommand } from '@aws-sdk/client-mediapackage';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, GetCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const REGION = 'us-west-2';
const TABLE = process.env.DYNAMODB_TABLE || 'highlight-clips';
const CLIP_GENERATOR_FUNCTION = process.env.CLIP_GENERATOR_FUNCTION || 'clip-generator';
const S3_BUCKET = process.env.S3_BUCKET || 'hackathon8-output-video';
const CLIP_CLOUDFRONT_DOMAIN = 'df1kr6icfg8e8.cloudfront.net'; // Clip Storage CloudFront
const HLS_CLOUDFRONT_DOMAIN = 'd2byorho3b7g5y.cloudfront.net'; // HLS Streaming CloudFront

const mediaLiveClient = new MediaLiveClient({ region: REGION });
const mediaPackageClient = new MediaPackageClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));
const lambdaClient = new LambdaClient({ region: REGION });
const s3Client = new S3Client({ region: REGION });

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const handler = async (event) => {
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
  const path = event.rawPath || event.path || '/';
  const query = event.queryStringParameters || {};

  console.log('Request:', method, path);

  if (method === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // GET /channels
    if (path === '/channels') {
      const { Channels } = await mediaLiveClient.send(new ListChannelsCommand({}));
      const channels = await Promise.all((Channels || []).map(async (ch) => {
        let hlsUrl = null;
        let thumbnailUrl = null;
        
        // MediaPackage HLS URL → CloudFront URL로 변환
        const mpDest = ch.Destinations?.find(d => d.MediaPackageSettings?.length > 0);
        if (mpDest?.MediaPackageSettings?.[0]?.ChannelId) {
          try {
            const { OriginEndpoints } = await mediaPackageClient.send(
              new ListOriginEndpointsCommand({ ChannelId: mpDest.MediaPackageSettings[0].ChannelId })
            );
            const mpUrl = OriginEndpoints?.find(e => e.HlsPackage)?.Url || null;
            hlsUrl = convertMediaPackageToCloudFront(mpUrl);
          } catch (e) { console.log('MediaPackage error:', e); }
        }

        // Thumbnail
        if (ch.State === 'RUNNING') {
          try {
            const { ThumbnailDetails } = await mediaLiveClient.send(
              new DescribeThumbnailsCommand({
                ChannelId: ch.Id,
                PipelineId: '0',
                ThumbnailType: 'CURRENT_ACTIVE'
              })
            );
            const thumb = ThumbnailDetails?.[0]?.Thumbnails?.[0];
            if (thumb?.Body) {
              thumbnailUrl = `data:${thumb.ContentType};base64,${thumb.Body}`;
            }
          } catch (e) { console.log('Thumbnail error:', e); }
        }

        return {
          id: ch.Id,
          name: ch.Name,
          arn: ch.Arn,
          state: ch.State,
          feedArn: ch.InferenceSettings?.FeedArn,
          pipelinesRunning: ch.PipelinesRunningCount,
          hlsUrl,
          thumbnailUrl,
        };
      }));
      return { statusCode: 200, headers, body: JSON.stringify(channels) };
    }

    // GET /channels/{channelId}/thumbnail
    const thumbMatch = path.match(/^\/channels\/([^/]+)\/thumbnail$/);
    if (thumbMatch) {
      const channelId = thumbMatch[1];
      try {
        const { ThumbnailDetails } = await mediaLiveClient.send(
          new DescribeThumbnailsCommand({
            ChannelId: channelId,
            PipelineId: '0',
            ThumbnailType: 'CURRENT_ACTIVE'
          })
        );
        const thumb = ThumbnailDetails?.[0]?.Thumbnails?.[0];
        if (thumb?.Body) {
          return {
            statusCode: 200,
            headers: { ...headers, 'Content-Type': thumb.ContentType },
            body: thumb.Body,
            isBase64Encoded: true
          };
        }
      } catch (e) { console.log('Thumbnail error:', e); }
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'No thumbnail' }) };
    }

    // GET /channels/{channelId}/events
    const eventsMatch = path.match(/^\/channels\/([^/]+)\/events$/);
    if (eventsMatch) {
      const channelId = eventsMatch[1];
      
      try {
        const { Items = [] } = await ddb.send(new QueryCommand({
          TableName: TABLE,
          IndexName: 'channelId-timestamp-index',
          KeyConditionExpression: 'channelId = :cid',
          ExpressionAttributeValues: { ':cid': channelId },
          ScanIndexForward: false,
          Limit: 100
        }));
        
        // S3 URL을 CloudFront URL로 변환
        const convertedItems = Items.map(convertClipUrls);
        
        return { statusCode: 200, headers, body: JSON.stringify(convertedItems) };
      } catch (err) {
        console.error('DynamoDB error:', err);
        return { statusCode: 200, headers, body: JSON.stringify([]) };
      }
    }

    // GET /channels/{channelId}
    const channelMatch = path.match(/^\/channels\/([^/]+)$/);
    if (channelMatch) {
      const channelId = channelMatch[1];
      const channel = await mediaLiveClient.send(new DescribeChannelCommand({ ChannelId: channelId }));
      
      let hlsUrl = null;
      const mpDest = channel.Destinations?.find(d => d.MediaPackageSettings?.length > 0);
      if (mpDest?.MediaPackageSettings?.[0]?.ChannelId) {
        try {
          const { OriginEndpoints } = await mediaPackageClient.send(
            new ListOriginEndpointsCommand({ ChannelId: mpDest.MediaPackageSettings[0].ChannelId })
          );
          const mpUrl = OriginEndpoints?.find(e => e.HlsPackage)?.Url || null;
          hlsUrl = convertMediaPackageToCloudFront(mpUrl);
        } catch (e) { console.log('MediaPackage error:', e); }
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          id: channel.Id,
          name: channel.Name,
          arn: channel.Arn,
          state: channel.State,
          feedArn: channel.InferenceSettings?.FeedArn,
          hlsUrl,
        }),
      };
    }

    // POST /clips - 클립 생성
    if (path === '/clips' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { channelId, startPts, endPts, duration, type, tags, timescale } = body;
      
      if (!channelId || !startPts || !endPts) {
        return { 
          statusCode: 400, 
          headers, 
          body: JSON.stringify({ error: 'Missing required fields: channelId, startPts, endPts' }) 
        };
      }
      
      const clipId = crypto.randomUUID();
      const timestamp = Date.now();
      
      // DynamoDB에 PENDING 상태로 저장
      const clipItem = {
        id: clipId,
        channelId,
        startPts,
        endPts,
        duration: duration || Math.round((endPts - startPts) / (timescale || 90000)),
        type: type || 'default',
        tags: tags || [],
        timescale: timescale || 90000,
        status: 'PENDING',
        timestamp,
        createdAt: new Date().toISOString(),
      };
      
      await ddb.send(new PutCommand({ TableName: TABLE, Item: clipItem }));
      
      // clip-generator Lambda 비동기 호출
      try {
        await lambdaClient.send(new InvokeCommand({
          FunctionName: CLIP_GENERATOR_FUNCTION,
          InvocationType: 'Event',
          Payload: JSON.stringify({ clipId, ...clipItem }),
        }));
      } catch (e) {
        console.error('Failed to invoke clip generator:', e);
      }
      
      return { statusCode: 201, headers, body: JSON.stringify(clipItem) };
    }

    // GET /clips - 전체 클립 목록
    if (path === '/clips' && method === 'GET') {
      const { Items = [] } = await ddb.send(new ScanCommand({
        TableName: TABLE,
        Limit: 100,
      }));
      
      // timestamp 기준 내림차순 정렬
      Items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      
      // S3 URL을 CloudFront URL로 변환
      const convertedItems = Items.map(convertClipUrls);
      
      return { statusCode: 200, headers, body: JSON.stringify(convertedItems) };
    }

    // GET /clips/{clipId} - 클립 상태 조회
    const clipMatch = path.match(/^\/clips\/([^/]+)$/);
    if (clipMatch && method === 'GET') {
      const clipId = clipMatch[1];
      const { Item } = await ddb.send(new GetCommand({ TableName: TABLE, Key: { id: clipId } }));
      
      if (!Item) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Clip not found' }) };
      }
      
      return { statusCode: 200, headers, body: JSON.stringify(convertClipUrls(Item)) };
    }

    // GET /clips/{clipId}/download - 다운로드 URL 생성
    const downloadMatch = path.match(/^\/clips\/([^/]+)\/download$/);
    if (downloadMatch && method === 'GET') {
      const clipId = downloadMatch[1];
      const { Item } = await ddb.send(new GetCommand({ TableName: TABLE, Key: { id: clipId } }));
      
      if (!Item) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Clip not found' }) };
      }
      
      if (Item.status !== 'COMPLETED' || !Item.clipUrl) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Clip not ready for download' }) };
      }
      
      // S3 presigned URL 생성
      const s3Key = `clips/${Item.channelId}/${clipId}.mp4`;
      const command = new GetObjectCommand({ Bucket: S3_BUCKET, Key: s3Key });
      const downloadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      
      return { statusCode: 200, headers, body: JSON.stringify({ downloadUrl }) };
    }

    // GET /channels/{channelId}/clips - 채널별 클립 목록
    const channelClipsMatch = path.match(/^\/channels\/([^/]+)\/clips$/);
    if (channelClipsMatch && method === 'GET') {
      const channelId = channelClipsMatch[1];
      
      const { Items = [] } = await ddb.send(new QueryCommand({
        TableName: TABLE,
        IndexName: 'channelId-timestamp-index',
        KeyConditionExpression: 'channelId = :cid',
        ExpressionAttributeValues: { ':cid': channelId },
        ScanIndexForward: false,
        Limit: 100
      }));
      
      // S3 URL을 CloudFront URL로 변환
      const convertedItems = Items.map(convertClipUrls);
      
      return { statusCode: 200, headers, body: JSON.stringify(convertedItems) };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not Found' }) };
  } catch (error) {
    console.error('Error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};

function mapTagToType(tag) {
  if (!tag) return 'default';
  const t = tag.toLowerCase();
  if (t === 'threepointer' || t === '3-pointer') return 'three-pointer';
  if (t === 'twopointer' || t === '2-pointer') return 'two-pointer';
  if (t === 'dunk') return 'dunk';
  return t;
}

// MediaPackage URL을 CloudFront URL로 변환
function convertMediaPackageToCloudFront(url) {
  if (!url) return url;
  
  // MediaPackage URL 패턴: https://xxx.mediapackage.region.amazonaws.com/out/v1/xxx/index.m3u8
  const mpPattern = /https?:\/\/[^.]+\.mediapackage\.[^/]+\.amazonaws\.com(\/out\/v1\/.+)/;
  const match = url.match(mpPattern);
  if (match) {
    const path = match[1];
    return `https://${HLS_CLOUDFRONT_DOMAIN}${path}`;
  }
  
  return url;
}

// S3 URL을 CloudFront URL로 변환
function convertToCloudFrontUrl(url) {
  if (!url) return url;
  
  // S3 URL 패턴들:
  // 1. https://bucket.s3.region.amazonaws.com/key
  // 2. https://bucket.s3-region.amazonaws.com/key  
  // 3. https://s3.region.amazonaws.com/bucket/key
  // 4. https://s3-region.amazonaws.com/bucket/key
  
  // 패턴 1 & 2: bucket.s3.region.amazonaws.com 또는 bucket.s3-region.amazonaws.com
  const pattern1 = /https?:\/\/([^.]+)\.s3[.-]([^.]+)\.amazonaws\.com\/(.+)/;
  let match = url.match(pattern1);
  if (match) {
    const key = match[3];
    return `https://${CLIP_CLOUDFRONT_DOMAIN}/${key}`;
  }
  
  // 패턴 3 & 4: s3.region.amazonaws.com/bucket 또는 s3-region.amazonaws.com/bucket
  const pattern2 = /https?:\/\/s3[.-]([^.]+)\.amazonaws\.com\/([^/]+)\/(.+)/;
  match = url.match(pattern2);
  if (match) {
    const key = match[3];
    return `https://${CLIP_CLOUDFRONT_DOMAIN}/${key}`;
  }
  
  return url;
}

// 클립 아이템의 URL들을 CloudFront URL로 변환
function convertClipUrls(item) {
  if (!item) return item;
  return {
    ...item,
    clipUrl: convertToCloudFrontUrl(item.clipUrl),
    thumbnailUrl: convertToCloudFrontUrl(item.thumbnailUrl),
  };
}
