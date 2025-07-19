import { useState, useEffect, useRef } from 'react';
import { Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface VideoTimelineProps {
  videoUrl: string;
  duration: number;
  currentTime: number;
  trimStart: number;
  trimEnd: number;
  onCurrentTimeChange: (time: number) => void;
  onTrimChange: (start: number, end: number) => void;
  onPlayPause: () => void;
  isPlaying: boolean;
}

export const VideoTimeline = ({
  videoUrl,
  duration,
  currentTime,
  trimStart,
  trimEnd,
  onCurrentTimeChange,
  onTrimChange,
  onPlayPause,
  isPlaying
}: VideoTimelineProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTimelineClick = (event: React.MouseEvent) => {
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;
    
    onCurrentTimeChange(Math.max(0, Math.min(duration, newTime)));
  };

  const currentPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;
  const trimStartPercentage = (trimStart / duration) * 100;
  const trimEndPercentage = (trimEnd / duration) * 100;

  return (
    <div className="bg-controls rounded-lg p-4 space-y-4">
      <div className="flex items-center gap-4">
        <Button
          onClick={onPlayPause}
          size="sm"
          className="bg-accent-glow hover:bg-accent-glow/90"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </Button>
        
        <span className="text-sm text-controls-foreground font-mono">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      {/* Timeline */}
      <div 
        ref={timelineRef}
        className="relative h-12 bg-muted rounded cursor-pointer"
        onClick={handleTimelineClick}
      >
        {/* Timeline track */}
        <div className="absolute inset-0 bg-gradient-to-r from-muted to-muted-foreground/20 rounded" />
        
        {/* Trim area */}
        <div 
          className="absolute top-0 bottom-0 bg-accent-glow/30 border-l-2 border-r-2 border-accent-glow"
          style={{
            left: `${trimStartPercentage}%`,
            width: `${trimEndPercentage - trimStartPercentage}%`
          }}
        />
        
        {/* Current time indicator */}
        <div 
          className="absolute top-0 bottom-0 w-0.5 bg-accent-glow"
          style={{ left: `${currentPercentage}%` }}
        />
        
        {/* Trim handles */}
        <div 
          className="absolute top-0 bottom-0 w-2 bg-accent-glow cursor-ew-resize hover:bg-accent-glow/80"
          style={{ left: `${trimStartPercentage}%` }}
          onMouseDown={() => setIsDragging(true)}
        />
        <div 
          className="absolute top-0 bottom-0 w-2 bg-accent-glow cursor-ew-resize hover:bg-accent-glow/80"
          style={{ left: `${trimEndPercentage}%` }}
          onMouseDown={() => setIsDragging(true)}
        />
      </div>

      {/* Trim controls */}
      <div className="space-y-3">
        <div>
          <label className="text-sm text-controls-foreground/70 mb-2 block">
            Trim Start: {formatTime(trimStart)}
          </label>
          <Slider
            value={[trimStart]}
            onValueChange={([value]) => onTrimChange(value, trimEnd)}
            max={duration}
            min={0}
            step={0.1}
            className="w-full"
          />
        </div>
        
        <div>
          <label className="text-sm text-controls-foreground/70 mb-2 block">
            Trim End: {formatTime(trimEnd)}
          </label>
          <Slider
            value={[trimEnd]}
            onValueChange={([value]) => onTrimChange(trimStart, value)}
            max={duration}
            min={trimStart}
            step={0.1}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
};