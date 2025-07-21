import React, { forwardRef, useImperativeHandle, useRef, useEffect, useState } from 'react';

interface SimpleVideoRendererProps {
  videoSrc: string;
  trimStart: number;
  trimEnd: number;
  currentTime: number;
  isPlaying: boolean;
  onTimeUpdate: (time: number) => void;
  onLoadedData: () => void;
  className?: string;
}

export interface SimpleVideoRendererRef {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  getDuration: () => number;
}

export const SimpleVideoRenderer = forwardRef<SimpleVideoRendererRef, SimpleVideoRendererProps>(
  ({ videoSrc, trimStart, trimEnd, currentTime, isPlaying, onTimeUpdate, onLoadedData, className }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [duration, setDuration] = useState(0);

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
      play: () => {
        if (videoRef.current) {
          // Ensure we start within trim bounds
          if (videoRef.current.currentTime < trimStart) {
            videoRef.current.currentTime = trimStart;
          }
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
          // Clamp time within trim boundaries
          const clampedTime = Math.max(trimStart, Math.min(trimEnd, time));
          videoRef.current.currentTime = clampedTime;
        }
      },
      getDuration: () => duration,
    }));

    // Handle video metadata loaded
    const handleLoadedData = () => {
      if (videoRef.current) {
        const videoDuration = videoRef.current.duration;
        setDuration(videoDuration);
        onLoadedData();
      }
    };

    // Handle time updates with trim boundary enforcement
    const handleTimeUpdate = () => {
      if (videoRef.current) {
        const time = videoRef.current.currentTime;
        
        // Enforce trim boundaries during playback
        if (time < trimStart || time > trimEnd) {
          if (time > trimEnd) {
            videoRef.current.pause();
            videoRef.current.currentTime = trimStart;
          } else if (time < trimStart) {
            videoRef.current.currentTime = trimStart;
          }
        }
        
        onTimeUpdate(time);
      }
    };

    // Handle play/pause from props
    useEffect(() => {
      if (videoRef.current) {
        if (isPlaying) {
          // Ensure we're within trim bounds before playing
          if (videoRef.current.currentTime < trimStart || videoRef.current.currentTime > trimEnd) {
            videoRef.current.currentTime = trimStart;
          }
          videoRef.current.play();
        } else {
          videoRef.current.pause();
        }
      }
    }, [isPlaying, trimStart, trimEnd]);

    // Handle seeking from external sources
    useEffect(() => {
      if (videoRef.current && Math.abs(videoRef.current.currentTime - currentTime) > 0.5) {
        const clampedTime = Math.max(trimStart, Math.min(trimEnd, currentTime));
        videoRef.current.currentTime = clampedTime;
      }
    }, [currentTime, trimStart, trimEnd]);

    return (
      <div className={`relative bg-black rounded-lg overflow-hidden ${className}`}>
        <video
          ref={videoRef}
          src={videoSrc}
          className="w-full h-full object-contain"
          onLoadedData={handleLoadedData}
          onTimeUpdate={handleTimeUpdate}
          controls={false}
        />
        
        {/* Progress bar overlay */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
          <div 
            className="h-full bg-primary transition-all duration-100"
            style={{ 
              width: duration > 0 
                ? `${((currentTime - trimStart) / (trimEnd - trimStart)) * 100}%` 
                : '0%' 
            }}
          />
        </div>
      </div>
    );
  }
);

SimpleVideoRenderer.displayName = 'SimpleVideoRenderer';