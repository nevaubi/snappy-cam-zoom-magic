import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';

interface CustomVideoRendererProps {
  videoSrc: string;
  trimStart: number;
  trimEnd: number;
  currentTime: number;
  isPlaying: boolean;
  onTimeUpdate: (time: number) => void;
  onLoadedData: () => void;
  className?: string;
}

export interface CustomVideoRendererRef {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  getDuration: () => number;
}

export const CustomVideoRenderer = forwardRef<CustomVideoRendererRef, CustomVideoRendererProps>(
  ({ videoSrc, trimStart, trimEnd, currentTime, isPlaying, onTimeUpdate, onLoadedData, className }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const animationFrameRef = useRef<number>();
    const [duration, setDuration] = useState(0);

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
      play: () => {
        if (videoRef.current) {
          videoRef.current.play();
        }
      },
      pause: () => {
        if (videoRef.current) {
          videoRef.current.pause();
        }
      },
      seek: (time: number) => {
        if (videoRef.current) {
          // Ensure seeking within trim bounds
          const clampedTime = Math.max(trimStart, Math.min(trimEnd, time));
          videoRef.current.currentTime = clampedTime;
        }
      },
      getDuration: () => duration,
    }));

    // Initialize video element
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const handleLoadedData = () => {
        setDuration(video.duration);
        onLoadedData();
      };

      const handleTimeUpdate = () => {
        if (!video) return;
        
        const time = video.currentTime;
        
        // Enforce trim boundaries during playback
        if (time < trimStart || time > trimEnd) {
          if (time > trimEnd) {
            video.currentTime = trimStart;
          } else if (time < trimStart) {
            video.currentTime = trimStart;
          }
          return;
        }

        onTimeUpdate(time);
      };

      video.addEventListener('loadeddata', handleLoadedData);
      video.addEventListener('timeupdate', handleTimeUpdate);

      return () => {
        video.removeEventListener('loadeddata', handleLoadedData);
        video.removeEventListener('timeupdate', handleTimeUpdate);
      };
    }, [videoSrc, trimStart, trimEnd, onTimeUpdate, onLoadedData]);

    // Handle play/pause changes
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      if (isPlaying) {
        // Ensure we start within trim bounds
        if (video.currentTime < trimStart || video.currentTime > trimEnd) {
          video.currentTime = trimStart;
        }
        video.play();
      } else {
        video.pause();
      }
    }, [isPlaying, trimStart, trimEnd]);

    // Handle seeking from external sources
    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      const targetTime = Math.max(trimStart, Math.min(trimEnd, currentTime));
      if (Math.abs(video.currentTime - targetTime) > 0.1) {
        video.currentTime = targetTime;
      }
    }, [currentTime, trimStart, trimEnd]);

    // Canvas rendering loop
    useEffect(() => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const renderFrame = () => {
        if (video.readyState >= 2) {
          // Clear canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Only render if within trim bounds
          if (video.currentTime >= trimStart && video.currentTime <= trimEnd) {
            // Draw video frame
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Add trim indicators (subtle overlay)
            const totalDuration = duration || video.duration;
            const progress = (video.currentTime - trimStart) / (trimEnd - trimStart);
            
            // Progress bar at bottom
            ctx.fillStyle = 'rgba(59, 130, 246, 0.8)';
            ctx.fillRect(0, canvas.height - 4, canvas.width * progress, 4);
          }
        }

        if (isPlaying) {
          animationFrameRef.current = requestAnimationFrame(renderFrame);
        }
      };

      renderFrame();

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }, [isPlaying, trimStart, trimEnd, duration]);

    // Update canvas size when container changes
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const updateCanvasSize = () => {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        }
      };

      updateCanvasSize();
      window.addEventListener('resize', updateCanvasSize);

      return () => {
        window.removeEventListener('resize', updateCanvasSize);
      };
    }, []);

    return (
      <div className={`relative ${className || ''}`}>
        {/* Hidden video element for data source */}
        <video
          ref={videoRef}
          src={videoSrc}
          className="hidden"
          preload="metadata"
        />
        
        {/* Canvas for rendering trimmed video */}
        <canvas
          ref={canvasRef}
          className="w-full h-full bg-muted rounded-lg"
          style={{ aspectRatio: '16/9' }}
        />
        
        {/* Loading overlay */}
        {duration === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted rounded-lg">
            <div className="text-muted-foreground">Loading video...</div>
          </div>
        )}
      </div>
    );
  }
);

CustomVideoRenderer.displayName = 'CustomVideoRenderer';