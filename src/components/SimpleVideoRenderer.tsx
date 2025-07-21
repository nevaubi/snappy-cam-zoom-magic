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

    // Handle video metadata loaded - using multiple events for better compatibility
    const handleLoadedMetadata = () => {
      console.log('SimpleVideoRenderer: handleLoadedMetadata called');
      if (videoRef.current) {
        const videoDuration = videoRef.current.duration;
        console.log('SimpleVideoRenderer: video duration:', videoDuration);
        console.log('SimpleVideoRenderer: video readyState:', videoRef.current.readyState);
        console.log('SimpleVideoRenderer: video src:', videoRef.current.src);
        
        // Validate duration - reject Infinity, NaN, or negative values
        if (isFinite(videoDuration) && videoDuration > 0) {
          console.log('SimpleVideoRenderer: Valid duration detected:', videoDuration);
          setDuration(videoDuration);
          onLoadedData();
        } else {
          console.warn('SimpleVideoRenderer: Invalid duration, trying fallback methods:', videoDuration);
          // Try alternative methods to get duration
          tryAlternativeDurationDetection();
        }
      } else {
        console.warn('SimpleVideoRenderer: videoRef.current is null');
      }
    };

    // Fallback method for duration detection
    const tryAlternativeDurationDetection = () => {
      console.log('SimpleVideoRenderer: Attempting alternative duration detection');
      if (videoRef.current) {
        // Wait a bit and try again - sometimes duration loads asynchronously
        setTimeout(() => {
          if (videoRef.current) {
            const retryDuration = videoRef.current.duration;
            console.log('SimpleVideoRenderer: Retry duration:', retryDuration);
            
            if (isFinite(retryDuration) && retryDuration > 0) {
              console.log('SimpleVideoRenderer: Duration detected on retry:', retryDuration);
              setDuration(retryDuration);
              onLoadedData();
            } else {
              console.error('SimpleVideoRenderer: Failed to get valid duration after retry');
              // Still call onLoadedData to show controls, even without duration
              onLoadedData();
            }
          }
        }, 500);
      }
    };

    // Handle when video can start playing
    const handleCanPlay = () => {
      console.log('SimpleVideoRenderer: handleCanPlay called');
      if (videoRef.current && duration === 0) {
        const videoDuration = videoRef.current.duration;
        console.log('SimpleVideoRenderer: canplay duration check:', videoDuration);
        
        if (isFinite(videoDuration) && videoDuration > 0) {
          console.log('SimpleVideoRenderer: Duration set from canplay event:', videoDuration);
          setDuration(videoDuration);
        }
      }
    };

    // Handle duration change events
    const handleDurationChange = () => {
      console.log('SimpleVideoRenderer: handleDurationChange called');
      if (videoRef.current) {
        const videoDuration = videoRef.current.duration;
        console.log('SimpleVideoRenderer: durationchange event duration:', videoDuration);
        
        if (isFinite(videoDuration) && videoDuration > 0) {
          console.log('SimpleVideoRenderer: Duration updated from durationchange:', videoDuration);
          setDuration(videoDuration);
        }
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
          onLoadedMetadata={handleLoadedMetadata}
          onCanPlay={handleCanPlay}
          onDurationChange={handleDurationChange}
          onTimeUpdate={handleTimeUpdate}
          onError={(e) => {
            console.error('SimpleVideoRenderer: Video error:', e);
            // Still call onLoadedData to show controls even with error
            onLoadedData();
          }}
          onLoadStart={() => console.log('SimpleVideoRenderer: Load start')}
          onProgress={() => console.log('SimpleVideoRenderer: Progress event')}
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