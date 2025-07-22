import React, { useRef, useState, useEffect } from 'react';
import { X, Split } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';

export interface VideoSegment {
  id: string;
  startTime: number;
  endTime: number;
  originalStart: number; // Original position in source video
  originalEnd: number;   // Original position in source video
}

interface VideoSegmentTimelineProps {
  segments: VideoSegment[];
  duration: number;
  currentTime: number;
  onSegmentsUpdate: (segments: VideoSegment[]) => void;
  onSegmentSplit: (segmentId: string, splitTime: number) => void;
  onSegmentDelete: (segmentId: string) => void;
}

export const VideoSegmentTimeline: React.FC<VideoSegmentTimelineProps> = ({
  segments,
  duration,
  currentTime,
  onSegmentsUpdate,
  onSegmentSplit,
  onSegmentDelete
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<{ type: 'start' | 'end' | 'move'; segmentId: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; segmentId: string; time: number } | null>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimeFromPosition = (x: number) => {
    if (!timelineRef.current) return 0;
    const rect = timelineRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    return percentage * duration;
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = e.clientX - rect.left;
    const time = getTimeFromPosition(x);
    
    // Find which segment this time falls into
    const segmentId = segments.find(s => time >= s.startTime && time <= s.endTime)?.id || segments[0]?.id;
    
    console.log('Right-click at time:', time, 'in segment:', segmentId);
    
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      segmentId,
      time
    });
  };

  const handleSplit = () => {
    if (contextMenu) {
      onSegmentSplit(contextMenu.segmentId, contextMenu.time);
      setContextMenu(null);
    }
  };

  const handleDelete = (segmentId: string) => {
    onSegmentDelete(segmentId);
    setContextMenu(null);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !timelineRef.current) return;

      const rect = timelineRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const time = getTimeFromPosition(x);
      
      const segment = segments.find(s => s.id === isDragging.segmentId);
      if (!segment) return;

      const minDuration = 0.1; // Minimum 0.1 second segment
      const updatedSegments = segments.map(s => {
        if (s.id !== isDragging.segmentId) return s;

        if (isDragging.type === 'start') {
          const maxStart = Math.min(s.endTime - minDuration, duration);
          const newStart = Math.max(0, Math.min(time, maxStart));
          return { ...s, startTime: newStart, originalStart: newStart };
        } else if (isDragging.type === 'end') {
          const minEnd = Math.max(s.startTime + minDuration, 0);
          const newEnd = Math.min(duration, Math.max(time, minEnd));
          return { ...s, endTime: newEnd, originalEnd: newEnd };
        } else if (isDragging.type === 'move') {
          const segmentDuration = s.endTime - s.startTime;
          const newStart = Math.max(0, Math.min(time - segmentDuration / 2, duration - segmentDuration));
          const newEnd = newStart + segmentDuration;
          return { 
            ...s, 
            startTime: newStart, 
            endTime: newEnd,
            originalStart: newStart,
            originalEnd: newEnd
          };
        }
        
        return s;
      });

      onSegmentsUpdate(updatedSegments);
    };

    const handleMouseUp = () => {
      setIsDragging(null);
    };

    const handleClickOutside = () => {
      setContextMenu(null);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    document.addEventListener('click', handleClickOutside);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isDragging, segments, duration, onSegmentsUpdate]);

  const handleMouseDown = (e: React.MouseEvent, type: 'start' | 'end' | 'move', segmentId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging({ type, segmentId });
  };

  // Sort segments by start time for proper rendering
  const sortedSegments = [...segments].sort((a, b) => a.startTime - b.startTime);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Video Segments</span>
        <span className="text-xs text-muted-foreground">
          {segments.length} segment{segments.length !== 1 ? 's' : ''}
        </span>
      </div>
      
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div 
            ref={timelineRef}
            className="relative w-full h-12 bg-muted rounded-lg cursor-pointer select-none"
            onContextMenu={handleContextMenu}
          >
            {/* Background track */}
            <div className="absolute inset-0 bg-muted-foreground/20 rounded-lg" />
            
            {/* Current time indicator */}
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-foreground z-30"
              style={{
                left: `${(currentTime / duration) * 100}%`,
              }}
            />
            
            {/* Render segments */}
            {sortedSegments.map((segment, index) => (
              <div key={segment.id}>
                {/* Segment range */}
                <div 
                  className="absolute top-0 bottom-0 bg-primary/30 border-t-2 border-b-2 border-primary cursor-move"
                  style={{
                    left: `${(segment.startTime / duration) * 100}%`,
                    width: `${((segment.endTime - segment.startTime) / duration) * 100}%`,
                  }}
                  onMouseDown={(e) => handleMouseDown(e, 'move', segment.id)}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-medium text-primary-foreground bg-primary/50 px-1 rounded">
                      {index + 1}
                    </span>
                  </div>
                </div>
                
                {/* Start handle */}
                <div 
                  className={cn(
                    "absolute top-0 bottom-0 w-3 bg-primary rounded-l-lg cursor-ew-resize z-20 hover:bg-primary/80 transition-colors",
                    isDragging?.segmentId === segment.id && isDragging.type === 'start' && "bg-primary/80"
                  )}
                  style={{
                    left: `${(segment.startTime / duration) * 100}%`,
                  }}
                  onMouseDown={(e) => handleMouseDown(e, 'start', segment.id)}
                >
                  <div className="absolute inset-y-0 left-1/2 w-px bg-primary-foreground transform -translate-x-0.5" />
                </div>
                
                {/* End handle */}
                <div 
                  className={cn(
                    "absolute top-0 bottom-0 w-3 bg-primary rounded-r-lg cursor-ew-resize z-20 hover:bg-primary/80 transition-colors",
                    isDragging?.segmentId === segment.id && isDragging.type === 'end' && "bg-primary/80"
                  )}
                  style={{
                    left: `${(segment.endTime / duration) * 100}%`,
                    transform: 'translateX(-100%)',
                  }}
                  onMouseDown={(e) => handleMouseDown(e, 'end', segment.id)}
                >
                  <div className="absolute inset-y-0 left-1/2 w-px bg-primary-foreground transform -translate-x-0.5" />
                </div>
                
                {/* Delete button */}
                {segments.length > 1 && (
                  <button
                    onClick={() => handleDelete(segment.id)}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/80 transition-colors z-30 text-xs"
                    style={{
                      left: `${(segment.endTime / duration) * 100}%`,
                      transform: 'translateX(-50%)',
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </ContextMenuTrigger>
        
        <ContextMenuContent>
          <ContextMenuItem onClick={handleSplit}>
            <Split className="h-4 w-4 mr-2" />
            Split at {contextMenu ? formatTime(contextMenu.time) : ''}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      
      {/* Segment details */}
      <div className="space-y-1">
        {sortedSegments.map((segment, index) => (
          <div key={segment.id} className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Segment {index + 1}:</span>
            <span>{formatTime(segment.startTime)} - {formatTime(segment.endTime)} ({formatTime(segment.endTime - segment.startTime)})</span>
          </div>
        ))}
      </div>
    </div>
  );
};