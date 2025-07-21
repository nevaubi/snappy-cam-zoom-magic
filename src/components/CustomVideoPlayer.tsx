import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, RotateCcw, Palette, Maximize, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVideoProcessor } from '@/hooks/useVideoProcessor';

interface CustomVideoPlayerProps {
  src: string;
  className?: string;
  onDurationLoad?: (duration: number) => void;
  originalVideoBlob?: Blob;
}

export const CustomVideoPlayer: React.FC<CustomVideoPlayerProps> = ({ 
  src, 
  className, 
  onDurationLoad,
  originalVideoBlob
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trimmerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [isDragging, setIsDragging] = useState<'start' | 'end' | 'scrub' | null>(null);
  
  // Video display styling states
  const [videoPadding, setVideoPadding] = useState(0);
  const [backgroundColor, setBackgroundColor] = useState('#000000');
  
  // Export functionality
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const { processVideo } = useVideoProcessor();
  
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
      
      // Validate duration before using it
      if (isNaN(videoDuration) || !isFinite(videoDuration) || videoDuration <= 0) {
        console.warn('Invalid video duration detected:', videoDuration);
        return;
      }
      
      console.log('Valid duration detected:', videoDuration, 'Has initialized trim:', hasInitializedTrim.current);
      setDuration(videoDuration);
      
      // Only set initial trim values if not already initialized
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
      
      // If video reaches trim end, pause or loop back (using refs for stable values)
      if (trimEndRef.current > 0 && currentTime >= trimEndRef.current) {
        video.pause();
        setIsPlaying(false);
        // Optional: Loop back to start of trim
        // video.currentTime = trimStartRef.current;
      }
    };

    // Listen to multiple events for better duration detection
    video.addEventListener('loadedmetadata', updateDuration);
    video.addEventListener('canplay', updateDuration);
    video.addEventListener('durationchange', updateDuration);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('timeupdate', handleTimeUpdate);

    // Set preload to ensure metadata loads
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
        // If current time is outside trim range, start from trim start
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
      // If current time is outside trim range, start from trim start
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

    // Calculate seek time within trim range
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

  // Trimming functions
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
      // Show real-time preview while dragging
      if (video) {
        video.currentTime = newTrimStart;
        setCurrentTime(newTrimStart);
      }
    } else if (isDragging === 'end') {
      const newTrimEnd = Math.min(durationRef.current, Math.max(time, trimStartRef.current + 0.5));
      console.log('Setting trimEnd to:', newTrimEnd);
      setTrimEnd(newTrimEnd);
      // Show real-time preview while dragging
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
  }, [isDragging]); // Only isDragging as dependency

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

  // Export video with all UI edits applied
  const exportVideo = async () => {
    if (!originalVideoBlob) {
      console.error('No original video blob available for export');
      return;
    }

    try {
      setIsExporting(true);
      setExportProgress(0);

      const options = {
        trimStart: trimStart,
        trimEnd: trimEnd,
        videoPadding: videoPadding,
        backgroundColor: backgroundColor,
        videoDuration: duration,
        quality: 'high' as const
      };

      console.log('Exporting video with options:', options);

      const processedBlob = await processVideo(
        originalVideoBlob,
        options,
        (progress) => setExportProgress(progress)
      );

      // Download the processed video
      const url = URL.createObjectURL(processedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `edited-video-${new Date().toISOString().slice(0, 19)}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log('Video export completed successfully');
    } catch (error) {
      console.error('Error exporting video:', error);
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Video Display */}
      <div 
        className="relative rounded-lg overflow-hidden h-96 flex items-center justify-center transition-all duration-300"
        style={{
          backgroundColor: backgroundColor,
        }}
      >
        <video
          ref={videoRef}
          src={src}
          className="max-w-full max-h-full rounded-lg transition-transform duration-300"
          style={{
            transform: `scale(${(100 - videoPadding) / 100})`,
          }}
          onClick={togglePlay}
        />
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

        {/* Export Video Button */}
        {originalVideoBlob && (
          <Button
            onClick={exportVideo}
            disabled={isExporting}
            variant="default"
            size="sm"
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? `Exporting... ${Math.round(exportProgress)}%` : 'Export Video'}
          </Button>
        )}
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
              
              // Check if clicking within trim range for scrubbing
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