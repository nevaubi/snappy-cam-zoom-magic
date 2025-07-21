import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Play, Pause, RotateCcw, Palette, Maximize, CornerDownLeft, Crop, Upload, Image as ImageIcon, Settings, ZoomIn, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import bgOceanWave from '@/assets/bg-ocean-wave.jpg';
import bgLivingRoom from '@/assets/bg-living-room.jpg';
import { ZoomTimeline, ZoomEffect } from './ZoomTimeline';
import { ZoomPresets } from './ZoomPresets';
import { ZoomGridSelector } from './ZoomGridSelector';

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

  // Easing function for smooth transitions
  const easeInOutCubic = (t: number): number => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  // Apply zoom effects during video playback with smooth transitions
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
      const effectDuration = activeZoom.endTime - activeZoom.startTime;
      const timeInEffect = currentTime - activeZoom.startTime;
      const transitionDuration = Math.min(activeZoom.zoomSpeed, effectDuration / 2);
      
      let progress = 1; // Default to full zoom
      let zoomMultiplier = 1;
      
      // Calculate smooth zoom in/out progress
      if (timeInEffect <= transitionDuration) {
        // Zoom in phase
        progress = easeInOutCubic(timeInEffect / transitionDuration);
        zoomMultiplier = 1 + (activeZoom.zoomAmount - 1) * progress;
      } else if (timeInEffect >= effectDuration - transitionDuration) {
        // Zoom out phase
        const timeInExitPhase = timeInEffect - (effectDuration - transitionDuration);
        progress = 1 - easeInOutCubic(timeInExitPhase / transitionDuration);
        zoomMultiplier = 1 + (activeZoom.zoomAmount - 1) * progress;
      } else {
        // Hold phase - maintain full zoom
        zoomMultiplier = activeZoom.zoomAmount;
      }
      
      setCurrentZoom(zoomMultiplier);
      setCurrentZoomTarget({ 
        x: activeZoom.targetX + 0.5, 
        y: activeZoom.targetY + 0.5 
      });
    } else {
      setCurrentZoom(1);
      setCurrentZoomTarget({ x: 3.5, y: 3.5 });
    }
  }, [currentTime, zoomEffects]);

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
                <video
                  ref={videoRef}
                  src={src}
                  crossOrigin="anonymous"
                  className="max-w-full max-h-full transition-transform duration-75 ease-out"
                  style={{
                    clipPath: getClipPath(),
                    transform: currentZoom !== 1 ? `scale(${currentZoom})` : 'none',
                    transformOrigin: `${(currentZoomTarget.x / 7) * 100}% ${(currentZoomTarget.y / 7) * 100}%`,
                  }}
                  onClick={togglePlay}
                />
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
                    
                    <div 
                      className="absolute -top-1 -left-1 w-3 h-3 bg-white border border-gray-300 cursor-nw-resize"
                      onMouseDown={(e) => handleCropMouseDown(e, 'nw')}
                    />
                    <div 
                      className="absolute -top-1 -right-1 w-3 h-3 bg-white border border-gray-300 cursor-ne-resize"
                      onMouseDown={(e) => handleCropMouseDown(e, 'ne')}
                    />
                    <div 
                      className="absolute -bottom-1 -left-1 w-3 h-3 bg-white border border-gray-300 cursor-sw-resize"
                      onMouseDown={(e) => handleCropMouseDown(e, 'sw')}
                    />
                    <div 
                      className="absolute -bottom-1 -right-1 w-3 h-3 bg-white border border-gray-300 cursor-se-resize"
                      onMouseDown={(e) => handleCropMouseDown(e, 'se')}
                    />
                    
                    <div 
                      className="absolute -top-1 left-1/2 w-3 h-2 bg-white border border-gray-300 cursor-n-resize transform -translate-x-1/2"
                      onMouseDown={(e) => handleCropMouseDown(e, 'n')}
                    />
                    <div 
                      className="absolute -bottom-1 left-1/2 w-3 h-2 bg-white border border-gray-300 cursor-s-resize transform -translate-x-1/2"
                      onMouseDown={(e) => handleCropMouseDown(e, 's')}
                    />
                    <div 
                      className="absolute -left-1 top-1/2 w-2 h-3 bg-white border border-gray-300 cursor-w-resize transform -translate-y-1/2"
                      onMouseDown={(e) => handleCropMouseDown(e, 'w')}
                    />
                    <div 
                      className="absolute -right-1 top-1/2 w-2 h-3 bg-white border border-gray-300 cursor-e-resize transform -translate-y-1/2"
                      onMouseDown={(e) => handleCropMouseDown(e, 'e')}
                    />
                  </div>
                  
                  <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs font-mono">
                    {Math.round(cropSettings.width)}% × {Math.round(cropSettings.height)}%
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Tabbed Editing Controls Sidebar (25%) */}
        <div className="lg:col-span-1">
          <div className="bg-card/50 border border-border rounded-lg p-4 shadow-sm">
            <Tabs defaultValue="display" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="display" className="flex items-center gap-2 text-xs">
                  <Settings className="h-3 w-3" />
                  Display
                </TabsTrigger>
                <TabsTrigger value="zoom" className="flex items-center gap-2 text-xs">
                  <ZoomIn className="h-3 w-3" />
                  Zoom
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="display" className="space-y-6 mt-0">
                {/* Display Settings */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    Display Settings
                  </h3>
                  
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
                          aria-label={`Set background to ${color.name}`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Image options */}
                  <div className="space-y-3">
                    <div className="space-y-3">
                      {/* Default images */}
                      <div>
                        <label className="text-xs text-muted-foreground mb-2 block">Default Images</label>
                        <div className="flex gap-2">
                          {defaultImages.map((image) => (
                            <button
                              key={image.name}
                              onClick={() => selectDefaultImage(image.src)}
                              className={cn(
                                "w-16 h-16 rounded-md border-2 transition-all duration-200 hover:scale-105 bg-cover bg-center",
                                backgroundImage === image.src ? "border-primary shadow-lg scale-105" : "border-border hover:border-muted-foreground"
                              )}
                              style={{ backgroundImage: `url(${image.src})` }}
                              title={image.name}
                              aria-label={`Set background to ${image.name}`}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Custom upload */}
                      <div>
                        <label className="text-xs text-muted-foreground mb-2 block">Upload Custom Image</label>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-2 px-3 py-2 border border-input rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer">
                            <Upload className="w-4 h-4" />
                            <span className="text-sm">Choose Image</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageUpload}
                              className="hidden"
                            />
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
                              ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20"
                              : "border-border hover:bg-muted/50"
                          )}
                          onClick={() => setSelectedZoomId(zoom.id)}
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium">Zoom {zoom.zoomAmount}x</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteZoomEffect(zoom.id);
                              }}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected Zoom Settings */}
                {selectedZoom && (
                  <div className="space-y-4 border-t pt-4">
                    <div className="space-y-3">
                      <ZoomPresets
                        title="Zoom Amount"
                        options={zoomAmounts}
                        selectedValue={selectedZoom.zoomAmount}
                        onSelect={(value) => updateSelectedZoom('zoomAmount', value)}
                      />

                      <ZoomPresets
                        title="Zoom Speed"
                        options={zoomSpeeds}
                        selectedValue={selectedZoom.zoomSpeed}
                        onSelect={(value) => updateSelectedZoom('zoomSpeed', value)}
                      />

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
                  </div>
                )}

                {zoomEffects.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground">
                    <ZoomIn className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Click "Add Zoom" to create zoom effects</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Bottom Section - Full-width Progress Bar */}
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

      {/* Full-width Transport Controls */}
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
            <div className="absolute inset-0 bg-muted-foreground/20 rounded-lg" />
            
            <div 
              className="absolute top-0 bottom-0 bg-primary/30 border-t-2 border-b-2 border-primary"
              style={{
                left: `${(trimStart / duration) * 100}%`,
                width: `${((trimEnd - trimStart) / duration) * 100}%`,
              }}
            />
            
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-foreground z-10"
              style={{
                left: `${(currentTime / duration) * 100}%`,
              }}
            />
            
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
          
          {/* Zoom Timelines */}
          {zoomEffects.length > 0 && (
            <div className="space-y-2 mt-4">
              <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <ZoomIn className="h-3 w-3" />
                Zoom Effects Timeline
              </div>
              {zoomEffects.map((zoom) => (
                <ZoomTimeline
                  key={zoom.id}
                  zoomEffect={zoom}
                  duration={duration}
                  onUpdate={updateZoomEffect}
                  onDelete={deleteZoomEffect}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
