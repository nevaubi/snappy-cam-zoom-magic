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
  const [isDraggingStart, setIsDraggingStart] = useState(false);
  const [isDraggingEnd, setIsDraggingEnd] = useState(false);
  const [isDraggingCursor, setIsDraggingCursor] = useState(false);
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
    if (isDraggingStart || isDraggingEnd || isDraggingCursor) return;
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
      
      if (isDraggingStart) {
        onTrimChange(Math.min(time, trimEnd - 0.1), trimEnd);
      } else if (isDraggingEnd) {
        onTrimChange(trimStart, Math.max(time, trimStart + 0.1));
      } else if (isDraggingCursor) {
        onSeek(time);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingStart(false);
      setIsDraggingEnd(false);
      setIsDraggingCursor(false);
    };

    const handleClickOutside = () => {
      setShowContextMenu(false);
    };

    if (isDraggingStart || isDraggingEnd || isDraggingCursor) {
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
  }, [isDraggingStart, isDraggingEnd, isDraggingCursor, showContextMenu, trimStart, trimEnd, duration, onTrimChange, onSeek]);

  if (duration === 0) return null;

  const startPercentage = (trimStart / duration) * 100;
  const endPercentage = (trimEnd / duration) * 100;
  const currentPercentage = (currentTime / duration) * 100;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>0s</span>
        <span>{formatTime(duration)}</span>
      </div>
      
      <div 
        ref={timelineRef}
        className="relative h-16 bg-muted rounded-lg cursor-pointer select-none transition-all duration-200 hover:bg-muted/80"
        onClick={handleTimelineClick}
        onContextMenu={handleRightClick}
      >
        {/* Full timeline background */}
        <div className="absolute inset-0 bg-muted-foreground/20 rounded-lg" />
        
        {/* Trimmed section */}
        <div 
          className="absolute top-0 bottom-0 bg-primary/40 rounded-lg border-2 border-primary/60 transition-colors duration-200"
          style={{
            left: `${startPercentage}%`,
            width: `${endPercentage - startPercentage}%`
          }}
        />
        
        {/* Split points */}
        {splitPoints.map((splitTime, index) => (
          <div
            key={index}
            className="absolute top-0 bottom-0 w-0.5 bg-destructive z-10"
            style={{ left: `${(splitTime / duration) * 100}%` }}
          />
        ))}
        
        {/* Start trim handle */}
        <div
          className={`absolute top-0 bottom-0 w-3 bg-primary rounded-l-lg cursor-ew-resize z-20 transition-all duration-200 hover:w-4 hover:bg-primary/90 ${
            isDraggingStart ? 'w-4 bg-primary/90 shadow-lg' : ''
          }`}
          style={{ left: `${startPercentage}%` }}
          onMouseDown={(e) => {
            e.stopPropagation();
            setIsDraggingStart(true);
          }}
        >
          <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1 h-6 bg-primary-foreground rounded-full opacity-60" />
        </div>
        
        {/* End trim handle */}
        <div
          className={`absolute top-0 bottom-0 w-3 bg-primary rounded-r-lg cursor-ew-resize z-20 transition-all duration-200 hover:w-4 hover:bg-primary/90 ${
            isDraggingEnd ? 'w-4 bg-primary/90 shadow-lg' : ''
          }`}
          style={{ left: `${endPercentage}%`, transform: 'translateX(-100%)' }}
          onMouseDown={(e) => {
            e.stopPropagation();
            setIsDraggingEnd(true);
          }}
        >
          <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1 h-6 bg-primary-foreground rounded-full opacity-60" />
        </div>
        
        {/* Current time cursor */}
        <div
          className={`absolute top-0 bottom-0 w-1 bg-accent-foreground rounded-full cursor-ew-resize z-30 transition-all duration-200 hover:w-1.5 hover:bg-accent-foreground/90 ${
            isDraggingCursor ? 'w-1.5 bg-accent-foreground/90 shadow-lg' : ''
          }`}
          style={{ left: `${currentPercentage}%`, transform: 'translateX(-50%)' }}
          onMouseDown={(e) => {
            e.stopPropagation();
            setIsDraggingCursor(true);
          }}
        >
          <div className="absolute top-0 w-3 h-3 bg-accent-foreground rounded-full transform -translate-x-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* Time indicators */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Trim: {formatTime(trimStart)} - {formatTime(trimEnd)}</span>
        <span>Current: {formatTime(currentTime)}</span>
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
            Split here ({formatTime(contextMenuTime)})
          </Button>
        </div>
      )}
    </div>
  );
};