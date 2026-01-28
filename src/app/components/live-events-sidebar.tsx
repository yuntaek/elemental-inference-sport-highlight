import { useEffect, useState } from 'react';
import { EventBadge } from '@/app/components/event-badge';
import { Loader2, Activity } from 'lucide-react';
import type { SportEvent } from '@/app/types/events';
import { getChannelEvents, getRunningChannels } from '@/app/utils/aws-api';
import { formatRelativeTime, formatDuration } from '@/app/utils/event-colors';

export function LiveEventsSidebar() {
  const [events, setEvents] = useState<SportEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvents();
    const interval = setInterval(loadEvents, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadEvents = async () => {
    try {
      const channels = await getRunningChannels();
      if (channels.length > 0) {
        const data = await getChannelEvents(channels[0].id, 1);
        setEvents(data.slice(0, 30));
      }
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-gray-900 to-gray-800 border-l border-gray-700">
      <div className="px-6 py-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-green-400" />
          <h2 className="text-white">Live Events</h2>
        </div>
        <p className="text-xs text-gray-400 mt-1">Real-time event detection</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-gray-500 animate-spin" />
          </div>
        ) : events.length > 0 ? (
          <div className="space-y-3">
            {events.map((event, idx) => (
              <div key={idx} className="bg-gray-950/50 rounded-lg p-3 border border-gray-700">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <EventBadge type={event.type} size="sm" />
                  <span className="text-xs text-gray-500">{formatRelativeTime(event.timestamp)}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Duration: {formatDuration(event.duration || 0)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Activity className="w-12 h-12 text-gray-700 mb-3" />
            <p className="text-gray-500">No events detected</p>
          </div>
        )}
      </div>
    </div>
  );
}
