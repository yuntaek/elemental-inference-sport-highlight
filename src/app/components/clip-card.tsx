import { Play, Download, Film } from 'lucide-react';
import type { Clip } from '@/app/types/events';
import { ClipStatusBadge } from '@/app/components/clip-status-badge';
import { EventBadge } from '@/app/components/event-badge';
import { formatDuration, formatTimestamp } from '@/app/utils/event-colors';

interface ClipCardProps {
  clip: Clip;
  onPreview: (clip: Clip) => void;
  onDownload: (clip: Clip) => void;
}

export function ClipCard({ clip, onPreview, onDownload }: ClipCardProps) {
  const isCompleted = clip.status === 'COMPLETED';
  const isFailed = clip.status === 'FAILED';

  const handlePreview = () => {
    if (isCompleted) {
      onPreview(clip);
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCompleted) {
      onDownload(clip);
    }
  };

  return (
    <div
      onClick={handlePreview}
      className={`bg-gray-900 rounded-lg border border-gray-700 overflow-hidden transition-all
        ${isCompleted ? 'hover:border-gray-600 cursor-pointer' : 'cursor-default'}
        ${isFailed ? 'border-red-500/30' : ''}`}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-gray-950">
        {clip.thumbnailUrl ? (
          <img
            src={clip.thumbnailUrl}
            alt="Clip thumbnail"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film className="w-12 h-12 text-gray-700" />
          </div>
        )}
        
        {/* Status Badge Overlay */}
        <div className="absolute top-2 left-2">
          <ClipStatusBadge status={clip.status} size="sm" />
        </div>

        {/* Play Button Overlay (only for completed clips) */}
        {isCompleted && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Play className="w-6 h-6 text-white fill-white" />
            </div>
          </div>
        )}

        {/* Duration Badge */}
        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
          {formatDuration(clip.duration)}
        </div>
      </div>

      {/* Metadata */}
      <div className="p-3 space-y-2">
        {/* Event Type and Time */}
        <div className="flex items-center justify-between">
          <EventBadge type={clip.type} size="sm" />
          <span className="text-xs text-gray-500">
            {formatTimestamp(clip.timestamp)}
          </span>
        </div>

        {/* Tags */}
        {clip.tags && clip.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {clip.tags.map((tag, idx) => (
              <span
                key={idx}
                className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Error Message (for failed clips) */}
        {isFailed && clip.error && (
          <p className="text-xs text-red-400 truncate" title={clip.error}>
            {clip.error}
          </p>
        )}

        {/* Action Buttons */}
        {isCompleted && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={handlePreview}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <Play className="w-3 h-3" />
              미리보기
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <Download className="w-3 h-3" />
              다운로드
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Extracts clip metadata for display purposes.
 * Used for property testing to verify metadata completeness.
 */
export function extractClipMetadata(clip: Clip): {
  eventType: string;
  time: string;
  duration: string;
} {
  return {
    eventType: clip.type,
    time: formatTimestamp(clip.timestamp),
    duration: formatDuration(clip.duration),
  };
}
