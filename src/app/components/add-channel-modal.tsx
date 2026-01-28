import { useState, useEffect } from 'react';
import { X, Plus, Loader2, Radio } from 'lucide-react';
import type { MediaLiveChannel } from '@/app/types/events';
import { getRunningChannels } from '@/app/utils/aws-mock';

interface AddChannelModalProps {
  onClose: () => void;
  onAdd: (channel: MediaLiveChannel) => void;
  activeChannelIds: string[];
}

export function AddChannelModal({ onClose, onAdd, activeChannelIds }: AddChannelModalProps) {
  const [channels, setChannels] = useState<MediaLiveChannel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChannels();
  }, []);

  const loadChannels = async () => {
    setLoading(true);
    try {
      const data = await getRunningChannels();
      setChannels(data);
    } catch (error) {
      console.error('Failed to load channels:', error);
    } finally {
      setLoading(false);
    }
  };

  const availableChannels = channels.filter(ch => !activeChannelIds.includes(ch.id));

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl border border-gray-700 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-white">Add Channel</h2>
            <p className="text-sm text-gray-400 mt-1">Select a running MediaLive channel to monitor</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-gray-500 animate-spin" />
            </div>
          ) : availableChannels.length > 0 ? (
            <div className="space-y-3">
              {availableChannels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => {
                    onAdd(channel);
                    onClose();
                  }}
                  className="w-full bg-gray-950/50 border border-gray-700 rounded-lg p-4 hover:border-gray-600 hover:bg-gray-950 transition-all text-left group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-white">{channel.name}</h3>
                        <span className="flex items-center gap-1.5 text-xs text-green-400">
                          <Radio className="w-3 h-3" />
                          {channel.state}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">{channel.id}</p>
                      <p className="text-xs text-gray-500 mt-1">{channel.arn}</p>
                    </div>
                    <Plus className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors flex-shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Radio className="w-12 h-12 text-gray-700 mb-3" />
              <p className="text-gray-400">No available channels</p>
              <p className="text-sm text-gray-500 mt-1">All running channels are already being monitored</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
