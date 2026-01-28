import { MediaLiveClient, ListChannelsCommand, DescribeChannelCommand, DescribeThumbnailsCommand } from '@aws-sdk/client-medialive';
import { MediaPackageClient, ListOriginEndpointsCommand } from '@aws-sdk/client-mediapackage';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

const REGION = 'us-west-2';
const TABLE = 'highlight-clips';

const mediaLiveClient = new MediaLiveClient({ region: REGION });
const mediaPackageClient = new MediaPackageClient({ region: REGION });
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
        
        // MediaPackage HLS URL
        const mpDest = ch.Destinations?.find(d => d.MediaPackageSettings?.length > 0);
        if (mpDest?.MediaPackageSettings?.[0]?.ChannelId) {
          try {
            const { OriginEndpoints } = await mediaPackageClient.send(
              new ListOriginEndpointsCommand({ ChannelId: mpDest.MediaPackageSettings[0].ChannelId })
            );
            hlsUrl = OriginEndpoints?.find(e => e.HlsPackage)?.Url || null;
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
          IndexName: 'channelId-index',
          KeyConditionExpression: 'channelId = :cid',
          ExpressionAttributeValues: { ':cid': channelId },
          ScanIndexForward: false,
          Limit: 100
        }));
        
        return { statusCode: 200, headers, body: JSON.stringify(Items) };
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
          hlsUrl = OriginEndpoints?.find(e => e.HlsPackage)?.Url || null;
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
