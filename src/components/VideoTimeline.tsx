import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Scissors } from 'lucide-react';

interface VideoTimelineProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
  onTrimChange: (start: number, end: number) => void;
  onSplit: (time: number) => void;
  trimStart: number;
  trimEnd: number;
  splitPoints: number[];
}

export const VideoTimeline: React.FC<VideoTimelineProps> = ({
  videoRef,
  duration,
  currentTime,
  onSeek,
  onTrimChange,
  onSplit,
  trimStart,
  trimEnd,
  splitPoints
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<'start' | 'end' | 'cursor' | null>(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [contextMenuTime, setContextMenuTime] = useState(0);

  const getTimeFromPosition = (clientX: number): number => {
    if (!timelineRef.current) return 0;
    const rect = timelineRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return percentage * duration;
  };

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (isDragging) return;
    const time = getTimeFromPosition(e.clientX);
    onSeek(time);
  };

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const time = getTimeFromPosition(e.clientX);
    setContextMenuTime(time);
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  const handleSplit = () => {
    onSplit(contextMenuTime);
    setShowContextMenu(false);
  };

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const milliseconds = Math.floor((time % 1) * 10);
    return minutes > 0 ? `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds}` : `${seconds}.${milliseconds}s`;
  };

  // Handle mouse events for dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const time = getTimeFromPosition(e.clientX);
      
      if (isDragging === 'start') {
        onTrimChange(Math.min(time, trimEnd - 0.1), trimEnd);
      } else if (isDragging === 'end') {
        onTrimChange(trimStart, Math.max(time, trimStart + 0.1));
      } else if (isDragging === 'cursor') {
        onSeek(time);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(null);
    };

    const handleClickOutside = () => {
      setShowContextMenu(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    if (showContextMenu) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isDragging, showContextMenu, trimStart, trimEnd, duration, onTrimChange, onSeek]);

  if (duration === 0) return null;

  const startPercentage = (trimStart / duration) * 100;
  const endPercentage = (trimEnd / duration) * 100;
  const currentPercentage = (currentTime / duration) * 100;

  return (
    <div className="w-full space-y-4">
      {/* Full width timeline */}
      <div 
        ref={timelineRef}
        className="relative h-20 bg-secondary rounded-lg cursor-pointer select-none transition-all duration-200 hover:bg-secondary/80"
        onClick={handleTimelineClick}
        onContextMenu={handleRightClick}
      >
        {/* Background progress */}
        <div className="absolute inset-2 bg-muted rounded-md overflow-hidden">
          {/* Trimmed section */}
          <div
            className="absolute top-0 h-full bg-gradient-to-r from-primary/20 to-primary/30 border-l-2 border-r-2 border-primary transition-all duration-200"
            style={{
              left: `${(trimStart / duration) * 100}%`,
              width: `${((trimEnd - trimStart) / duration) * 100}%`,
            }}
          />

          {/* Current time cursor */}
          <div
            className="absolute top-0 w-1 h-full bg-accent z-30 transition-all duration-100 shadow-sm rounded-full"
            style={{
              left: `${(currentTime / duration) * 100}%`,
            }}
          />

          {/* Split points */}
          {splitPoints.map((point, index) => (
            <div
              key={index}
              className="absolute top-0 w-0.5 h-full bg-destructive z-20 shadow-sm"
              style={{
                left: `${(point / duration) * 100}%`,
              }}
            />
          ))}
        </div>

        {/* Trim Start Handle */}
        <div
          className={`absolute top-1 w-5 h-16 bg-primary rounded-l-md cursor-ew-resize z-40 border border-primary-foreground/20 shadow-md hover:bg-primary/90 hover:scale-105 transition-all duration-150 ${
            isDragging === 'start' ? 'bg-primary/80 scale-105 shadow-lg' : ''
          }`}
          style={{
            left: `calc(${(trimStart / duration) * 100}% + 8px - 10px)`,
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            setIsDragging('start');
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-0.5 h-10 bg-primary-foreground/80 rounded-full" />
          </div>
        </div>

        {/* Trim End Handle */}
        <div
          className={`absolute top-1 w-5 h-16 bg-primary rounded-r-md cursor-ew-resize z-40 border border-primary-foreground/20 shadow-md hover:bg-primary/90 hover:scale-105 transition-all duration-150 ${
            isDragging === 'end' ? 'bg-primary/80 scale-105 shadow-lg' : ''
          }`}
          style={{
            left: `calc(${(trimEnd / duration) * 100}% + 8px - 10px)`,
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            setIsDragging('end');
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-0.5 h-10 bg-primary-foreground/80 rounded-full" />
          </div>
        </div>
      </div>

      {/* Time labels - simplified */}
      <div className="flex justify-between text-sm text-muted-foreground font-mono">
        <span>0</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Context menu */}
      {showContextMenu && (
        <div
          className="fixed bg-background border rounded-lg shadow-lg z-50 p-1"
          style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSplit}
            className="flex items-center gap-2 w-full justify-start"
          >
            <Scissors className="w-3 h-3" />
            Split at {formatTime(contextMenuTime)}
          </Button>
        </div>
      )}
    </div>
  );
};