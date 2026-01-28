import { createContext, useContext, useState, ReactNode } from 'react';
import type { SportEvent, MediaLiveChannel } from '@/app/types/events';

interface ShortsItem {
  event: SportEvent;
  channel: MediaLiveChannel;
  addedAt: number;
}

interface ShortsContextType {
  queue: ShortsItem[];
  addToQueue: (event: SportEvent, channel: MediaLiveChannel) => void;
  removeFromQueue: (eventId: string) => void;
  clearQueue: () => void;
}

const ShortsContext = createContext<ShortsContextType | null>(null);

export function ShortsProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<ShortsItem[]>([]);

  const addToQueue = (event: SportEvent, channel: MediaLiveChannel) => {
    setQueue(prev => {
      if (prev.some(item => item.event.id === event.id)) return prev;
      return [...prev, { event, channel, addedAt: Date.now() }];
    });
  };

  const removeFromQueue = (eventId: string) => {
    setQueue(prev => prev.filter(item => item.event.id !== eventId));
  };

  const clearQueue = () => setQueue([]);

  return (
    <ShortsContext.Provider value={{ queue, addToQueue, removeFromQueue, clearQueue }}>
      {children}
    </ShortsContext.Provider>
  );
}

export function useShorts() {
  const ctx = useContext(ShortsContext);
  if (!ctx) throw new Error('useShorts must be used within ShortsProvider');
  return ctx;
}
