import { useEffect, useRef } from 'react';
import { Play } from 'lucide-react';

interface VideoPlayerProps {
  hlsUrl: string;
  channelName: string;
  autoplay?: boolean;
  startTime?: number;
  duration?: number;
}

export function VideoPlayer({ hlsUrl, channelName, autoplay = true, startTime, duration }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const initPlayer = async () => {
      if (typeof window !== 'undefined' && 'Hls' in window) {
        const Hls = (window as any).Hls;
        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
          });
          hls.loadSource(hlsUrl);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (startTime) {
              video.currentTime = startTime;
            }
            if (autoplay) {
              video.play().catch(() => {});
            }
          });
          return () => hls.destroy();
        }
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = hlsUrl;
        if (startTime) {
          video.currentTime = startTime;
        }
        if (autoplay) {
          video.play().catch(() => {});
        }
      }
    };

    initPlayer();

    return () => {
      if (video) {
        video.pause();
        video.src = '';
      }
    };
  }, [hlsUrl, autoplay, startTime]);

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden group">
      <video
        ref={videoRef}
        className="w-full h-full"
        controls
        playsInline
        preload="auto"
      />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="bg-black/50 backdrop-blur-sm px-4 py-2 rounded-lg">
          <Play className="w-8 h-8 text-white" />
        </div>
      </div>
    </div>
  );
}
