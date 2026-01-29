import { useState } from 'react';
import { Scissors, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { SportEvent, CreateClipRequest, CreateClipResponse } from '@/app/types/events';
import { isWithinTimeShiftWindow } from '@/app/utils/clip-utils';

interface ClipGeneratorButtonProps {
  event: SportEvent;
  channelId: string;
  onClipCreated: (clipId: string) => void;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const API_BASE = 'https://3tlrl8kw8i.execute-api.us-west-2.amazonaws.com';

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

const sizeClasses = {
  sm: 'px-2 py-1 text-xs gap-1',
  md: 'px-3 py-1.5 text-sm gap-1.5',
  lg: 'px-4 py-2 text-base gap-2',
};

const iconSizes = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

export function ClipGeneratorButton({
  event,
  channelId,
  onClipCreated,
  disabled = false,
  size = 'md',
}: ClipGeneratorButtonProps) {
  const [loading, setLoading] = useState(false);

  const isOutsideWindow = !isWithinTimeShiftWindow(event.timestamp);

  const handleClick = async () => {
    if (loading || disabled || isOutsideWindow) return;

    setLoading(true);
    
    try {
      const request: CreateClipRequest = {
        channelId,
        eventId: event.id,
        startPts: event.startPts,
        endPts: event.endPts,
        timescale: event.timescale,
        timestamp: event.timestamp,
        tags: event.tags,
      };

      const response = await createClip(request);
      
      toast.success('클립 생성이 시작되었습니다', {
        description: `클립 ID: ${response.clipId}`,
      });
      
      onClipCreated(response.clipId);
    } catch (error) {
      const message = error instanceof Error ? error.message : '클립 생성에 실패했습니다';
      toast.error('클립 생성 실패', {
        description: message,
      });
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = disabled || loading || isOutsideWindow;
  
  const buttonTitle = isOutsideWindow 
    ? 'Time-shift 윈도우(24시간)를 벗어난 이벤트입니다' 
    : '클립 생성';

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      title={buttonTitle}
      className={`inline-flex items-center rounded-lg font-medium transition-colors
        ${isDisabled 
          ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
          : 'bg-blue-600 hover:bg-blue-700 text-white'
        } ${sizeClasses[size]}`}
    >
      {loading ? (
        <Loader2 className={`${iconSizes[size]} animate-spin`} />
      ) : (
        <Scissors className={iconSizes[size]} />
      )}
      {loading ? '생성 중...' : '클립 생성'}
    </button>
  );
}
