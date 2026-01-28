import { useState, useEffect } from 'react';
import { X, Play, Loader2, Video, Plus, Check } from 'lucide-react';
import { EventBadge } from '@/app/components/event-badge';
import { VideoPlayer } from '@/app/components/video-player';
import { useShorts } from '@/app/context/shorts-context';
import type { MediaLiveChannel, SportEvent, EventType } from '@/app/types/events';
import { getChannelEvents } from '@/app/utils/aws-api';
import { formatTimestamp, formatDuration } from '@/app/utils/event-colors';

interface ChannelDetailModalProps {
  channel: MediaLiveChannel;
  onClose: () => void;
}

export function ChannelDetailModal({ channel, onClose }: ChannelDetailModalProps) {
  const [events, setEvents] = useState<SportEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClip, setSelectedClip] = useState<SportEvent | null>(null);
  const { queue, addToQueue } = useShorts();

  useEffect(() => {
    loadEvents();
  }, [channel.id]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await getChannelEvents(channel.id, 24);
      setEvents(data);
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  };

  const eventsByType = events.reduce((acc, event) => {
    const type = event.type || 'default';
    if (!acc[type]) acc[type] = [];
    acc[type].push(event);
    return acc;
  }, {} as Record<string, SportEvent[]>);

  const isInQueue = (eventId: string) => queue.some(item => item.event.id === eventId);

  const handleAddToShorts = (event: SportEvent) => {
    addToQueue(event, channel);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl border border-gray-700 max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-white">{channel.name}</h2>
            <p className="text-sm text-gray-400 mt-1">
              {selectedClip ? 'Highlight Preview' : `Event History - ${events.length} events`}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {selectedClip ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <EventBadge type={selectedClip.type} size="lg" />
                  <div>
                    <p className="text-white">{formatTimestamp(selectedClip.timestamp)}</p>
                    <p className="text-sm text-gray-400">Duration: {formatDuration(selectedClip.duration || 0)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedClip(null)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white"
                >
                  목록으로
                </button>
              </div>
              
              <div className="max-w-4xl mx-auto relative">
                {selectedClip.clipUrl ? (
                  <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
                    <video
                      src={selectedClip.clipUrl}
                      className="w-full h-full"
                      controls
                      autoPlay
                      playsInline
                    />
                  </div>
                ) : channel.hlsUrl ? (
                  <VideoPlayer 
                    hlsUrl={channel.hlsUrl} 
                    channelName={channel.name}
                    startTime={selectedClip.startPts / selectedClip.timescale}
                  />
                ) : (
                  <div className="aspect-video bg-gray-950 rounded-lg flex flex-col items-center justify-center">
                    <Video className="w-16 h-16 text-gray-700 mb-4" />
                    <p className="text-gray-500">No video available</p>
                  </div>
                )}
                
                {/* Floating Action Buttons */}
                <div className="absolute top-4 right-4 flex flex-col gap-2">
                  <button
                    onClick={() => handleAddToShorts(selectedClip)}
                    disabled={isInQueue(selectedClip.id)}
                    className={`p-3 rounded-full shadow-lg transition-all ${
                      isInQueue(selectedClip.id)
                        ? 'bg-green-600 text-white cursor-default'
                        : 'bg-red-600 hover:bg-red-700 text-white hover:scale-110'
                    }`}
                    title={isInQueue(selectedClip.id) ? '추가됨' : '숏츠 작업하기'}
                  >
                    {isInQueue(selectedClip.id) ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <Plus className="w-5 h-5" />
                    )}
                  </button>
                  <button
                    className="p-3 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg hover:scale-110 transition-all"
                    title="YouTube에 업로드"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                  </button>
                </div>
              </div>

              <div className="max-w-4xl mx-auto bg-gray-950/50 rounded-lg p-4">
                <h4 className="text-sm text-gray-400 mb-2">Clip Details</h4>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                  <div>Start PTS: {selectedClip.startPts}</div>
                  <div>End PTS: {selectedClip.endPts}</div>
                  <div>Timescale: {selectedClip.timescale}</div>
                  <div>Tags: {selectedClip.tags?.join(', ')}</div>
                </div>
              </div>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-gray-500 animate-spin" />
            </div>
          ) : Object.keys(eventsByType).length > 0 ? (
            <div className="space-y-6">
              {Object.entries(eventsByType).map(([type, typeEvents]) => (
                <div key={type} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <EventBadge type={type as EventType} size="md" />
                    <span className="text-gray-400">({typeEvents.length} clips)</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {typeEvents.slice(0, 12).map((event, idx) => (
                      <div
                        key={idx}
                        className="bg-gray-950/50 border border-gray-700 rounded-lg overflow-hidden hover:border-blue-500 transition-all group relative"
                      >
                        <div className="w-full aspect-video bg-gray-900 flex items-center justify-center relative overflow-hidden">
                          {event.clipUrl ? (
                            <video
                              src={event.clipUrl}
                              className="w-full h-full object-cover"
                              controls
                              playsInline
                              poster={event.thumbnailUrl}
                            />
                          ) : event.thumbnailUrl ? (
                            <>
                              <img 
                                src={event.thumbnailUrl} 
                                alt="Clip thumbnail"
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
                                <Play className="w-12 h-12 text-white drop-shadow-lg" />
                              </div>
                            </>
                          ) : (
                            <Play className="w-12 h-12 text-gray-600" />
                          )}
                        </div>
                        
                        <div className="p-3">
                          <div className="flex items-start justify-between mb-1">
                            <span className="text-sm text-gray-300">{formatTimestamp(event.timestamp)}</span>
                            {isInQueue(event.id) && (
                              <span className="text-xs">✅</span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500 block">{formatDuration(event.duration || 0)}</span>
                        </div>
                        
                        <div className="absolute top-2 right-2 flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddToShorts(event);
                            }}
                            disabled={isInQueue(event.id)}
                            className={`text-lg bg-black/50 backdrop-blur-sm rounded-full w-7 h-7 flex items-center justify-center ${
                              isInQueue(event.id) ? 'opacity-50 cursor-default' : 'hover:scale-110 transition-transform'
                            }`}
                            title="숏츠 추가"
                          >
                            ➕
                          </button>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="text-lg bg-black/50 backdrop-blur-sm rounded-full w-7 h-7 flex items-center justify-center hover:scale-110 transition-transform"
                            title="YouTube 업로드"
                          >
                            ▶️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <Video className="w-16 h-16 text-gray-700 mb-4" />
              <p className="text-gray-500">No highlight events found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
