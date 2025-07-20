import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Plus, Trash2, MousePointer2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ZoomEffect, createZoomEffect } from './ZoomEffect';

interface ProfessionalTimelineProps {
  videoUrl: string;
  duration: number;
  currentTime: number;
  trimStart: number;
  trimEnd: number;
  zoomEffects: ZoomEffect[];
  selectedZoomEffect: ZoomEffect | null;
  onCurrentTimeChange: (time: number) => void;
  onTrimChange: (start: number, end: number) => void;
  onPlayPause: () => void;
  onZoomEffectsChange: (effects: ZoomEffect[]) => void;
  onZoomEffectSelect: (effect: ZoomEffect | null) => void;
  isPlaying: boolean;
}

export const ProfessionalTimeline = ({
  videoUrl,
  duration,
  currentTime,
  trimStart,
  trimEnd,
  zoomEffects,
  selectedZoomEffect,
  onCurrentTimeChange,
  onTrimChange,
  onPlayPause,
  onZoomEffectsChange,
  onZoomEffectSelect,
  isPlaying
}: ProfessionalTimelineProps) => {
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTime, setDragStartTime] = useState(0);
  const timelineRef = useRef<HTMLDivElement>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const timeToPixel = (time: number) => {
    if (!timelineRef.current || duration === 0) return 0;
    return (time / duration) * timelineRef.current.offsetWidth;
  };

  const pixelToTime = (pixel: number) => {
    if (!timelineRef.current || duration === 0) return 0;
    return (pixel / timelineRef.current.offsetWidth) * duration;
  };

  const handleTimelineClick = (event: React.MouseEvent) => {
    if (!timelineRef.current || isDragging) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const newTime = pixelToTime(x);
    
    onCurrentTimeChange(Math.max(0, Math.min(duration, newTime)));
  };

  const handleTimelineDoubleClick = (event: React.MouseEvent) => {
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const clickTime = pixelToTime(x);
    
    // Create new zoom effect at clicked position
    const effectDuration = 3; // Default 3 second zoom effect
    const startTime = Math.max(0, clickTime - effectDuration / 2);
    const endTime = Math.min(duration, clickTime + effectDuration / 2);
    
    const newEffect = createZoomEffect(startTime, endTime);
    onZoomEffectsChange([...zoomEffects, newEffect]);
    onZoomEffectSelect(newEffect);
  };

  const handleZoomEffectMouseDown = (event: React.MouseEvent, effect: ZoomEffect, handle?: 'start' | 'end') => {
    event.stopPropagation();
    setIsDragging(handle ? `${effect.id}-${handle}` : effect.id);
    setDragStartX(event.clientX);
    setDragStartTime(handle === 'end' ? effect.endTime : effect.startTime);
    onZoomEffectSelect(effect);
  };

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isDragging || !timelineRef.current) return;

    const deltaX = event.clientX - dragStartX;
    const deltaTime = pixelToTime(deltaX);

    if (isDragging.includes('-start')) {
      const effectId = isDragging.split('-')[0];
      const effect = zoomEffects.find(e => e.id === effectId);
      if (effect) {
        const newStartTime = Math.max(0, Math.min(effect.endTime - 0.5, dragStartTime + deltaTime));
        const updatedEffects = zoomEffects.map(e =>
          e.id === effectId ? { ...e, startTime: newStartTime } : e
        );
        onZoomEffectsChange(updatedEffects);
      }
    } else if (isDragging.includes('-end')) {
      const effectId = isDragging.split('-')[0];
      const effect = zoomEffects.find(e => e.id === effectId);
      if (effect) {
        const newEndTime = Math.max(effect.startTime + 0.5, Math.min(duration, dragStartTime + deltaTime));
        const updatedEffects = zoomEffects.map(e =>
          e.id === effectId ? { ...e, endTime: newEndTime } : e
        );
        onZoomEffectsChange(updatedEffects);
      }
    } else {
      // Moving entire effect
      const effect = zoomEffects.find(e => e.id === isDragging);
      if (effect) {
        const effectDuration = effect.endTime - effect.startTime;
        const newStartTime = Math.max(0, Math.min(duration - effectDuration, dragStartTime + deltaTime));
        const newEndTime = newStartTime + effectDuration;
        
        const updatedEffects = zoomEffects.map(e =>
          e.id === isDragging
            ? { ...e, startTime: newStartTime, endTime: newEndTime }
            : e
        );
        onZoomEffectsChange(updatedEffects);
      }
    }
  }, [isDragging, dragStartX, dragStartTime, zoomEffects, onZoomEffectsChange, duration, pixelToTime]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const deleteZoomEffect = (effectId: string) => {
    const updatedEffects = zoomEffects.filter(e => e.id !== effectId);
    onZoomEffectsChange(updatedEffects);
    if (selectedZoomEffect?.id === effectId) {
      onZoomEffectSelect(null);
    }
  };

  const currentPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;
  const trimStartPercentage = (trimStart / duration) * 100;
  const trimEndPercentage = (trimEnd / duration) * 100;

  return (
    <div className="bg-controls rounded-lg p-6 space-y-6">
      {/* Controls Header */}
      <div className="flex items-center justify-between">
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

        <div className="flex items-center gap-2 text-sm text-controls-foreground/60">
          <MousePointer2 className="w-4 h-4" />
          Double-click to add zoom effect
        </div>
      </div>

      {/* Main Timeline */}
      <div className="space-y-4">
        {/* Video Track */}
        <div className="space-y-2">
          <label className="text-sm text-controls-foreground/70">Video Track</label>
          <div 
            ref={timelineRef}
            className="relative h-12 bg-muted rounded cursor-pointer select-none"
            onClick={handleTimelineClick}
            onDoubleClick={handleTimelineDoubleClick}
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
              className="absolute top-0 bottom-0 w-0.5 bg-accent-glow z-20"
              style={{ left: `${currentPercentage}%` }}
            />
          </div>
        </div>

        {/* Zoom Effects Track */}
        <div className="space-y-2">
          <label className="text-sm text-controls-foreground/70">Zoom Effects</label>
          <div className="relative h-16 bg-muted/50 rounded border-2 border-dashed border-muted-foreground/20">
            {zoomEffects.map((effect) => {
              const startPercentage = (effect.startTime / duration) * 100;
              const widthPercentage = ((effect.endTime - effect.startTime) / duration) * 100;
              const isSelected = selectedZoomEffect?.id === effect.id;

              return (
                <div
                  key={effect.id}
                  className={`absolute top-1 bottom-1 bg-red-500/80 rounded cursor-move select-none transition-all ${
                    isSelected ? 'ring-2 ring-red-400 bg-red-500' : 'hover:bg-red-500'
                  }`}
                  style={{
                    left: `${startPercentage}%`,
                    width: `${widthPercentage}%`,
                    minWidth: '20px'
                  }}
                  onMouseDown={(e) => handleZoomEffectMouseDown(e, effect)}
                >
                  {/* Start resize handle */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-2 bg-red-400 cursor-ew-resize hover:bg-red-300"
                    onMouseDown={(e) => handleZoomEffectMouseDown(e, effect, 'start')}
                  />
                  
                  {/* Effect content */}
                  <div className="flex items-center justify-between h-full px-2 text-white text-xs font-medium">
                    <span className="truncate">{effect.zoomLevel.toFixed(1)}x</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-4 w-4 p-0 text-white hover:text-red-200 hover:bg-red-600/50"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteZoomEffect(effect.id);
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  
                  {/* End resize handle */}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-2 bg-red-400 cursor-ew-resize hover:bg-red-300"
                    onMouseDown={(e) => handleZoomEffectMouseDown(e, effect, 'end')}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Time markers */}
      <div className="relative h-6">
        {Array.from({ length: 11 }, (_, i) => {
          const time = (duration * i) / 10;
          const percentage = (i * 10);
          return (
            <div
              key={i}
              className="absolute text-xs text-controls-foreground/50 font-mono"
              style={{ left: `${percentage}%`, transform: 'translateX(-50%)' }}
            >
              {formatTime(time)}
            </div>
          );
        })}
      </div>
    </div>
  );
};