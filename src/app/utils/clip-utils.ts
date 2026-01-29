/**
 * Time-shift URL 생성 유틸리티 함수
 * MediaPackage의 Time-shift 기능을 활용하여 라이브 스트림의 과거 시점 영상에 접근
 */

// Time-shift 윈도우 기본값 (24시간, 밀리초)
const TIME_SHIFT_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * PTS(Presentation Time Stamp)를 초 단위로 변환
 * @param pts - Presentation Time Stamp 값
 * @param timescale - PTS를 초 단위로 변환하기 위한 스케일 값
 * @returns 초 단위 시간
 */
export function ptsToSeconds(pts: number, timescale: number): number {
  if (timescale <= 0) {
    throw new Error('Timescale must be a positive number');
  }
  return pts / timescale;
}

/**
 * Unix timestamp를 ISO 8601 형식 문자열로 변환
 * @param timestamp - Unix timestamp (밀리초)
 * @returns ISO 8601 형식 문자열 (예: 2024-01-01T12:00:00.000Z)
 */
export function timestampToISO8601(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

/**
 * 클립의 시작/종료 시간을 계산하여 ISO 8601 형식으로 반환
 * @param eventTimestamp - 이벤트 발생 시점 (Unix timestamp, 밀리초)
 * @param startPts - 시작 PTS
 * @param endPts - 종료 PTS
 * @param timescale - PTS 스케일 값
 * @returns { startTime, endTime } ISO 8601 형식의 시작/종료 시간
 */
export function calculateClipTimeRange(
  eventTimestamp: number,
  startPts: number,
  endPts: number,
  timescale: number
): { startTime: string; endTime: string } {
  const startSeconds = Math.floor(ptsToSeconds(startPts, timescale));
  const endSeconds = Math.ceil(ptsToSeconds(endPts, timescale));
  const durationMs = (endSeconds - startSeconds) * 1000;

  // 이벤트 timestamp를 기준으로 시작/종료 시간 계산
  const endTime = new Date(eventTimestamp);
  const startTime = new Date(eventTimestamp - durationMs);

  return {
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
  };
}

export interface TimeShiftUrlParams {
  baseUrl: string;
  eventTimestamp: number;
  startPts: number;
  endPts: number;
  timescale: number;
}

export interface TimeShiftUrlResult {
  url: string;
  startTime: string;
  endTime: string;
}

/**
 * Time-shift URL 생성
 * @param params - Time-shift URL 생성에 필요한 파라미터
 * @returns Time-shift URL과 시간 정보
 */
export function generateTimeShiftUrl(params: TimeShiftUrlParams): TimeShiftUrlResult {
  const { baseUrl, eventTimestamp, startPts, endPts, timescale } = params;

  const { startTime, endTime } = calculateClipTimeRange(
    eventTimestamp,
    startPts,
    endPts,
    timescale
  );

  // URL에 start/end 파라미터 추가
  const url = new URL(baseUrl);
  url.searchParams.set('start', startTime);
  url.searchParams.set('end', endTime);

  return {
    url: url.toString(),
    startTime,
    endTime,
  };
}

export interface TimeShiftWindowValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Time-shift 윈도우 범위 검증 (기본 24시간)
 * @param eventTimestamp - 이벤트 발생 시점 (Unix timestamp, 밀리초)
 * @param windowMs - Time-shift 윈도우 크기 (밀리초, 기본 24시간)
 * @returns 검증 결과
 */
export function validateTimeShiftWindow(
  eventTimestamp: number,
  windowMs: number = TIME_SHIFT_WINDOW_MS
): TimeShiftWindowValidationResult {
  const now = Date.now();
  const windowStart = now - windowMs;

  if (eventTimestamp < windowStart) {
    return {
      isValid: false,
      error: `Event outside time-shift window. Event timestamp: ${new Date(eventTimestamp).toISOString()}, Window start: ${new Date(windowStart).toISOString()}`,
    };
  }

  if (eventTimestamp > now) {
    return {
      isValid: false,
      error: `Event timestamp is in the future: ${new Date(eventTimestamp).toISOString()}`,
    };
  }

  return { isValid: true };
}

/**
 * 클립 duration 계산 (초 단위)
 * @param startPts - 시작 PTS
 * @param endPts - 종료 PTS
 * @param timescale - PTS 스케일 값
 * @returns duration (초)
 */
export function calculateClipDuration(
  startPts: number,
  endPts: number,
  timescale: number
): number {
  const startSeconds = Math.floor(ptsToSeconds(startPts, timescale));
  const endSeconds = Math.ceil(ptsToSeconds(endPts, timescale));
  return endSeconds - startSeconds;
}


/**
 * Time-shift 윈도우 내에 있는지 확인하는 간단한 헬퍼 함수
 * @param eventTimestamp - 이벤트 발생 시점 (Unix timestamp, 밀리초)
 * @param windowMs - Time-shift 윈도우 크기 (밀리초, 기본 24시간)
 * @returns 윈도우 내에 있으면 true, 아니면 false
 */
export function isWithinTimeShiftWindow(
  eventTimestamp: number,
  windowMs: number = TIME_SHIFT_WINDOW_MS
): boolean {
  const result = validateTimeShiftWindow(eventTimestamp, windowMs);
  return result.isValid;
}
