import { useState, useCallback } from 'react';
import { Scissors, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { SportEvent, CreateClipRequest, CreateClipResponse, ClipStatus } from '@/app/types/events';
import { useBatchClipStatus } from '@/app/hooks/use-clip-status';
import { isWithinTimeShiftWindow } from '@/app/utils/clip-utils';
import { ClipStatusBadge } from '@/app/components/clip-status-badge';

const API_BASE = 'https://3tlrl8kw8i.execute-api.us-west-2.amazonaws.com';

interface BatchClipGeneratorProps {
  events: SportEvent[];
  channelId: string;
  selectedEventIds: string[];
  onSelectionChange: (eventIds: string[]) => void;
  onClipsCreated?: (clipIds: string[]) => void;
}

interface BatchClipResult {
  eventId: string;
  clipId?: string;
  status: 'success' | 'failed';
  error?: string;
}

async function createClip(request: CreateClipRequest): Promise<CreateClipResponse> {
  const res = await fetch(`${API_BASE}/clips`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Failed to create clip' }));
    throw new Error(error.error || 'Failed to create clip');
  }
  
  return res.json();
}

/**
 * 일괄 클립 생성 로직
 * - 선택된 이벤트별 개별 요청 전송
 * - 부분 실패 처리 (성공/실패 분리 표시)
 * 
 * Requirements: 7.1, 7.2, 7.3
 */
export async function createBatchClips(
  events: SportEvent[],
  channelId: string
): Promise<BatchClipResult[]> {
  // Property 7: 일괄 클립 생성 요청 수 일치
  // N개의 이벤트에 대해 정확히 N개의 개별 클립 생성 요청 전송
  const results = await Promise.allSettled(
    events.map(async (event): Promise<BatchClipResult> => {
      const request: CreateClipRequest = {
        channelId,
        eventId: event.id,
        startPts: event.startPts,
        endPts: event.endPts,
        timescale: event.timescale,
        timestamp: event.timestamp,
        tags: event.tags,
      };

      try {
        const response = await createClip(request);
        return {
          eventId: event.id,
          clipId: response.clipId,
          status: 'success',
        };
      } catch (error) {
        return {
          eventId: event.id,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    })
  );

  // Property 8: 일괄 클립 상태 독립성
  // 각 클립의 결과를 독립적으로 처리
  return results.map((result) => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    return {
      eventId: 'unknown',
      status: 'failed' as const,
      error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
    };
  });
}

/**
 * 일괄 클립 진행률 계산
 * Property 9: 진행률 = (완료된 클립 수 / 전체 클립 수) × 100
 */
export function calculateBatchProgress(
  completedCount: number,
  failedCount: number,
  totalCount: number
): number {
  if (totalCount === 0) return 0;
  return Math.round(((completedCount + failedCount) / totalCount) * 100);
}

/**
 * BatchClipGenerator 컴포넌트
 * - 이벤트 다중 선택 UI
 * - 일괄 클립 생성 버튼
 * - 전체 진행률 표시
 * 
 * Requirements: 7.1, 7.4
 */
export function BatchClipGenerator({
  events,
  channelId,
  selectedEventIds,
  onSelectionChange,
  onClipsCreated,
}: BatchClipGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [batchResults, setBatchResults] = useState<BatchClipResult[]>([]);
  const [createdClipIds, setCreatedClipIds] = useState<string[]>([]);

  // 생성된 클립들의 상태 추적
  const {
    clips,
    completedCount,
    failedCount,
    processingCount,
    totalCount,
    progress,
    isAllCompleted,
    hasFailures,
  } = useBatchClipStatus(createdClipIds, {
    onAllCompleted: (completedClips) => {
      toast.success('모든 클립 생성이 완료되었습니다', {
        description: `${completedClips.length}개의 클립이 생성되었습니다`,
      });
    },
    onClipFailed: (clip, error) => {
      toast.error(`클립 생성 실패: ${clip.id}`, {
        description: error || '알 수 없는 오류',
      });
    },
  });

  // 선택 가능한 이벤트 (Time-shift 윈도우 내)
  const selectableEvents = events.filter((event) => 
    isWithinTimeShiftWindow(event.timestamp)
  );

  const handleSelectAll = useCallback(() => {
    if (selectedEventIds.length === selectableEvents.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(selectableEvents.map((e) => e.id));
    }
  }, [selectedEventIds.length, selectableEvents, onSelectionChange]);

  const handleToggleEvent = useCallback((eventId: string) => {
    if (selectedEventIds.includes(eventId)) {
      onSelectionChange(selectedEventIds.filter((id) => id !== eventId));
    } else {
      onSelectionChange([...selectedEventIds, eventId]);
    }
  }, [selectedEventIds, onSelectionChange]);

  const handleBatchGenerate = async () => {
    if (selectedEventIds.length === 0 || isGenerating) return;

    setIsGenerating(true);
    setBatchResults([]);
    setCreatedClipIds([]);

    try {
      const selectedEvents = events.filter((e) => selectedEventIds.includes(e.id));
      
      toast.info('일괄 클립 생성 시작', {
        description: `${selectedEvents.length}개의 클립 생성을 시작합니다`,
      });

      const results = await createBatchClips(selectedEvents, channelId);
      setBatchResults(results);

      const successfulClipIds = results
        .filter((r) => r.status === 'success' && r.clipId)
        .map((r) => r.clipId as string);

      const failedCount = results.filter((r) => r.status === 'failed').length;

      setCreatedClipIds(successfulClipIds);
      onClipsCreated?.(successfulClipIds);

      if (failedCount > 0) {
        toast.warning('일부 클립 생성 실패', {
          description: `${successfulClipIds.length}개 성공, ${failedCount}개 실패`,
        });
      } else {
        toast.success('클립 생성 요청 완료', {
          description: `${successfulClipIds.length}개의 클립 생성이 시작되었습니다`,
        });
      }
    } catch (error) {
      toast.error('일괄 클립 생성 실패', {
        description: error instanceof Error ? error.message : '알 수 없는 오류',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const isAllSelected = selectedEventIds.length === selectableEvents.length && selectableEvents.length > 0;
  const hasSelection = selectedEventIds.length > 0;
  const showProgress = createdClipIds.length > 0 && !isAllCompleted;

  return (
    <div className="space-y-4">
      {/* 선택 컨트롤 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={handleSelectAll}
              disabled={selectableEvents.length === 0}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-300">
              전체 선택 ({selectedEventIds.length}/{selectableEvents.length})
            </span>
          </label>
        </div>

        <button
          onClick={handleBatchGenerate}
          disabled={!hasSelection || isGenerating}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors
            ${!hasSelection || isGenerating
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
        >
          {isGenerating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Scissors className="w-4 h-4" />
          )}
          {isGenerating ? '생성 중...' : `일괄 클립 생성 (${selectedEventIds.length})`}
        </button>
      </div>

      {/* 진행률 표시 */}
      {showProgress && (
        <div className="bg-gray-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-300">클립 생성 진행률</span>
            <span className="text-gray-400">
              {completedCount + failedCount} / {totalCount} ({progress}%)
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${
                hasFailures ? 'bg-yellow-500' : 'bg-blue-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* 상태 요약 */}
          <div className="flex items-center gap-4 text-xs">
            {processingCount > 0 && (
              <span className="flex items-center gap-1 text-blue-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                처리 중: {processingCount}
              </span>
            )}
            {completedCount > 0 && (
              <span className="flex items-center gap-1 text-green-400">
                <CheckCircle className="w-3 h-3" />
                완료: {completedCount}
              </span>
            )}
            {failedCount > 0 && (
              <span className="flex items-center gap-1 text-red-400">
                <XCircle className="w-3 h-3" />
                실패: {failedCount}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 초기 요청 결과 (부분 실패 표시) */}
      {batchResults.length > 0 && batchResults.some((r) => r.status === 'failed') && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
          <div className="flex items-center gap-2 text-red-400 text-sm mb-2">
            <AlertCircle className="w-4 h-4" />
            일부 클립 생성 요청 실패
          </div>
          <ul className="text-xs text-gray-400 space-y-1">
            {batchResults
              .filter((r) => r.status === 'failed')
              .map((r, idx) => (
                <li key={idx}>• {r.error || '알 수 없는 오류'}</li>
              ))}
          </ul>
        </div>
      )}

      {/* 완료 상태 */}
      {isAllCompleted && createdClipIds.length > 0 && (
        <div className={`rounded-lg p-3 ${
          hasFailures 
            ? 'bg-yellow-500/10 border border-yellow-500/30' 
            : 'bg-green-500/10 border border-green-500/30'
        }`}>
          <div className={`flex items-center gap-2 text-sm ${
            hasFailures ? 'text-yellow-400' : 'text-green-400'
          }`}>
            {hasFailures ? (
              <AlertCircle className="w-4 h-4" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            {hasFailures
              ? `일괄 클립 생성 완료 (${completedCount}개 성공, ${failedCount}개 실패)`
              : `모든 클립 생성 완료 (${completedCount}개)`
            }
          </div>
        </div>
      )}
    </div>
  );
}

export type { BatchClipResult, BatchClipGeneratorProps };
