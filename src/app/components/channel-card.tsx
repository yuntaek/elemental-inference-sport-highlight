import { useState, useEffect, useCallback, useRef } from 'react';
import { Eye, Loader2, Radio, RefreshCw, X } from 'lucide-react';
import { EventBadge } from '@/app/components/event-badge';
import type { MediaLiveChannel, SportEvent } from '@/app/types/events';
import { getChannelEvents } from '@/app/utils/aws-api';
import { formatTimestamp, formatDuration } from '@/app/utils/event-colors';

function LiveVideoPreview({ hlsUrl, refreshKey }: { hlsUrl: string; refreshKey: number }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    console.log('Initializing HLS player with URL:', hlsUrl);

    const initPlayer = async () => {
      if (typeof window !== 'undefined' && 'Hls' in window) {
        const Hls = (window as any).Hls;
        if (Hls.isSupported()) {
          console.log('Using HLS.js');
          const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
          hls.loadSource(hlsUrl);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log('HLS manifest parsed, starting playback');
            video.play().catch((e) => console.error('Autoplay failed:', e));
          });
          hls.on(Hls.Events.ERROR, (event: any, data: any) => {
            console.error('HLS error:', data);
          });
          return () => hls.destroy();
        }
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        console.log('Using native HLS support');
        video.src = hlsUrl;
        video.play().catch((e) => console.error('Autoplay failed:', e));
      } else {
        console.error('HLS not supported');
      }
    };

    initPlayer();
  }, [hlsUrl, refreshKey]);

  return <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />;
}

interface ChannelCardProps {
  channel: MediaLiveChannel;
  onViewDetails: (channelId: string) => void;
}

export function ChannelCard({ channel, onViewDetails }: ChannelCardProps) {
  const [events, setEvents] = useState<SportEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [thumbnailKey, setThumbnailKey] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<SportEvent | null>(null);

  const loadEvents = useCallback(async () => {
    try {
      const data = await getChannelEvents(channel.id, 1);
      setEvents(data.slice(0, 10));
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  }, [channel.id]);

  useEffect(() => {
    loadEvents();
    // 실시간 폴링 (5초마다)
    const eventInterval = setInterval(loadEvents, 5000);
    // Thumbnail 갱신 (10초마다)
    const thumbInterval = setInterval(() => setThumbnailKey(k => k + 1), 10000);
    return () => {
      clearInterval(eventInterval);
      clearInterval(thumbInterval);
    };
  }, [loadEvents]);

  const isRunning = channel.state === 'RUNNING';

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl border border-gray-700 overflow-hidden hover:border-gray-600 transition-all">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div>
          <h3 className="text-white">{channel.name}</h3>
          <p className="text-xs text-gray-400 mt-0.5">ID: {channel.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 text-xs ${isRunning ? 'text-green-400' : 'text-gray-500'}`}>
            <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
            {channel.state}
          </span>
          <button
            onClick={() => onViewDetails(channel.id)}
            className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
            title="View Details"
          >
            <Eye className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Live Preview */}
      <div className="p-4 pb-2">
        <div className="relative aspect-video bg-gray-950 rounded-lg overflow-hidden">
          {channel.hlsUrl && isRunning ? (
            <LiveVideoPreview hlsUrl={channel.hlsUrl} refreshKey={thumbnailKey} />
          ) : channel.thumbnailUrl ? (
            <img 
              key={thumbnailKey}
              src={channel.thumbnailUrl} 
              alt="Preview" 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-600">
              No Preview
            </div>
          )}
          {isRunning && (
            <div className="absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-0.5 rounded flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              LIVE
            </div>
          )}
          <button
            onClick={() => setThumbnailKey(k => k + 1)}
            className="absolute top-2 right-2 p-1 bg-black/50 rounded hover:bg-black/70 transition-colors"
            title="Refresh Preview"
          >
            <RefreshCw className="w-3 h-3 text-white" />
          </button>
        </div>
      </div>

      {/* Channel Info */}
      <div className="p-4 pt-2 space-y-3">
        {channel.feedArn && (
          <div className="flex items-center gap-2 text-xs text-blue-400 bg-blue-500/10 px-3 py-2 rounded-lg">
            <Radio className="w-4 h-4" />
            <span className="truncate">Inference: {channel.feedArn.split('/').pop()}</span>
          </div>
        )}

        {/* Recent Events */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm text-gray-400">Recent Events</h4>
            <span className="text-xs text-gray-600">{events.length}개</span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
            </div>
          ) : events.length > 0 ? (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {events.map((event, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedEvent(event)}
                  className="w-full flex items-center justify-between text-xs bg-gray-950/50 rounded px-2 py-1.5 hover:bg-gray-950 transition-colors text-left"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <EventBadge type={event.type} size="sm" />
                    <span className="text-gray-400 truncate">{formatTimestamp(event.timestamp)}</span>
                  </div>
                  <span className="text-gray-500">{formatDuration(event.duration || 0)}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-3">No recent events</p>
          )}
        </div>
      </div>

      {/* Event Detail Popup */}
      {selectedEvent && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4 z-10">
          <div className="bg-gray-900 rounded-lg p-4 max-w-sm w-full border border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <EventBadge type={selectedEvent.type} size="md" />
              <button onClick={() => setSelectedEvent(null)} className="p-1 hover:bg-gray-700 rounded">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">시간</span>
                <span className="text-gray-300">{formatTimestamp(selectedEvent.timestamp)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Duration</span>
                <span className="text-gray-300">{formatDuration(selectedEvent.duration || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tags</span>
                <span className="text-gray-300">{selectedEvent.tags?.join(', ') || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Start PTS</span>
                <span className="text-gray-300 text-xs">{selectedEvent.startPts}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">End PTS</span>
                <span className="text-gray-300 text-xs">{selectedEvent.endPts}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
