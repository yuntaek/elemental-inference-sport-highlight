// Mock AWS service for demonstration
// In production, replace with actual AWS SDK calls

import type { MediaLiveChannel, SportEvent, CloudWatchLog, EventType } from '@/app/types/events';

const EVENT_TYPES: EventType[] = ['three-pointer', 'dunk', 'incident', 'default'];

// Mock channels
const mockChannels: MediaLiveChannel[] = [
  {
    id: 'ch-001',
    name: 'Arena A - Court 1',
    arn: 'arn:aws:medialive:us-west-2:123456789:channel:ch-001',
    state: 'RUNNING',
    hlsUrl: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
    feedArn: 'arn:aws:elemental-inference:us-west-2:123456789:feed:feed-001'
  },
  {
    id: 'ch-002',
    name: 'Arena B - Court 2',
    arn: 'arn:aws:medialive:us-west-2:123456789:channel:ch-002',
    state: 'RUNNING',
    hlsUrl: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
    feedArn: 'arn:aws:elemental-inference:us-west-2:123456789:feed:feed-002'
  },
  {
    id: 'ch-003',
    name: 'Stadium C - Main Court',
    arn: 'arn:aws:medialive:us-west-2:123456789:channel:ch-003',
    state: 'RUNNING',
    hlsUrl: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
    feedArn: 'arn:aws:elemental-inference:us-west-2:123456789:feed:feed-003'
  }
];

// Generate mock events
function generateMockEvent(channelId: string, timestamp: number): SportEvent {
  const type = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
  const startPts = Math.floor(timestamp * 90000);
  const duration = Math.floor(Math.random() * 8) + 3; // 3-10 seconds
  const endPts = startPts + (duration * 90000);
  
  return {
    id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    channelId,
    type,
    timestamp,
    startPts,
    endPts,
    timescale: 90000,
    duration,
    qualityScore: Math.random() * 0.3 + 0.7,
    tags: [type]
  };
}

let eventCounter = 0;

export async function getRunningChannels(): Promise<MediaLiveChannel[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  return mockChannels;
}

export async function getChannelHlsUrl(channelId: string): Promise<string | null> {
  await new Promise(resolve => setTimeout(resolve, 300));
  const channel = mockChannels.find(ch => ch.id === channelId);
  return channel?.hlsUrl || null;
}

export async function getCloudWatchLogs(channelId: string, hours: number = 1): Promise<CloudWatchLog[]> {
  await new Promise(resolve => setTimeout(resolve, 400));
  
  const now = Date.now();
  const logs: CloudWatchLog[] = [];
  const count = Math.floor(Math.random() * 8) + 3;
  
  for (let i = 0; i < count; i++) {
    const timestamp = now - (Math.random() * hours * 3600000);
    const type = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
    const duration = Math.floor(Math.random() * 8) + 3;
    
    logs.push({
      timestamp,
      message: `Event detected: ${type}`,
      eventType: type,
      duration
    });
  }
  
  return logs.sort((a, b) => b.timestamp - a.timestamp);
}

export async function getLiveEvents(): Promise<SportEvent[]> {
  await new Promise(resolve => setTimeout(resolve, 200));
  
  const now = Date.now();
  const events: SportEvent[] = [];
  
  // Generate 5-10 recent events
  const count = Math.floor(Math.random() * 6) + 5;
  for (let i = 0; i < count; i++) {
    const channelId = mockChannels[Math.floor(Math.random() * mockChannels.length)].id;
    const timestamp = now - (Math.random() * 300000); // Last 5 minutes
    events.push(generateMockEvent(channelId, timestamp));
  }
  
  return events.sort((a, b) => b.timestamp - a.timestamp);
}

export async function getChannelEvents(channelId: string, hours: number = 24): Promise<SportEvent[]> {
  await new Promise(resolve => setTimeout(resolve, 600));
  
  const now = Date.now();
  const events: SportEvent[] = [];
  
  // Generate events for each type
  EVENT_TYPES.forEach(type => {
    const count = Math.floor(Math.random() * 10) + 5; // 5-15 events per type
    for (let i = 0; i < count; i++) {
      const timestamp = now - (Math.random() * hours * 3600000);
      const event = generateMockEvent(channelId, timestamp);
      event.type = type;
      event.tags = [type];
      events.push(event);
    }
  });
  
  return events.sort((a, b) => b.timestamp - a.timestamp);
}

// Simulate real-time event stream
export function subscribeToEvents(callback: (event: SportEvent) => void): () => void {
  const interval = setInterval(() => {
    eventCounter++;
    if (eventCounter % 3 === 0) { // Generate event every ~9 seconds
      const channelId = mockChannels[Math.floor(Math.random() * mockChannels.length)].id;
      const event = generateMockEvent(channelId, Date.now());
      callback(event);
    }
  }, 3000);
  
  return () => clearInterval(interval);
}
