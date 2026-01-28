import { useState, useEffect } from 'react';
import { Loader2, MonitorPlay, RefreshCw } from 'lucide-react';
import { ChannelCard } from '@/app/components/channel-card';
import { ShortsSidebar } from '@/app/components/shorts-sidebar';
import { ChannelDetailModal } from '@/app/components/channel-detail-modal';
import { ShortsProvider } from '@/app/context/shorts-context';
import type { MediaLiveChannel } from '@/app/types/events';
import { getRunningChannels } from '@/app/utils/aws-api';

function DashboardContent() {
  const [channels, setChannels] = useState<MediaLiveChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<MediaLiveChannel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadChannels = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getRunningChannels();
      setChannels(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load channels');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChannels();
    // 채널 목록 갱신 (30초마다)
    const interval = setInterval(loadChannels, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleViewDetails = (channelId: string) => {
    const channel = channels.find(ch => ch.id === channelId);
    if (channel) setSelectedChannel(channel);
  };

  return (
    <div className="h-screen flex bg-[#0a0a0a]">
      {/* Main Content (70%) */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ width: '70%' }}>
        <header className="border-b border-gray-800 bg-gradient-to-r from-gray-900 to-gray-800">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <MonitorPlay className="w-8 h-8 text-blue-400" />
                <div>
                  <h1 className="text-white">Sports Event Monitoring</h1>
                  <p className="text-sm text-gray-400">AWS MediaLive Channels (us-west-2)</p>
                </div>
              </div>
              <button
                onClick={loadChannels}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">
          {loading && channels.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 text-gray-500 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-6 max-w-md">
                <p className="text-red-400 mb-4">{error}</p>
                <button onClick={loadChannels} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg">
                  Retry
                </button>
              </div>
            </div>
          ) : channels.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {channels.map((channel) => (
                <ChannelCard key={channel.id} channel={channel} onViewDetails={handleViewDetails} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl border border-gray-700 p-12 max-w-md">
                <MonitorPlay className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                <h2 className="text-white mb-2">No Channels Found</h2>
                <p className="text-gray-400">No MediaLive channels in us-west-2 region</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Shorts Sidebar (30%) */}
      <aside className="overflow-hidden" style={{ width: '30%' }}>
        <ShortsSidebar />
      </aside>

      {selectedChannel && (
        <ChannelDetailModal channel={selectedChannel} onClose={() => setSelectedChannel(null)} />
      )}
    </div>
  );
}

export function Dashboard() {
  return (
    <ShortsProvider>
      <DashboardContent />
    </ShortsProvider>
  );
}
