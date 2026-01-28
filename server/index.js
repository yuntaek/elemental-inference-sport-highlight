import express from 'express';
import cors from 'cors';
import {
  MediaLiveClient,
  ListChannelsCommand,
  DescribeChannelCommand,
} from '@aws-sdk/client-medialive';
import {
  CloudWatchLogsClient,
  FilterLogEventsCommand,
} from '@aws-sdk/client-cloudwatch-logs';
import { fromIni } from '@aws-sdk/credential-providers';

const app = express();
app.use(cors());
app.use(express.json());

const REGION = 'us-west-2';
const PROFILE = '083304596944';

const credentials = fromIni({ profile: PROFILE });
const mediaLiveClient = new MediaLiveClient({ region: REGION, credentials });
const logsClient = new CloudWatchLogsClient({ region: REGION, credentials });

// MediaLive 채널 목록
app.get('/api/channels', async (req, res) => {
  try {
    const { Channels } = await mediaLiveClient.send(new ListChannelsCommand({}));
    const channels = (Channels || []).map((ch) => ({
      id: ch.Id,
      name: ch.Name,
      arn: ch.Arn,
      state: ch.State,
      feedArn: ch.InferenceSettings?.FeedArn,
      pipelinesRunning: ch.PipelinesRunningCount,
    }));
    res.json(channels);
  } catch (error) {
    console.error('Error listing channels:', error);
    res.status(500).json({ error: error.message });
  }
});

// 채널 상세 정보
app.get('/api/channels/:channelId', async (req, res) => {
  try {
    const channel = await mediaLiveClient.send(
      new DescribeChannelCommand({ ChannelId: req.params.channelId })
    );
    res.json({
      id: channel.Id,
      name: channel.Name,
      arn: channel.Arn,
      state: channel.State,
      feedArn: channel.InferenceSettings?.FeedArn,
      destinations: channel.Destinations,
      inputAttachments: channel.InputAttachments,
    });
  } catch (error) {
    console.error('Error describing channel:', error);
    res.status(500).json({ error: error.message });
  }
});

// CloudWatch 로그 조회 (하이라이트 이벤트)
app.get('/api/channels/:channelId/events', async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    const channelId = req.params.channelId;
    const logGroupName = `/aws/medialive/${channelId}`;
    const startTime = Date.now() - Number(hours) * 60 * 60 * 1000;

    const { events } = await logsClient.send(
      new FilterLogEventsCommand({
        logGroupName,
        startTime,
        limit: 100,
      })
    );

    const highlights = (events || []).map((e) => {
      const parsed = tryParseJson(e.message);
      return {
        id: e.eventId,
        timestamp: e.timestamp,
        message: e.message,
        type: detectEventType(e.message),
        ...parsed,
      };
    });
    res.json(highlights);
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      res.json([]);
    } else {
      console.error('Error fetching logs:', error);
      res.status(500).json({ error: error.message });
    }
  }
});

// Elemental Inference 이벤트 로그 조회
app.get('/api/inference/:feedId/events', async (req, res) => {
  try {
    const { hours = 24 } = req.query;
    const feedId = req.params.feedId;
    const logGroupName = `/aws/elemental-inference/${feedId}`;
    const startTime = Date.now() - Number(hours) * 60 * 60 * 1000;

    const { events } = await logsClient.send(
      new FilterLogEventsCommand({
        logGroupName,
        startTime,
        limit: 100,
      })
    );

    const highlights = (events || []).map((e) => {
      const parsed = tryParseJson(e.message);
      return {
        id: e.eventId,
        timestamp: e.timestamp,
        message: e.message,
        type: detectEventType(e.message),
        ...parsed,
      };
    });
    res.json(highlights);
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      res.json([]);
    } else {
      console.error('Error fetching inference logs:', error);
      res.status(500).json({ error: error.message });
    }
  }
});

function tryParseJson(str) {
  try { return JSON.parse(str); } catch { return {}; }
}

function detectEventType(message) {
  const lower = message.toLowerCase();
  if (lower.includes('three-pointer') || lower.includes('3-pointer')) return 'three-pointer';
  if (lower.includes('dunk')) return 'dunk';
  if (lower.includes('incident') || lower.includes('foul')) return 'incident';
  return 'default';
}

const PORT = 3001;
app.listen(PORT, () => console.log(`API server running on http://localhost:${PORT}`));
