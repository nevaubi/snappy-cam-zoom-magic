import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, RotateCcw, Palette, Maximize, CornerDownLeft, Crop, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CustomVideoPlayerProps {
  src: string;
  className?: string;
  onDurationLoad?: (duration: number) => void;
}

interface CropSettings {
  x: number; // percentage from left
  y: number; // percentage from top
  width: number; // percentage of video width
  height: number; // percentage of video height
}

export const CustomVideoPlayer: React.FC<CustomVideoPlayerProps> = ({ 
  src, 
  className, 
  onDurationLoad 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trimmerRef = useRef<HTMLDivElement>(null);
  const cropOverlayRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [isDragging, setIsDragging] = useState<'start' | 'end' | 'scrub' | null>(null);
  
  // Video display styling states
  const [videoPadding, setVideoPadding] = useState(0);
  const [videoCornerRadius, setVideoCornerRadius] = useState(8);
  const [backgroundColor, setBackgroundColor] = useState('#000000');
  
  // Crop states
  const [isCropMode, setIsCropMode] = useState(false);
  const [cropSettings, setCropSettings] = useState<CropSettings>({
    x: 0,
    y: 0,
    width: 100,
    height: 100
  });
  const [isDraggingCrop, setIsDraggingCrop] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cropStart, setCropStart] = useState<CropSettings>({ x: 0, y: 0, width: 100, height: 100 });
  
  // Background color presets
  const colorPresets = [
    { name: 'Black', value: '#000000' },
    { name: 'White', value: '#ffffff' },
    { name: 'Gray', value: '#6b7280' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Green', value: '#10b981' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Purple', value: '#8b5cf6' },
  ];
  
  // Use refs to store current values for stable callbacks
  const trimStartRef = useRef(0);
  const trimEndRef = useRef(0);
  const durationRef = useRef(0);
  const hasInitializedTrim = useRef(false);
  
  // Update refs when state changes
  useEffect(() => {
    trimStartRef.current = trimStart;
    trimEndRef.current = trimEnd;
    durationRef.current = duration;
  }, [trimStart, trimEnd, duration]);

  // Reset trim initialization when src changes
  useEffect(() => {
    hasInitializedTrim.current = false;
    console.log('Src changed, reset trim initialization');
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateDuration = () => {
      const videoDuration = video.duration;
      
      if (isNaN(videoDuration) || !isFinite(videoDuration) || videoDuration <= 0) {
        console.warn('Invalid video duration detected:', videoDuration);
        return;
      }
      
      console.log('Valid duration detected:', videoDuration, 'Has initialized trim:', hasInitializedTrim.current);
      setDuration(videoDuration);
      
      if (!hasInitializedTrim.current) {
        console.log('Setting initial trim values:', 0, 'to', videoDuration);
        setTrimStart(0);
        setTrimEnd(videoDuration);
        hasInitializedTrim.current = true;
      }
      
      if (onDurationLoad) {
        onDurationLoad(videoDuration);
      }
    };
    
    const handleEnded = () => setIsPlaying(false);
    const handleTimeUpdate = () => {
      const currentTime = video.currentTime;
      setCurrentTime(currentTime);
      
      if (trimEndRef.current > 0 && currentTime >= trimEndRef.current) {
        video.pause();
        setIsPlaying(false);
      }
    };

    video.addEventListener('loadedmetadata', updateDuration);
    video.addEventListener('canplay', updateDuration);
    video.addEventListener('durationchange', updateDuration);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.preload = 'metadata';

    return () => {
      video.removeEventListener('loadedmetadata', updateDuration);
      video.removeEventListener('canplay', updateDuration);
      video.removeEventListener('durationchange', updateDuration);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('timeupdate', handleTimeUpdate);
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
        if (video.currentTime < trimStart || video.currentTime >= trimEnd) {
          video.currentTime = trimStart;
          setCurrentTime(trimStart);
        }
        
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
      if (video.currentTime < trimStart || video.currentTime >= trimEnd) {
        video.currentTime = trimStart;
        setCurrentTime(trimStart);
      }
      
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

  const handleSeek = (value: number[]) => {
    const video = videoRef.current;
    if (!video || !duration || trimEnd <= trimStart) return;

    const trimDuration = trimEnd - trimStart;
    const seekTime = trimStart + (value[0] / 100) * trimDuration;
    
    video.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const totalSeconds = time % 60;
    const wholeSeconds = Math.floor(totalSeconds);
    const tenths = Math.floor((totalSeconds - wholeSeconds) * 10);
    return `${minutes}:${wholeSeconds.toString().padStart(2, '0')}${tenths}`;
  };

  const handleTrimMouseDown = (e: React.MouseEvent, type: 'start' | 'end' | 'scrub') => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(type);
  };

  const handleTrimMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !trimmerRef.current || !durationRef.current) return;

    const rect = trimmerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const time = percentage * durationRef.current;
    const video = videoRef.current;

    console.log('Mouse move:', isDragging, 'time:', time, 'percentage:', percentage);

    if (isDragging === 'start') {
      const newTrimStart = Math.max(0, Math.min(time, trimEndRef.current - 0.5));
      console.log('Setting trimStart to:', newTrimStart);
      setTrimStart(newTrimStart);
      if (video) {
        video.currentTime = newTrimStart;
        setCurrentTime(newTrimStart);
      }
    } else if (isDragging === 'end') {
      const newTrimEnd = Math.min(durationRef.current, Math.max(time, trimStartRef.current + 0.5));
      console.log('Setting trimEnd to:', newTrimEnd);
      setTrimEnd(newTrimEnd);
      if (video) {
        video.currentTime = newTrimEnd;
        setCurrentTime(newTrimEnd);
      }
    } else if (isDragging === 'scrub') {
      const clampedTime = Math.max(trimStartRef.current, Math.min(trimEndRef.current, time));
      if (video) {
        video.currentTime = clampedTime;
        setCurrentTime(clampedTime);
      }
    }
  }, [isDragging]);

  const handleTrimMouseUp = useCallback(() => {
    setIsDragging(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleTrimMouseMove);
      document.addEventListener('mouseup', handleTrimMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleTrimMouseMove);
      document.removeEventListener('mouseup', handleTrimMouseUp);
    };
  }, [isDragging, handleTrimMouseMove, handleTrimMouseUp]);

  const resetTrim = () => {
    console.log('Resetting trim to full duration:', duration);
    setTrimStart(0);
    setTrimEnd(duration);
  };

  const getTrimmedDuration = () => trimEnd - trimStart;

  const toggleCropMode = () => {
    setIsCropMode(!isCropMode);
    if (!isCropMode) {
      setCropSettings({ x: 0, y: 0, width: 100, height: 100 });
    }
  };

  const handleCropMouseDown = (e: React.MouseEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = cropOverlayRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    setIsDraggingCrop(handle);
    setDragStart({ x: e.clientX, y: e.clientY });
    setCropStart({ ...cropSettings });
  };

  const handleCropMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingCrop || !cropOverlayRef.current) return;
    
    const rect = cropOverlayRef.current.getBoundingClientRect();
    const deltaX = ((e.clientX - dragStart.x) / rect.width) * 100;
    const deltaY = ((e.clientY - dragStart.y) / rect.height) * 100;
    
    let newCrop = { ...cropStart };
    
    switch (isDraggingCrop) {
      case 'move':
        newCrop.x = Math.max(0, Math.min(100 - newCrop.width, cropStart.x + deltaX));
        newCrop.y = Math.max(0, Math.min(100 - newCrop.height, cropStart.y + deltaY));
        break;
      case 'nw':
        newCrop.x = Math.max(0, Math.min(cropStart.x + cropStart.width - 10, cropStart.x + deltaX));
        newCrop.y = Math.max(0, Math.min(cropStart.y + cropStart.height - 10, cropStart.y + deltaY));
        newCrop.width = cropStart.width - (newCrop.x - cropStart.x);
        newCrop.height = cropStart.height - (newCrop.y - cropStart.y);
        break;
      case 'ne':
        newCrop.y = Math.max(0, Math.min(cropStart.y + cropStart.height - 10, cropStart.y + deltaY));
        newCrop.width = Math.max(10, Math.min(100 - cropStart.x, cropStart.width + deltaX));
        newCrop.height = cropStart.height - (newCrop.y - cropStart.y);
        break;
      case 'sw':
        newCrop.x = Math.max(0, Math.min(cropStart.x + cropStart.width - 10, cropStart.x + deltaX));
        newCrop.width = cropStart.width - (newCrop.x - cropStart.x);
        newCrop.height = Math.max(10, Math.min(100 - cropStart.y, cropStart.height + deltaY));
        break;
      case 'se':
        newCrop.width = Math.max(10, Math.min(100 - cropStart.x, cropStart.width + deltaX));
        newCrop.height = Math.max(10, Math.min(100 - cropStart.y, cropStart.height + deltaY));
        break;
      case 'n':
        newCrop.y = Math.max(0, Math.min(cropStart.y + cropStart.height - 10, cropStart.y + deltaY));
        newCrop.height = cropStart.height - (newCrop.y - cropStart.y);
        break;
      case 's':
        newCrop.height = Math.max(10, Math.min(100 - cropStart.y, cropStart.height + deltaY));
        break;
      case 'w':
        newCrop.x = Math.max(0, Math.min(cropStart.x + cropStart.width - 10, cropStart.x + deltaX));
        newCrop.width = cropStart.width - (newCrop.x - cropStart.x);
        break;
      case 'e':
        newCrop.width = Math.max(10, Math.min(100 - cropStart.x, cropStart.width + deltaX));
        break;
    }
    
    setCropSettings(newCrop);
  }, [isDraggingCrop, dragStart, cropStart]);

  const handleCropMouseUp = useCallback(() => {
    setIsDraggingCrop(null);
  }, []);

  useEffect(() => {
    if (isDraggingCrop) {
      document.addEventListener('mousemove', handleCropMouseMove);
      document.addEventListener('mouseup', handleCropMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleCropMouseMove);
      document.removeEventListener('mouseup', handleCropMouseUp);
    };
  }, [isDraggingCrop, handleCropMouseMove, handleCropMouseUp]);

  const applyCrop = () => {
    setIsCropMode(false);
  };

  const cancelCrop = () => {
    setCropSettings({ x: 0, y: 0, width: 100, height: 100 });
    setIsCropMode(false);
  };

  const resetCrop = () => {
    setCropSettings({ x: 0, y: 0, width: 100, height: 100 });
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Video Display */}
      <div 
        className="relative rounded-lg overflow-hidden aspect-video flex items-center justify-center transition-all duration-300"
        style={{
          backgroundColor: backgroundColor,
        }}
      >
        <video
          ref={videoRef}
          src={src}
          className="max-w-full max-h-full transition-transform duration-300"
          style={{
            transform: `scale(${(100 - videoPadding) / 100})`,
            borderRadius: `${videoCornerRadius}px`,
            objectFit: cropSettings.width === 100 && cropSettings.height === 100 && cropSettings.x === 0 && cropSettings.y === 0 ? 'contain' : 'none',
            objectPosition: cropSettings.width === 100 && cropSettings.height === 100 && cropSettings.x === 0 && cropSettings.y === 0 ? 'center' : 
              `${-cropSettings.x * (100 / cropSettings.width)}% ${-cropSettings.y * (100 / cropSettings.height)}%`,
            width: cropSettings.width === 100 && cropSettings.height === 100 && cropSettings.x === 0 && cropSettings.y === 0 ? 'auto' : 
              `${100 / cropSettings.width * 100}%`,
            height: cropSettings.width === 100 && cropSettings.height === 100 && cropSettings.x === 0 && cropSettings.y === 0 ? 'auto' : 
              `${100 / cropSettings.height * 100}%`,
          }}
          onClick={togglePlay}
        />
        
        {/* Crop Overlay */}
        {isCropMode && (
          <div 
            ref={cropOverlayRef}
            className="absolute inset-0 cursor-crosshair"
          >
            {/* Dark overlay outside crop area */}
            <div className="absolute inset-0 bg-black/50" />
            
            {/* Crop area */}
            <div 
              className="absolute border-2 border-white bg-transparent"
              style={{
                left: `${cropSettings.x}%`,
                top: `${cropSettings.y}%`,
                width: `${cropSettings.width}%`,
                height: `${cropSettings.height}%`,
              }}
              onMouseDown={(e) => handleCropMouseDown(e, 'move')}
            >
              {/* Corner handles */}
              <div 
                className="absolute -top-1 -left-1 w-3 h-3 bg-white border border-gray-400 cursor-nw-resize"
                onMouseDown={(e) => handleCropMouseDown(e, 'nw')}
              />
              <div 
                className="absolute -top-1 -right-1 w-3 h-3 bg-white border border-gray-400 cursor-ne-resize"
                onMouseDown={(e) => handleCropMouseDown(e, 'ne')}
              />
              <div 
                className="absolute -bottom-1 -left-1 w-3 h-3 bg-white border border-gray-400 cursor-sw-resize"
                onMouseDown={(e) => handleCropMouseDown(e, 'sw')}
              />
              <div 
                className="absolute -bottom-1 -right-1 w-3 h-3 bg-white border border-gray-400 cursor-se-resize"
                onMouseDown={(e) => handleCropMouseDown(e, 'se')}
              />
              
              {/* Edge handles */}
              <div 
                className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border border-gray-400 cursor-n-resize"
                onMouseDown={(e) => handleCropMouseDown(e, 'n')}
              />
              <div 
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border border-gray-400 cursor-s-resize"
                onMouseDown={(e) => handleCropMouseDown(e, 's')}
              />
              <div 
                className="absolute -left-1 top-1/2 -translate-y-1/2 w-3 h-3 bg-white border border-gray-400 cursor-w-resize"
                onMouseDown={(e) => handleCropMouseDown(e, 'w')}
              />
              <div 
                className="absolute -right-1 top-1/2 -translate-y-1/2 w-3 h-3 bg-white border border-gray-400 cursor-e-resize"
                onMouseDown={(e) => handleCropMouseDown(e, 'e')}
              />
            </div>
            
            {/* Crop control buttons */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              <Button onClick={applyCrop} size="sm" className="bg-green-600 hover:bg-green-700">
                <Check className="h-4 w-4 mr-2" />
                Apply Crop
              </Button>
              <Button onClick={cancelCrop} size="sm" variant="outline">
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
      
      {/* Timeline */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{formatTime(currentTime - trimStart)}</span>
          <span>{
            trimEnd > trimStart 
              ? formatTime(trimEnd - trimStart) 
              : (duration > 0 ? formatTime(duration) : 'Loading...')
          }</span>
        </div>
        
        <Slider
          value={[
            trimEnd > trimStart 
              ? ((currentTime - trimStart) / (trimEnd - trimStart)) * 100 
              : 0
          ]}
          onValueChange={handleSeek}
          max={100}
          step={0.1}
          className="w-full cursor-pointer"
        />
      </div>
      
      {/* Display Settings */}
      <div className="space-y-4 border-t border-border pt-4">
        <h3 className="text-sm font-medium flex items-center gap-2">
          <Palette className="h-4 w-4" />
          Display Settings
        </h3>
        
        {/* Video Scale Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm text-muted-foreground flex items-center gap-2">
              <Maximize className="h-3 w-3" />
              Video Scale
            </label>
            <span className="text-sm font-mono">{100 - videoPadding}%</span>
          </div>
          <Slider
            value={[videoPadding]}
            onValueChange={(value) => setVideoPadding(value[0])}
            max={100}
            min={0}
            step={1}
            className="w-full"
          />
        </div>

        {/* Corner Rounding Slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm text-muted-foreground flex items-center gap-2">
              <CornerDownLeft className="h-3 w-3" />
              Corner Rounding
            </label>
            <span className="text-sm font-mono">{videoCornerRadius}px</span>
          </div>
          <Slider
            value={[videoCornerRadius]}
            onValueChange={(value) => setVideoCornerRadius(value[0])}
            max={20}
            min={0}
            step={1}
            className="w-full"
          />
        </div>

        {/* Crop Video Button */}
        <div className="flex items-center justify-between">
          <label className="text-sm text-muted-foreground flex items-center gap-2">
            <Crop className="h-3 w-3" />
            Video Crop
          </label>
          <div className="flex gap-2">
            <Button
              onClick={toggleCropMode}
              variant={isCropMode ? "default" : "outline"}
              size="sm"
              disabled={!duration}
            >
              {isCropMode ? 'Exit Crop' : 'Crop Video'}
            </Button>
            {!isCropMode && (cropSettings.x !== 0 || cropSettings.y !== 0 || cropSettings.width !== 100 || cropSettings.height !== 100) && (
              <Button
                onClick={resetCrop}
                variant="ghost"
                size="sm"
              >
                Reset
              </Button>
            )}
          </div>
        </div>

        {/* Background Color Selector */}
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Background Color</label>
          <div className="flex flex-wrap gap-2">
            {colorPresets.map((color) => (
              <button
                key={color.value}
                onClick={() => setBackgroundColor(color.value)}
                className={cn(
                  "w-8 h-8 rounded-full border-2 transition-all duration-200 hover:scale-110",
                  backgroundColor === color.value 
                    ? "border-primary shadow-lg scale-110" 
                    : "border-border hover:border-muted-foreground"
                )}
                style={{ backgroundColor: color.value }}
                title={color.name}
                aria-label={`Set background to ${color.name}`}
              />
            ))}
          </div>
        </div>
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

        <Button
          onClick={resetTrim}
          variant="ghost"
          size="sm"
          disabled={trimStart === 0 && trimEnd === duration}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset Trim
        </Button>
      </div>

      {/* Video Trimming Component */}
      {duration > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{formatTime(trimStart)}</span>
            <span className="font-medium">Trimmed: {formatTime(getTrimmedDuration())}</span>
            <span>{formatTime(trimEnd)}</span>
          </div>
          
          <div 
            ref={trimmerRef}
            className="relative w-full h-12 bg-muted rounded-lg cursor-pointer select-none"
            onMouseDown={(e) => {
              const rect = trimmerRef.current?.getBoundingClientRect();
              if (!rect) return;
              const x = e.clientX - rect.left;
              const percentage = x / rect.width;
              const time = percentage * duration;
              
              if (time >= trimStart && time <= trimEnd) {
                handleTrimMouseDown(e, 'scrub');
              }
            }}
          >
            {/* Full timeline background */}
            <div className="absolute inset-0 bg-muted-foreground/20 rounded-lg" />
            
            {/* Trimmed section highlight */}
            <div 
              className="absolute top-0 bottom-0 bg-primary/30 border-t-2 border-b-2 border-primary"
              style={{
                left: `${(trimStart / duration) * 100}%`,
                width: `${((trimEnd - trimStart) / duration) * 100}%`,
              }}
            />
            
            {/* Current time indicator */}
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-foreground z-10"
              style={{
                left: `${(currentTime / duration) * 100}%`,
              }}
            />
            
            {/* Start handle */}
            <div 
              className={cn(
                "absolute top-0 bottom-0 w-3 bg-primary rounded-l-lg cursor-ew-resize z-20 hover:bg-primary/80 transition-colors",
                isDragging === 'start' && "bg-primary/80"
              )}
              style={{
                left: `${(trimStart / duration) * 100}%`,
              }}
              onMouseDown={(e) => handleTrimMouseDown(e, 'start')}
            >
              <div className="absolute inset-y-0 left-1/2 w-px bg-primary-foreground transform -translate-x-0.5" />
            </div>
            
            {/* End handle */}
            <div 
              className={cn(
                "absolute top-0 bottom-0 w-3 bg-primary rounded-r-lg cursor-ew-resize z-20 hover:bg-primary/80 transition-colors",
                isDragging === 'end' && "bg-primary/80"
              )}
              style={{
                left: `${(trimEnd / duration) * 100}%`,
                transform: 'translateX(-100%)',
              }}
              onMouseDown={(e) => handleTrimMouseDown(e, 'end')}
            >
              <div className="absolute inset-y-0 left-1/2 w-px bg-primary-foreground transform -translate-x-0.5" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
