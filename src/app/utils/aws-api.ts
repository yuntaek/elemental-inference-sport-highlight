import type { MediaLiveChannel, SportEvent } from '@/app/types/events';

const API_BASE = 'https://3tlrl8kw8i.execute-api.us-west-2.amazonaws.com';

export async function getRunningChannels(): Promise<MediaLiveChannel[]> {
  const res = await fetch(`${API_BASE}/channels`);
  if (!res.ok) throw new Error('Failed to fetch channels');
  const data = await res.json();
  console.log('Channels response:', data);
  return data;
}

export async function getChannelDetails(channelId: string): Promise<MediaLiveChannel> {
  const res = await fetch(`${API_BASE}/channels/${channelId}`);
  if (!res.ok) throw new Error('Failed to fetch channel details');
  return res.json();
}

export async function getChannelEvents(channelId: string, hours = 24): Promise<SportEvent[]> {
  const res = await fetch(`${API_BASE}/channels/${channelId}/events?hours=${hours}`);
  if (!res.ok) throw new Error('Failed to fetch events');
  const data = await res.json();
  console.log('Channel events response:', data);
  return data;
}

// 실시간 이벤트 폴링
export function subscribeToEvents(callback: (event: SportEvent) => void): () => void {
  let lastTimestamp = Date.now();
  
  const poll = async () => {
    try {
      const channels = await getRunningChannels();
      for (const ch of channels) {
        const events = await getChannelEvents(ch.id, 1);
        events
          .filter(e => e.timestamp > lastTimestamp)
          .forEach(e => {
            callback({ ...e, channelId: ch.id });
            lastTimestamp = Math.max(lastTimestamp, e.timestamp);
          });
      }
    } catch (err) {
      console.error('Polling error:', err);
    }
  };

  const interval = setInterval(poll, 5000);
  poll();
  
  return () => clearInterval(interval);
}
