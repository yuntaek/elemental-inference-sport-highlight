export type EventType = 'three-pointer' | 'dunk' | 'incident' | 'default';

export interface MediaLiveChannel {
  id: string;
  name: string;
  arn: string;
  state: string;
  hlsUrl?: string;
  feedArn?: string;
  thumbnailUrl?: string;
}

export interface SportEvent {
  id: string;
  channelId: string;
  type: EventType;
  timestamp: number;
  startPts: number;
  endPts: number;
  timescale: number;
  duration: number;
  qualityScore?: number;
  tags: string[];
  clipUrl?: string;
  thumbnailUrl?: string;
}

export interface CloudWatchLog {
  timestamp: number;
  message: string;
  eventType: EventType;
  duration: number;
}
