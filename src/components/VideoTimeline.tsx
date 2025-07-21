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
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
        <span>0:00</span>
        <span>{formatTime(duration)}</span>
      </div>
      
      <div 
        ref={timelineRef}
        className="relative h-12 bg-muted rounded-lg cursor-pointer select-none"
        onClick={handleTimelineClick}
        onContextMenu={handleRightClick}
      >
        {/* Full timeline background */}
        <div className="absolute inset-0 bg-muted-foreground/20 rounded-lg" />
        
        {/* Trimmed section */}
        <div 
          className="absolute top-0 bottom-0 bg-primary/30 rounded-lg"
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
          className="absolute top-1 bottom-1 w-3 bg-primary rounded cursor-ew-resize z-20 hover:bg-primary/80"
          style={{ left: `${startPercentage}%` }}
          onMouseDown={(e) => {
            e.stopPropagation();
            setIsDraggingStart(true);
          }}
        />
        
        {/* End trim handle */}
        <div
          className="absolute top-1 bottom-1 w-3 bg-primary rounded cursor-ew-resize z-20 hover:bg-primary/80"
          style={{ left: `${endPercentage - 3}%` }}
          onMouseDown={(e) => {
            e.stopPropagation();
            setIsDraggingEnd(true);
          }}
        />
        
        {/* Current time cursor */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-foreground z-30 cursor-ew-resize"
          style={{ left: `${currentPercentage}%` }}
          onMouseDown={(e) => {
            e.stopPropagation();
            setIsDraggingCursor(true);
          }}
        />
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