// src/components/CustomVideoPlayer.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Pause, RotateCcw, Palette, Maximize, CornerDownLeft, Crop, Upload, Image as ImageIcon, Settings, ZoomIn, Plus, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import bgOceanWave from '@/assets/bg-ocean-wave.jpg';
import bgLivingRoom from '@/assets/bg-living-room.jpg';
import { ZoomTimeline, ZoomEffect } from './ZoomTimeline';
import { ZoomPresets } from './ZoomPresets';
import { ZoomGridSelector } from './ZoomGridSelector';
import { VideoExportModal } from './VideoExportModal';
import { VideoEditSettings } from '@/utils/VideoExporter';

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
  const trimmerRef = useRef<HTMLDivElement>(null);
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
  
  // Background image states
  const [backgroundType, setBackgroundType] = useState<'color' | 'image'>('color');
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [backgroundImageFit, setBackgroundImageFit] = useState<'cover' | 'contain' | 'fill'>('cover');
  
  // Crop states
  const [isCropMode, setIsCropMode] = useState(false);
  const [cropSettings, setCropSettings] = useState({
    x: 0,      // percentage from left
    y: 0,      // percentage from top
    width: 100, // percentage of original width
    height: 100 // percentage of original height
  });
  const [appliedCropSettings, setAppliedCropSettings] = useState({
    x: 0,
    y: 0,
    width: 100,
    height: 100
  });
  const [cropDragging, setCropDragging] = useState<'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 'e' | 's' | 'w' | null>(null);
  const cropOverlayRef = useRef<HTMLDivElement>(null);
  
  // Zoom states
  const [zoomEffects, setZoomEffects] = useState<ZoomEffect[]>([]);
  const [selectedZoomId, setSelectedZoomId] = useState<string | null>(null);
  const [currentZoom, setCurrentZoom] = useState(1); // Current zoom level applied to video
  const [currentZoomTarget, setCurrentZoomTarget] = useState({ x: 3.5, y: 3.5 }); // Center by default
  
  // Store last active zoom properties for smooth zoom-out only
  const [lastZoomSpeed, setLastZoomSpeed] = useState(0.15);
  const [lastZoomTarget, setLastZoomTarget] = useState({ x: 3.5, y: 3.5 });
  
  // Track processed zoom effects to prevent duplicate updates
  const lastProcessedZoomRef = useRef<string | null>(null);
  const zoomOutTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Export modal state
  const [showExportModal, setShowExportModal] = useState(false);
  
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

  // Default background images
  const defaultImages = [
    { name: 'Ocean Wave', src: bgOceanWave },
    { name: 'Living Room', src: bgLivingRoom },
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

  const handleTrimMouseDown = (e: React.MouseEvent, type: 'start' | 'end' | 'scrub') => {
    e.preventDefault();
    setIsDragging(type);
  };

  const handleTrimMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !trimmerRef.current || !duration) return;

    const rect = trimmerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percentage = x / rect.width;
    const time = percentage * duration;

    if (isDragging === 'start') {
      setTrimStart(Math.max(0, Math.min(time, trimEnd - 0.1)));
    } else if (isDragging === 'end') {
      setTrimEnd(Math.min(duration, Math.max(time, trimStart + 0.1)));
    } else if (isDragging === 'scrub') {
      const video = videoRef.current;
      if (video) {
        const trimDuration = trimEnd - trimStart;
        const seekTime = trimStart + percentage * trimDuration;
        video.currentTime = Math.max(trimStart, Math.min(trimEnd, seekTime));
      }
    }
  }, [isDragging, duration, trimStart, trimEnd]);

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

  const handleCropMouseDown = (e: React.MouseEvent, type: typeof cropDragging) => {
    e.preventDefault();
    e.stopPropagation();
    setCropDragging(type);
  };

  const handleCropMouseMove = useCallback((e: MouseEvent) => {
    if (!cropDragging || !cropOverlayRef.current) return;

    const rect = cropOverlayRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const percentageX = Math.max(0, Math.min(1, x / rect.width));
    const percentageY = Math.max(0, Math.min(1, y / rect.height));

    setCropSettings(prev => {
      const newCrop = { ...prev };
      const minSize = 10;

      if (cropDragging === 'move') {
        const deltaX = percentageX * 100 - (prev.x + prev.width / 2);
        const deltaY = percentageY * 100 - (prev.y + prev.height / 2);
        
        newCrop.x = Math.max(0, Math.min(100 - prev.width, prev.x + deltaX));
        newCrop.y = Math.max(0, Math.min(100 - prev.height, prev.y + deltaY));
      } else if (cropDragging === 'nw') {
        const newX = Math.min(prev.x + prev.width - minSize, percentageX * 100);
        const newY = Math.min(prev.y + prev.height - minSize, percentageY * 100);
        newCrop.width = prev.width + (prev.x - newX);
        newCrop.height = prev.height + (prev.y - newY);
        newCrop.x = newX;
        newCrop.y = newY;
      } else if (cropDragging === 'ne') {
        const newY = Math.min(prev.y + prev.height - minSize, percentageY * 100);
        newCrop.width = Math.max(minSize, percentageX * 100 - prev.x);
        newCrop.height = prev.height + (prev.y - newY);
        newCrop.y = newY;
      } else if (cropDragging === 'sw') {
        const newX = Math.min(prev.x + prev.width - minSize, percentageX * 100);
        newCrop.width = prev.width + (prev.x - newX);
        newCrop.height = Math.max(minSize, percentageY * 100 - prev.y);
        newCrop.x = newX;
      } else if (cropDragging === 'se') {
        newCrop.width = Math.max(minSize, percentageX * 100 - prev.x);
        newCrop.height = Math.max(minSize, percentageY * 100 - prev.y);
      } else if (cropDragging === 'n') {
        const newY = Math.min(prev.y + prev.height - minSize, percentageY * 100);
        newCrop.height = prev.height + (prev.y - newY);
        newCrop.y = newY;
      } else if (cropDragging === 's') {
        newCrop.height = Math.max(minSize, percentageY * 100 - prev.y);
      } else if (cropDragging === 'w') {
        const newX = Math.min(prev.x + prev.width - minSize, percentageX * 100);
        newCrop.width = prev.width + (prev.x - newX);
        newCrop.x = newX;
      } else if (cropDragging === 'e') {
        newCrop.width = Math.max(minSize, percentageX * 100 - prev.x);
      }

      newCrop.x = Math.max(0, newCrop.x);
      newCrop.y = Math.max(0, newCrop.y);
      newCrop.width = Math.min(100 - newCrop.x, Math.max(minSize, newCrop.width));
      newCrop.height = Math.min(100 - newCrop.y, Math.max(minSize, newCrop.height));

      return newCrop;
    });
  }, [cropDragging]);

  const handleCropMouseUp = useCallback(() => {
    setCropDragging(null);
  }, []);

  useEffect(() => {
    if (cropDragging) {
      document.addEventListener('mousemove', handleCropMouseMove);
      document.addEventListener('mouseup', handleCropMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleCropMouseMove);
      document.removeEventListener('mouseup', handleCropMouseUp);
    };
  }, [cropDragging, handleCropMouseMove, handleCropMouseUp]);

  const toggleCropMode = () => {
    setIsCropMode(!isCropMode);
  };

  const applyCrop = () => {
    // Save the crop settings and apply auto-centering
    setAppliedCropSettings({ ...cropSettings });
    setIsCropMode(false);
  };

  const resetCrop = () => {
    setCropSettings({ x: 0, y: 0, width: 100, height: 100 });
    setAppliedCropSettings({ x: 0, y: 0, width: 100, height: 100 });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      console.warn('Please select an image file');
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      console.warn('File size should be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setBackgroundImage(result);
      setBackgroundType('image');
    };
    reader.readAsDataURL(file);
  };

  const selectDefaultImage = (src: string) => {
    setBackgroundImage(src);
    setBackgroundType('image');
  };

  const getClipPath = () => {
    const crop = isCropMode ? cropSettings : appliedCropSettings;
    
    if (crop.width === 100 && crop.height === 100 && crop.x === 0 && crop.y === 0) {
      return 'none';
    }
    
    const top = crop.y;
    const right = 100 - (crop.x + crop.width);
    const bottom = 100 - (crop.y + crop.height);
    const left = crop.x;
    
    // Apply corner radius to cropped areas
    if (videoCornerRadius > 0) {
      return `inset(${top}% ${right}% ${bottom}% ${left}% round ${videoCornerRadius}px)`;
    }
    
    return `inset(${top}% ${right}% ${bottom}% ${left}%)`;
  };

  const getCenteringTransform = () => {
    if (isCropMode || (appliedCropSettings.width === 100 && appliedCropSettings.height === 100 && appliedCropSettings.x === 0 && appliedCropSettings.y === 0)) {
      return '';
    }

    const cropCenterX = appliedCropSettings.x + (appliedCropSettings.width / 2);
    const cropCenterY = appliedCropSettings.y + (appliedCropSettings.height / 2);
    
    const offsetX = (50 - cropCenterX) * 2;
    const offsetY = (50 - cropCenterY) * 2;
    
    return `translate(${offsetX}%, ${offsetY}%)`;
  };

  // Zoom functions
  const addZoomEffect = () => {
    if (zoomEffects.length >= 5) return;
    
    const randomStart = Math.random() * Math.max(0, duration - 3);
    const randomEnd = Math.min(duration, randomStart + 3);
    
    const newZoom: ZoomEffect = {
      id: `zoom-${Date.now()}`,
      startTime: randomStart,
      endTime: randomEnd,
      zoomAmount: 1.5,
      zoomSpeed: 1,
      targetX: 3,
      targetY: 3
    };
    
    setZoomEffects(prev => [...prev, newZoom]);
    setSelectedZoomId(newZoom.id);
  };

  const updateZoomEffect = (updatedZoom: ZoomEffect) => {
    setZoomEffects(prev => prev.map(zoom => 
      zoom.id === updatedZoom.id ? updatedZoom : zoom
    ));
  };

  const deleteZoomEffect = (zoomId: string) => {
    setZoomEffects(prev => prev.filter(zoom => zoom.id !== zoomId));
    if (selectedZoomId === zoomId) {
      setSelectedZoomId(null);
    }
  };

  const updateSelectedZoom = <K extends keyof ZoomEffect>(
    key: K, 
    value: ZoomEffect[K]
  ) => {
    if (!selectedZoomId) return;
    
    setZoomEffects(prev => prev.map(zoom => 
      zoom.id === selectedZoomId ? { ...zoom, [key]: value } : zoom
    ));
  };

  // Reset zoom state when zoom effects are modified
  useEffect(() => {
    // Clear any pending timeouts when zoom effects change
    if (zoomOutTimeoutRef.current) {
      clearTimeout(zoomOutTimeoutRef.current);
      zoomOutTimeoutRef.current = null;
    }
    
    // Reset processed zoom tracking
    lastProcessedZoomRef.current = null;
  }, [zoomEffects]);

  // Apply zoom effects during video playback
  useEffect(() => {
    if (!videoRef.current || zoomEffects.length === 0) {
      setCurrentZoom(1);
      setCurrentZoomTarget({ x: 3.5, y: 3.5 });
      return;
    }

    const activeZoom = zoomEffects.find(zoom => 
      currentTime >= zoom.startTime && currentTime <= zoom.endTime
    );

    if (activeZoom) {
      // Prevent duplicate processing of the same zoom effect
      if (lastProcessedZoomRef.current === activeZoom.id) {
        return;
      }
      
      // Clear any pending zoom-out timeout
      if (zoomOutTimeoutRef.current) {
        clearTimeout(zoomOutTimeoutRef.current);
        zoomOutTimeoutRef.current = null;
      }
      
      // Store zoom properties for consistent zoom-out
      setLastZoomSpeed(activeZoom.zoomSpeed || 0.15);
      setLastZoomTarget({ 
        x: activeZoom.targetX + 0.5, 
        y: activeZoom.targetY + 0.5 
      });
      
      // Set zoom state immediately - no delays or timers
      setCurrentZoom(activeZoom.zoomAmount);
      setCurrentZoomTarget({ 
        x: activeZoom.targetX + 0.5, 
        y: activeZoom.targetY + 0.5 
      });
      
      // Track that we've processed this zoom
      lastProcessedZoomRef.current = activeZoom.id;
      
    } else if (lastProcessedZoomRef.current !== null) {
      // Only trigger zoom-out if we were previously zoomed in
      setCurrentZoom(1);
      
      // Use timeout only for resetting to center after zoom-out completes
      zoomOutTimeoutRef.current = setTimeout(() => {
        setCurrentZoomTarget({ x: 3.5, y: 3.5 });
        lastProcessedZoomRef.current = null;
      }, lastZoomSpeed * 1000);
    }
  }, [currentTime, zoomEffects, lastZoomSpeed]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (zoomOutTimeoutRef.current) {
        clearTimeout(zoomOutTimeoutRef.current);
      }
    };
  }, []);

  // Zoom presets data
  const zoomAmounts = [
    { value: 1.2, label: '1.2x' },
    { value: 1.5, label: '1.5x' },
    { value: 2.0, label: '2x' },
    { value: 2.5, label: '2.5x' },
    { value: 3.0, label: '3x' }
  ];

  const zoomSpeeds = [
    { value: 0.5, label: '0.5s' },
    { value: 1, label: '1s' },
    { value: 1.5, label: '1.5s' },
    { value: 2, label: '2s' },
    { value: 3, label: '3s' }
  ];

  const selectedZoom = selectedZoomId ? zoomEffects.find(z => z.id === selectedZoomId) : null;

  // Prepare edit settings for export
  const getEditSettings = (): VideoEditSettings => ({
    trimStart,
    trimEnd,
    cropSettings: appliedCropSettings,
    zoomEffects,
    videoPadding,
    videoCornerRadius,
    backgroundColor,
    backgroundType,
    backgroundImage,
    backgroundImageFit
  });

  const handleExport = () => {
    // Check if video has valid duration
    if (!duration || duration <= 0) {
      console.error('Video not loaded or invalid duration');
      return;
    }

    // Check if trim duration is valid (max 10 minutes)
    const trimDuration = trimEnd - trimStart;
    if (trimDuration > 600) { // 10 minutes in seconds
      console.warn('Video is longer than 10 minutes. Please trim to 10 minutes or less for export.');
      return;
    }

    setShowExportModal(true);
  };

  return (
    <div className={cn("space-y-6", className)}>
      {/* Main layout: Video player (75%) + Editing controls (25%) */}
      <div className="grid lg:grid-cols-4 gap-6">
        {/* Left Column - Video Player (75%) */}
        <div className="lg:col-span-3">
          <div 
            className="relative rounded-lg overflow-hidden aspect-video flex items-center justify-center transition-all duration-300"
            style={{
              ...(backgroundType === 'color' 
                ? { backgroundColor } 
                : backgroundImage 
                  ? { 
                      backgroundImage: `url(${backgroundImage})`,
                      backgroundSize: backgroundImageFit,
                      backgroundPosition: 'center',
                      backgroundRepeat: 'no-repeat'
                    }
                  : { backgroundColor }
              ),
            }}
          >
            <div 
              className="relative"
              style={{
                transform: `scale(${(100 - videoPadding) / 100}) ${getCenteringTransform()}`.trim(),
              }}
            >
              <div
                className="relative transition-all duration-300"
                style={{
                  borderRadius: `${videoCornerRadius}px`,
                  overflow: 'hidden',
                }}
              >
                <div
                  className="relative overflow-hidden"
                  style={{
                    borderRadius: `${videoCornerRadius}px`,
                  }}
                >
                  <video
                    ref={videoRef}
                    src={src}
                    crossOrigin="anonymous"
                    className="max-w-full max-h-full"
                    style={{
                      clipPath: getClipPath(),
                      transform: currentZoom !== 1 ? `scale(${currentZoom})` : 'none',
                      transformOrigin: `${Math.max(10, Math.min(90, (currentZoomTarget.x / 7) * 100))}% ${Math.max(10, Math.min(90, (currentZoomTarget.y / 7) * 100))}%`,
                      transition: `transform ${
                        zoomEffects.find(zoom => 
                          currentTime >= zoom.startTime && currentTime <= zoom.endTime
                        )?.zoomSpeed || lastZoomSpeed
                      }s cubic-bezier(0.25, 0.46, 0.45, 0.94)`,
                    }}
                    onClick={togglePlay}
                  />
                </div>
              </div>
              
              {isCropMode && (
                <div 
                  ref={cropOverlayRef}
                  className="absolute inset-0 cursor-move"
                  style={{
                    borderRadius: `${videoCornerRadius}px`,
                  }}
                >
                  <div className="absolute inset-0 bg-black/50" />
                  
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
                    <div className="absolute inset-0">
                      <div className="absolute left-1/3 top-0 w-px h-full bg-white/30" />
                      <div className="absolute left-2/3 top-0 w-px h-full bg-white/30" />
                      <div className="absolute top-1/3 left-0 h-px w-full bg-white/30" />
                      <div className="absolute top-2/3 left-0 h-px w-full bg-white/30" />
                    </div>
                    
                    {/* Corner handles */}
                    <div className="absolute -left-1 -top-1 w-3 h-3 bg-white rounded-full cursor-nw-resize" onMouseDown={(e) => handleCropMouseDown(e, 'nw')} />
                    <div className="absolute -right-1 -top-1 w-3 h-3 bg-white rounded-full cursor-ne-resize" onMouseDown={(e) => handleCropMouseDown(e, 'ne')} />
                    <div className="absolute -left-1 -bottom-1 w-3 h-3 bg-white rounded-full cursor-sw-resize" onMouseDown={(e) => handleCropMouseDown(e, 'sw')} />
                    <div className="absolute -right-1 -bottom-1 w-3 h-3 bg-white rounded-full cursor-se-resize" onMouseDown={(e) => handleCropMouseDown(e, 'se')} />
                    
                    {/* Edge handles */}
                    <div className="absolute left-1/2 -top-1 w-3 h-3 -translate-x-1/2 bg-white rounded-full cursor-n-resize" onMouseDown={(e) => handleCropMouseDown(e, 'n')} />
                    <div className="absolute left-1/2 -bottom-1 w-3 h-3 -translate-x-1/2 bg-white rounded-full cursor-s-resize" onMouseDown={(e) => handleCropMouseDown(e, 's')} />
                    <div className="absolute -left-1 top-1/2 w-3 h-3 -translate-y-1/2 bg-white rounded-full cursor-w-resize" onMouseDown={(e) => handleCropMouseDown(e, 'w')} />
                    <div className="absolute -right-1 top-1/2 w-3 h-3 -translate-y-1/2 bg-white rounded-full cursor-e-resize" onMouseDown={(e) => handleCropMouseDown(e, 'e')} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Video Controls & Timeline */}
          <div className="mt-4 space-y-3">
            {/* Play/Pause and Export Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button onClick={togglePlay} size="icon" variant="outline">
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {new Date(currentTime * 1000).toISOString().substr(14, 5)} / {new Date(duration * 1000).toISOString().substr(14, 5)}
                </span>
              </div>
              
              {/* Export Button */}
              <Button 
                onClick={handleExport} 
                variant="default"
                disabled={!duration || duration <= 0 || (trimEnd - trimStart) > 600}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Video
              </Button>
            </div>

            {/* Timeline Slider */}
            <div className="relative">
              <Slider
                value={[duration > 0 && trimEnd > trimStart ? ((currentTime - trimStart) / (trimEnd - trimStart)) * 100 : 0]}
                onValueChange={handleSeek}
                max={100}
                step={0.1}
                className="w-full"
              />
            </div>

            {/* Trim Controls */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Trim Video</span>
                <Button 
                  onClick={resetTrim} 
                  size="sm" 
                  variant="ghost"
                  disabled={trimStart === 0 && trimEnd === duration}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Reset
                </Button>
              </div>
              
              <div 
                ref={trimmerRef}
                className="relative h-12 bg-secondary rounded-md overflow-hidden cursor-pointer"
              >
                {/* Trimmed area background */}
                <div 
                  className="absolute h-full bg-primary/20"
                  style={{
                    left: `${(trimStart / duration) * 100}%`,
                    width: `${((trimEnd - trimStart) / duration) * 100}%`
                  }}
                />
                
                {/* Trim handles */}
                <div 
                  className="absolute top-0 h-full w-2 bg-primary cursor-ew-resize hover:bg-primary/80"
                  style={{ left: `${(trimStart / duration) * 100}%` }}
                  onMouseDown={(e) => handleTrimMouseDown(e, 'start')}
                />
                <div 
                  className="absolute top-0 h-full w-2 bg-primary cursor-ew-resize hover:bg-primary/80"
                  style={{ left: `${(trimEnd / duration) * 100}%` }}
                  onMouseDown={(e) => handleTrimMouseDown(e, 'end')}
                />
                
                {/* Current time indicator */}
                <div 
                  className="absolute top-0 h-full w-0.5 bg-destructive pointer-events-none"
                  style={{ left: `${(currentTime / duration) * 100}%` }}
                />
              </div>
              
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Start: {new Date(trimStart * 1000).toISOString().substr(14, 5)}</span>
                <span>Duration: {new Date(getTrimmedDuration() * 1000).toISOString().substr(14, 5)}</span>
                <span>End: {new Date(trimEnd * 1000).toISOString().substr(14, 5)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Editing Controls (25%) */}
        <div className="lg:col-span-1">
          <Tabs defaultValue="styling" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="styling">
                <Settings className="h-4 w-4 mr-2" />
                Style
              </TabsTrigger>
              <TabsTrigger value="zoom">
                <ZoomIn className="h-4 w-4 mr-2" />
                Zoom
              </TabsTrigger>
            </TabsList>
            
            <div className="mt-4">
              <TabsContent value="styling" className="space-y-4 mt-0">
                {/* Video Padding */}
                <div>
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

                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground flex items-center gap-2">
                      <Crop className="h-3 w-3" />
                      Video Cropping
                    </label>
                    <div className="flex gap-2">
                      <Button
                        onClick={toggleCropMode}
                        variant={isCropMode ? "default" : "outline"}
                        size="sm"
                      >
                        <Crop className="h-3 w-3 mr-2" />
                        {isCropMode ? 'Exit Crop' : 'Crop Video'}
                      </Button>
                      
                      {isCropMode && (
                        <>
                          <Button
                            onClick={applyCrop}
                            variant="default"
                            size="sm"
                          >
                            Apply
                          </Button>
                          <Button
                            onClick={resetCrop}
                            variant="outline"
                            size="sm"
                            disabled={cropSettings.x === 0 && cropSettings.y === 0 && cropSettings.width === 100 && cropSettings.height === 100}
                          >
                            Reset
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Background Settings */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" />
                    Background Settings
                  </h3>
                  
                  {/* Color presets */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-2 block">Color Presets</label>
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
                        />
                      ))}
                    </div>
                  </div>

                  {/* Default background images */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-2 block">Background Images</label>
                    <div className="grid grid-cols-2 gap-2">
                      {defaultImages.map((img) => (
                        <button
                          key={img.src}
                          onClick={() => selectDefaultImage(img.src)}
                          className={cn(
                            "relative aspect-video rounded-md overflow-hidden border-2 transition-all duration-200 hover:scale-105",
                            backgroundImage === img.src
                              ? "border-primary shadow-lg scale-105"
                              : "border-border hover:border-muted-foreground"
                          )}
                        >
                          <img
                            src={img.src}
                            alt={img.name}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors" />
                          <div className="absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-black/60 to-transparent">
                            <span className="text-[10px] text-white font-medium">{img.name}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Custom image upload */}
                  <div>
                    <label className="text-xs text-muted-foreground mb-2 block">Custom Background</label>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <label className="flex-1">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                          />
                          <Button variant="outline" size="sm" className="w-full" asChild>
                            <span>
                              <Upload className="h-3 w-3 mr-2" />
                              Upload Image
                            </span>
                          </Button>
                        </label>
                        
                        {backgroundImage && !defaultImages.some(img => img.src === backgroundImage) && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => {
                              setBackgroundImage(null);
                              setBackgroundType('color');
                            }}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Image fit controls */}
                    {backgroundImage && (
                      <div>
                        <label className="text-xs text-muted-foreground mb-2 block">Image Fit</label>
                        <select 
                          value={backgroundImageFit}
                          onChange={(e) => setBackgroundImageFit(e.target.value as 'cover' | 'contain' | 'fill')}
                          className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground text-sm"
                        >
                          <option value="cover">Cover (fill area, may crop)</option>
                          <option value="contain">Contain (fit within area)</option>
                          <option value="fill">Fill (stretch to fit)</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="zoom" className="space-y-4 mt-0">
                {/* Add Zoom Button */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium flex items-center gap-2">
                      <ZoomIn className="h-4 w-4" />
                      Zoom Effects
                    </h3>
                    <Button
                      onClick={addZoomEffect}
                      disabled={zoomEffects.length >= 5}
                      size="sm"
                      variant="outline"
                      className="text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Zoom ({zoomEffects.length}/5)
                    </Button>
                  </div>

                  {/* Zoom Effects List */}
                  {zoomEffects.length > 0 && (
                    <div className="space-y-2">
                      {zoomEffects.map((zoom) => (
                        <div
                          key={zoom.id}
                          className={cn(
                            "p-2 border rounded-md cursor-pointer transition-colors",
                            selectedZoomId === zoom.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          )}
                          onClick={() => setSelectedZoomId(zoom.id)}
                        >
                          <ZoomTimeline
                            zoomEffect={zoom}
                            duration={duration}
                            onUpdate={updateZoomEffect}
                            onDelete={deleteZoomEffect}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Zoom Controls */}
                  {selectedZoom && (
                    <div className="space-y-4 pt-4 border-t">
                      {/* Zoom Amount */}
                      <ZoomPresets
                        label="Zoom Amount"
                        presets={zoomAmounts}
                        value={selectedZoom.zoomAmount}
                        onChange={(value) => updateSelectedZoom('zoomAmount', value)}
                      />

                      {/* Zoom Speed */}
                      <ZoomPresets
                        label="Zoom Speed"
                        presets={zoomSpeeds}
                        value={selectedZoom.zoomSpeed}
                        onChange={(value) => updateSelectedZoom('zoomSpeed', value)}
                      />

                      {/* Zoom Target Grid */}
                      <ZoomGridSelector
                        videoRef={videoRef}
                        selectedX={selectedZoom.targetX}
                        selectedY={selectedZoom.targetY}
                        onGridSelect={(x, y) => {
                          updateSelectedZoom('targetX', x);
                          updateSelectedZoom('targetY', y);
                        }}
                      />
                    </div>
                  )}
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      {/* Export Modal */}
      <VideoExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        videoUrl={src}
        editSettings={getEditSettings()}
      />
    </div>
  );
};
