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

// Clip 관련 타입 정의
export type ClipStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface Clip {
  id: string;
  channelId: string;
  eventId: string;
  type: EventType;
  tags: string[];
  
  // Time 정보
  startPts: number;
  endPts: number;
  timescale: number;
  duration: number;
  timestamp: number;
  
  // 상태 정보
  status: ClipStatus;
  error?: string;
  
  // 출력 정보
  clipUrl?: string;
  thumbnailUrl?: string;
  
  // 메타데이터
  createdAt: number;
  updatedAt: number;
}

export interface CreateClipRequest {
  channelId: string;
  eventId: string;
  startPts: number;
  endPts: number;
  timescale: number;
  timestamp: number;
  tags?: string[];
}

export interface CreateClipResponse {
  clipId: string;
  status: ClipStatus;
  message: string;
}
