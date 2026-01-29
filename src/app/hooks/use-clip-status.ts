import { useState, useEffect, useCallback, useRef } from 'react';
import type { Clip, ClipStatus } from '@/app/types/events';
import { getClipStatus } from '@/app/utils/aws-api';

const POLLING_INTERVAL = 5000; // 5초

interface UseClipStatusOptions {
  onStatusChange?: (newStatus: ClipStatus, previousStatus: ClipStatus) => void;
  onCompleted?: (clip: Clip) => void;
  onFailed?: (clip: Clip, error?: string) => void;
}

interface UseClipStatusResult {
  clip: Clip | null;
  status: ClipStatus | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * 단일 클립의 상태를 폴링하는 훅
 * - PROCESSING 상태일 때만 5초 간격으로 폴링
 * - 상태 변경 시 콜백 호출
 * 
 * Requirements: 4.2, 4.3
 */
export function useClipStatus(
  clipId: string | null,
  options: UseClipStatusOptions = {}
): UseClipStatusResult {
  const { onStatusChange, onCompleted, onFailed } = options;
  
  const [clip, setClip] = useState<Clip | null>(null);
  const [status, setStatus] = useState<ClipStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const previousStatusRef = useRef<ClipStatus | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchClipStatus = useCallback(async () => {
    if (!clipId) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const clipData = await getClipStatus(clipId);
      setClip(clipData);
      
      const newStatus = clipData.status;
      const previousStatus = previousStatusRef.current;
      
      // 상태 변경 감지 및 콜백 호출
      if (previousStatus !== null && previousStatus !== newStatus) {
        onStatusChange?.(newStatus, previousStatus);
        
        if (newStatus === 'COMPLETED') {
          onCompleted?.(clipData);
        } else if (newStatus === 'FAILED') {
          onFailed?.(clipData, clipData.error);
        }
      }
      
      setStatus(newStatus);
      previousStatusRef.current = newStatus;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch clip status';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [clipId, onStatusChange, onCompleted, onFailed]);

  // 폴링 관리: PROCESSING 상태일 때만 활성화
  useEffect(() => {
    // 기존 인터벌 정리
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!clipId) {
      setClip(null);
      setStatus(null);
      setError(null);
      previousStatusRef.current = null;
      return;
    }

    // 초기 fetch
    fetchClipStatus();

    // PROCESSING 상태일 때만 폴링 시작
    if (status === 'PROCESSING' || status === 'PENDING') {
      intervalRef.current = setInterval(fetchClipStatus, POLLING_INTERVAL);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [clipId, status, fetchClipStatus]);

  return {
    clip,
    status,
    isLoading,
    error,
    refetch: fetchClipStatus,
  };
}


interface UseBatchClipStatusOptions {
  onClipStatusChange?: (clipId: string, newStatus: ClipStatus, previousStatus: ClipStatus) => void;
  onAllCompleted?: (clips: Clip[]) => void;
  onClipCompleted?: (clip: Clip) => void;
  onClipFailed?: (clip: Clip, error?: string) => void;
}

interface BatchClipState {
  clip: Clip | null;
  status: ClipStatus | null;
  error: string | null;
}

interface UseBatchClipStatusResult {
  clips: Map<string, BatchClipState>;
  completedCount: number;
  failedCount: number;
  processingCount: number;
  totalCount: number;
  progress: number; // 0-100
  isAllCompleted: boolean;
  hasFailures: boolean;
  refetchAll: () => Promise<void>;
}

/**
 * 여러 클립의 상태를 동시에 추적하는 훅
 * - 전체 진행률 계산
 * - 각 클립의 상태를 독립적으로 추적
 * 
 * Requirements: 7.2, 7.4
 */
export function useBatchClipStatus(
  clipIds: string[],
  options: UseBatchClipStatusOptions = {}
): UseBatchClipStatusResult {
  const { onClipStatusChange, onAllCompleted, onClipCompleted, onClipFailed } = options;
  
  const [clips, setClips] = useState<Map<string, BatchClipState>>(new Map());
  const previousStatusesRef = useRef<Map<string, ClipStatus>>(new Map());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchAllClipStatuses = useCallback(async () => {
    if (clipIds.length === 0) return;
    
    const results = await Promise.allSettled(
      clipIds.map(async (clipId) => {
        const clipData = await getClipStatus(clipId);
        return { clipId, clipData };
      })
    );
    
    setClips((prevClips) => {
      const newClips = new Map(prevClips);
      const completedClips: Clip[] = [];
      
      results.forEach((result, index) => {
        const clipId = clipIds[index];
        
        if (result.status === 'fulfilled') {
          const { clipData } = result.value;
          const previousStatus = previousStatusesRef.current.get(clipId);
          const newStatus = clipData.status;
          
          // 상태 변경 감지 및 콜백 호출
          if (previousStatus !== undefined && previousStatus !== newStatus) {
            onClipStatusChange?.(clipId, newStatus, previousStatus);
            
            if (newStatus === 'COMPLETED') {
              onClipCompleted?.(clipData);
              completedClips.push(clipData);
            } else if (newStatus === 'FAILED') {
              onClipFailed?.(clipData, clipData.error);
            }
          }
          
          previousStatusesRef.current.set(clipId, newStatus);
          newClips.set(clipId, {
            clip: clipData,
            status: newStatus,
            error: null,
          });
        } else {
          const errorMessage = result.reason instanceof Error 
            ? result.reason.message 
            : 'Failed to fetch clip status';
          
          newClips.set(clipId, {
            clip: newClips.get(clipId)?.clip || null,
            status: newClips.get(clipId)?.status || null,
            error: errorMessage,
          });
        }
      });
      
      return newClips;
    });
  }, [clipIds, onClipStatusChange, onClipCompleted, onClipFailed]);

  // 진행률 및 상태 계산
  const completedCount = Array.from(clips.values()).filter(
    (state) => state.status === 'COMPLETED'
  ).length;
  
  const failedCount = Array.from(clips.values()).filter(
    (state) => state.status === 'FAILED'
  ).length;
  
  const processingCount = Array.from(clips.values()).filter(
    (state) => state.status === 'PROCESSING' || state.status === 'PENDING'
  ).length;
  
  const totalCount = clipIds.length;
  
  // Property 9: 진행률 = (완료된 클립 수 / 전체 클립 수) × 100
  const progress = totalCount > 0 
    ? Math.round(((completedCount + failedCount) / totalCount) * 100) 
    : 0;
  
  const isAllCompleted = totalCount > 0 && (completedCount + failedCount) === totalCount;
  const hasFailures = failedCount > 0;

  // 모든 클립 완료 시 콜백 호출
  useEffect(() => {
    if (isAllCompleted && completedCount > 0) {
      const completedClips = Array.from(clips.values())
        .filter((state) => state.status === 'COMPLETED' && state.clip)
        .map((state) => state.clip as Clip);
      
      if (completedClips.length > 0) {
        onAllCompleted?.(completedClips);
      }
    }
  }, [isAllCompleted, completedCount, clips, onAllCompleted]);

  // 폴링 관리
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (clipIds.length === 0) {
      setClips(new Map());
      previousStatusesRef.current.clear();
      return;
    }

    // 초기 fetch
    fetchAllClipStatuses();

    // 아직 처리 중인 클립이 있으면 폴링 계속
    if (processingCount > 0 || clips.size < clipIds.length) {
      intervalRef.current = setInterval(fetchAllClipStatuses, POLLING_INTERVAL);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [clipIds.join(','), processingCount, fetchAllClipStatuses]);

  return {
    clips,
    completedCount,
    failedCount,
    processingCount,
    totalCount,
    progress,
    isAllCompleted,
    hasFailures,
    refetchAll: fetchAllClipStatuses,
  };
}
