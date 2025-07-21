import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CustomVideoPlayerProps {
  src: string;
  className?: string;
  onDurationLoad?: (duration: number) => void;
}

export const CustomVideoPlayer: React.FC<CustomVideoPlayerProps> = ({ 
  src, 
  className, 
  onDurationLoad 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateDuration = () => {
      const videoDuration = video.duration;
      
      // Validate duration before using it
      if (isNaN(videoDuration) || !isFinite(videoDuration) || videoDuration <= 0) {
        console.warn('Invalid video duration detected:', videoDuration);
        return;
      }
      
      console.log('Valid duration detected:', videoDuration);
      setDuration(videoDuration);
      if (onDurationLoad) {
        onDurationLoad(videoDuration);
      }
    };
    
    const handleEnded = () => setIsPlaying(false);

    // Listen to multiple events for better duration detection
    video.addEventListener('loadedmetadata', updateDuration);
    video.addEventListener('canplay', updateDuration);
    video.addEventListener('durationchange', updateDuration);
    video.addEventListener('ended', handleEnded);

    // Set preload to ensure metadata loads
    video.preload = 'metadata';

    return () => {
      video.removeEventListener('loadedmetadata', updateDuration);
      video.removeEventListener('canplay', updateDuration);
      video.removeEventListener('durationchange', updateDuration);
      video.removeEventListener('ended', handleEnded);
    };
  }, [onDurationLoad, src]);

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (isPlaying) {
        await video.pause();
        setIsPlaying(false);
      } else {
        await video.play();
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error toggling play:', error);
    }
  };

  const handlePlay = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      await video.play();
      setIsPlaying(true);
    } catch (error) {
      console.error('Error playing video:', error);
    }
  };

  const handlePause = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      await video.pause();
      setIsPlaying(false);
    } catch (error) {
      console.error('Error pausing video:', error);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Video Display */}
      <div className="relative bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          src={src}
          className="w-full h-auto max-h-96"
          onClick={togglePlay}
        />
      </div>
      
      {/* External Controls */}
      <div className="flex items-center gap-4">
        <Button
          onClick={handlePlay}
          disabled={isPlaying}
          variant="outline"
          size="sm"
        >
          <Play className="h-4 w-4 mr-2" />
          Play
        </Button>
        
        <Button
          onClick={handlePause}
          disabled={!isPlaying}
          variant="outline"
          size="sm"
        >
          <Pause className="h-4 w-4 mr-2" />
          Pause
        </Button>
        
        <span className="text-sm text-muted-foreground">
          {duration > 0 ? (
            `Duration: ${formatTime(duration)}`
          ) : (
            'Duration: Loading...'
          )}
        </span>
      </div>
    </div>
  );
};