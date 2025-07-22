import React, { useRef, useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ZoomEffect {
  id: string;
  startTime: number;
  endTime: number;
  zoomAmount: number;
  zoomSpeed: number;
  targetX: number; // 0-7 (grid position)
  targetY: number; // 0-7 (grid position)
}

interface ZoomTimelineProps {
  zoomEffect: ZoomEffect;
  duration: number;
  onUpdate: (zoomEffect: ZoomEffect) => void;
  onDelete: (id: string) => void;
}

export const ZoomTimeline: React.FC<ZoomTimelineProps> = ({
  zoomEffect,
  duration,
  onUpdate,
  onDelete
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<'start' | 'end' | 'move' | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !timelineRef.current) return;

      const rect = timelineRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      const percentage = x / rect.width;
      const time = percentage * duration;

      const minDuration = 0.5; // Minimum 0.5 second zoom effect

      if (isDragging === 'start') {
        const newStart = Math.max(0, Math.min(time, zoomEffect.endTime - minDuration));
        onUpdate({ ...zoomEffect, startTime: newStart });
      } else if (isDragging === 'end') {
        const newEnd = Math.min(duration, Math.max(time, zoomEffect.startTime + minDuration));
        onUpdate({ ...zoomEffect, endTime: newEnd });
      } else if (isDragging === 'move') {
        const effectDuration = zoomEffect.endTime - zoomEffect.startTime;
        const newStart = Math.max(0, Math.min(time - effectDuration / 2, duration - effectDuration));
        const newEnd = newStart + effectDuration;
        onUpdate({ ...zoomEffect, startTime: newStart, endTime: newEnd });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(null);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, zoomEffect, duration, onUpdate]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleMouseDown = (e: React.MouseEvent, type: 'start' | 'end' | 'move') => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(type);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-accent rounded-full shadow-lg shadow-accent/30" />
          <span className="text-sm font-medium">
            Zoom {zoomEffect.zoomAmount}x
          </span>
          <span className="text-xs text-muted-foreground">
            ({formatTime(zoomEffect.startTime)} - {formatTime(zoomEffect.endTime)})
          </span>
        </div>
        <button
          onClick={() => onDelete(zoomEffect.id)}
          className="p-1 hover:bg-destructive/10 hover:text-destructive rounded transition-colors"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      
      <div 
        ref={timelineRef}
        className="relative w-full h-8 bg-muted/50 rounded cursor-pointer select-none shadow-inner"
      >
        {/* Background track */}
        <div className="absolute inset-0 bg-muted-foreground/10 rounded" />
        
        {/* Zoom effect range */}
        <div 
          className="absolute top-0 bottom-0 bg-accent/40 border-t-2 border-b-2 border-accent cursor-move shadow-lg shadow-accent/20"
          style={{
            left: `${(zoomEffect.startTime / duration) * 100}%`,
            width: `${((zoomEffect.endTime - zoomEffect.startTime) / duration) * 100}%`,
          }}
          onMouseDown={(e) => handleMouseDown(e, 'move')}
        />
        
        {/* Start handle */}
        <div 
          className={cn(
            "absolute top-0 bottom-0 w-2 bg-accent rounded-l cursor-ew-resize z-10 hover:bg-accent/80 transition-colors shadow-lg",
            isDragging === 'start' && "bg-accent/80 scale-110"
          )}
          style={{
            left: `${(zoomEffect.startTime / duration) * 100}%`,
          }}
          onMouseDown={(e) => handleMouseDown(e, 'start')}
        />
        
        {/* End handle */}
        <div 
          className={cn(
            "absolute top-0 bottom-0 w-2 bg-accent rounded-r cursor-ew-resize z-10 hover:bg-accent/80 transition-colors shadow-lg",
            isDragging === 'end' && "bg-accent/80 scale-110"
          )}
          style={{
            left: `${(zoomEffect.endTime / duration) * 100}%`,
            transform: 'translateX(-100%)',
          }}
          onMouseDown={(e) => handleMouseDown(e, 'end')}
        />
      </div>
    </div>
  );
};