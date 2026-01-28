import { X, Youtube, Trash2 } from 'lucide-react';
import { useShorts } from '@/app/context/shorts-context';
import { EventBadge } from '@/app/components/event-badge';
import { formatTimestamp, formatDuration } from '@/app/utils/event-colors';

export function ShortsSidebar() {
  const { queue, removeFromQueue, clearQueue } = useShorts();

  const handlePublish = () => {
    alert('YouTube 배포 기능은 추후 구현 예정입니다.');
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-gray-900 to-gray-800 border-l border-gray-700">
      <div className="px-6 py-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Youtube className="w-5 h-5 text-red-500" />
            <h2 className="text-white">숏츠 제작 대기열</h2>
          </div>
          {queue.length > 0 && (
            <button onClick={clearQueue} className="text-xs text-gray-500 hover:text-gray-300">
              전체 삭제
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-1">{queue.length}개 클립 선택됨</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {queue.length > 0 ? (
          <div className="space-y-3">
            {queue.map((item) => (
              <div
                key={item.event.id}
                className="bg-gray-950/50 rounded-lg p-3 border border-gray-700"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <EventBadge type={item.event.type} size="sm" />
                  <button
                    onClick={() => removeFromQueue(item.event.id)}
                    className="p-1 hover:bg-red-500/20 rounded"
                  >
                    <X className="w-3 h-3 text-red-400" />
                  </button>
                </div>
                <p className="text-sm text-gray-300 truncate">{item.channel.name}</p>
                <p className="text-xs text-gray-500">{formatTimestamp(item.event.timestamp)}</p>
                <p className="text-xs text-gray-500">Duration: {formatDuration(item.event.duration || 0)}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Youtube className="w-12 h-12 text-gray-700 mb-3" />
            <p className="text-gray-500">대기열이 비어있습니다</p>
            <p className="text-xs text-gray-600 mt-1">채널 상세에서 클립을 추가하세요</p>
          </div>
        )}
      </div>

      {queue.length > 0 && (
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={handlePublish}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            <Youtube className="w-5 h-5" />
            <span>YouTube 숏츠 배포</span>
          </button>
        </div>
      )}
    </div>
  );
}
