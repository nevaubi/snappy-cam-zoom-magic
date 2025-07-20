import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Play, Square, Download, Settings, ZoomIn } from 'lucide-react';

type QualityPreset = 'standard' | 'high' | 'ultra';

interface QualityConfig {
  name: string;
  videoBitsPerSecond: number;
  audioBitsPerSecond: number;
  resolution: { width: number; height: number };
  frameRate: number;
  mimeType: string;
}

interface ZoomConfig {
  intensity: number; // 1.5x, 2x, 3x, 4x
  duration: number; // in milliseconds
  animationSpeed: number; // animation duration in ms
}

interface MousePosition {
  x: number;
  y: number;
}

interface ZoomEvent {
  x: number;
  y: number;
  timestamp: number;
}

const QUALITY_PRESETS: Record<QualityPreset, QualityConfig> = {
  standard: {
    name: 'Standard (720p)',
    videoBitsPerSecond: 2500000, // 2.5 Mbps
    audioBitsPerSecond: 128000, // 128 kbps
    resolution: { width: 1280, height: 720 },
    frameRate: 30,
    mimeType: 'video/webm;codecs=vp9,opus'
  },
  high: {
    name: 'High (1080p)',
    videoBitsPerSecond: 5000000, // 5 Mbps
    audioBitsPerSecond: 192000, // 192 kbps
    resolution: { width: 1920, height: 1080 },
    frameRate: 30,
    mimeType: 'video/webm;codecs=vp9,opus'
  },
  ultra: {
    name: 'Ultra (1440p)',
    videoBitsPerSecond: 8000000, // 8 Mbps
    audioBitsPerSecond: 256000, // 256 kbps
    resolution: { width: 2560, height: 1440 },
    frameRate: 60,
    mimeType: 'video/webm;codecs=vp9,opus'
  }
};

const SimpleVideoRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string>('');
  const [quality, setQuality] = useState<QualityPreset>('high');
  const [error, setError] = useState<string>('');
  const [zoomConfig, setZoomConfig] = useState<ZoomConfig>({
    intensity: 2,
    duration: 2000,
    animationSpeed: 300
  });
  const [zoomCounter, setZoomCounter] = useState(0);
  const [isTabFocused, setIsTabFocused] = useState(true);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const zoomEventsRef = useRef<ZoomEvent[]>([]);
  const mousePositionRef = useRef<MousePosition>({ x: 0, y: 0 });
  const zoomOverlayRef = useRef<HTMLDivElement>(null);

  const getSupportedMimeType = (preferredType: string): string => {
    const fallbacks = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm',
      'video/mp4'
    ];
    
    for (const type of [preferredType, ...fallbacks]) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    
    return 'video/webm';
  };

  const trackMousePosition = useCallback((event: MouseEvent) => {
    if (!isRecording) return;
    mousePositionRef.current = {
      x: event.clientX,
      y: event.clientY
    };
  }, [isRecording]);

  const createZoomOverlay = useCallback(() => {
    console.log('🎯 Zoom triggered at:', mousePositionRef.current);
    
    // Create a more prominent zoom indicator that will be visible in screen recordings
    const zoomElement = document.createElement('div');
    const size = 200; // Larger size for better visibility
    
    zoomElement.style.cssText = `
      position: fixed;
      top: ${mousePositionRef.current.y - size/2}px;
      left: ${mousePositionRef.current.x - size/2}px;
      width: ${size}px;
      height: ${size}px;
      border: 6px solid #ff4444;
      border-radius: 50%;
      background: rgba(255, 68, 68, 0.1);
      pointer-events: none;
      z-index: 999999;
      transform: scale(0);
      animation: zoomPulse ${zoomConfig.animationSpeed}ms ease-out;
      box-shadow: 
        0 0 30px rgba(255, 68, 68, 0.6), 
        inset 0 0 30px rgba(255, 68, 68, 0.2),
        0 0 0 20px rgba(255, 68, 68, 0.1);
    `;

    // Add center dot
    const centerDot = document.createElement('div');
    centerDot.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      width: 12px;
      height: 12px;
      background: #ff4444;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      box-shadow: 0 0 10px rgba(255, 68, 68, 0.8);
    `;

    // Add outer ripple ring
    const outerRing = document.createElement('div');
    outerRing.style.cssText = `
      position: absolute;
      top: -15px;
      left: -15px;
      right: -15px;
      bottom: -15px;
      border: 3px solid rgba(255, 68, 68, 0.7);
      border-radius: 50%;
      animation: zoomPulse ${zoomConfig.animationSpeed + 200}ms ease-out;
    `;

    // Add zoom text indicator
    const zoomText = document.createElement('div');
    zoomText.style.cssText = `
      position: absolute;
      top: ${size + 20}px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(255, 68, 68, 0.9);
      color: white;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: bold;
      white-space: nowrap;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
    `;
    zoomText.textContent = `${zoomConfig.intensity}x ZOOM`;

    zoomElement.appendChild(centerDot);
    zoomElement.appendChild(outerRing);
    zoomElement.appendChild(zoomText);
    document.body.appendChild(zoomElement);
    
    setZoomCounter(prev => prev + 1);
    setShowZoomIndicator(true);

    // Remove after animation
    setTimeout(() => {
      if (document.body.contains(zoomElement)) {
        document.body.removeChild(zoomElement);
      }
      setShowZoomIndicator(false);
    }, zoomConfig.duration);
  }, [zoomConfig.animationSpeed, zoomConfig.intensity, zoomConfig.duration]);

  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (!isRecording) return;
    
    console.log('🔑 Key pressed:', event.key, event.code);
    
    // Use keys that don't have default browser behaviors
    const triggerKeys = ['x', 'z', 'q'];
    const key = event.key.toLowerCase();
    
    if (triggerKeys.includes(key)) {
      event.preventDefault();
      event.stopPropagation();
      
      console.log('✅ Zoom key detected:', key);
      
      zoomEventsRef.current.push({
        x: mousePositionRef.current.x,
        y: mousePositionRef.current.y,
        timestamp: performance.now()
      });

      createZoomOverlay();
    }
  }, [isRecording, createZoomOverlay]);

  // Tab focus detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabFocused(!document.hidden);
    };

    const handleWindowFocus = () => setIsTabFocused(true);
    const handleWindowBlur = () => setIsTabFocused(false);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, []);

  useEffect(() => {
    if (isRecording) {
      // Use capture phase to intercept events before default behaviors
      document.addEventListener('mousemove', trackMousePosition, { capture: true });
      document.addEventListener('keydown', handleKeyPress, { capture: true });
      
      console.log('🎬 Recording started - event listeners attached');
      
      return () => {
        document.removeEventListener('mousemove', trackMousePosition, { capture: true });
        document.removeEventListener('keydown', handleKeyPress, { capture: true });
        console.log('🛑 Recording stopped - event listeners removed');
      };
    } else {
      setZoomCounter(0);
    }
  }, [isRecording, trackMousePosition, handleKeyPress]);

  const startRecording = async () => {
    try {
      setError('');
      const config = QUALITY_PRESETS[quality];
      
      // Simple screen capture
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: config.resolution.width },
          height: { ideal: config.resolution.height },
          frameRate: { ideal: config.frameRate }
        },
        audio: true
      });

      streamRef.current = screenStream;
      
      // Start MediaRecorder directly with screen stream
      chunksRef.current = [];
      const mimeType = getSupportedMimeType(config.mimeType);
      
      const options: MediaRecorderOptions = {
        mimeType,
        videoBitsPerSecond: config.videoBitsPerSecond,
        audioBitsPerSecond: config.audioBitsPerSecond
      };

      const mediaRecorder = new MediaRecorder(screenStream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setRecordedVideoUrl(url);
        setIsRecording(false);
      };

      mediaRecorder.start(1000);
      setIsRecording(true);

    } catch (err) {
      setError('Failed to start recording. Please allow screen capture and try again.');
      console.error('Recording error:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      
      // Stop all stream tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // Clear zoom events
      zoomEventsRef.current = [];
    }
  };

  const downloadVideo = () => {
    if (recordedVideoUrl) {
      const config = QUALITY_PRESETS[quality];
      const extension = config.mimeType.includes('mp4') ? 'mp4' : 'webm';
      const filename = `screen-recording-${quality}-${new Date().toISOString().slice(0, 19)}.${extension}`;
      
      const a = document.createElement('a');
      a.href = recordedVideoUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const currentConfig = QUALITY_PRESETS[quality];
  const estimatedSizeMB = Math.round((currentConfig.videoBitsPerSecond + currentConfig.audioBitsPerSecond) / 8 / 1024 / 1024 * 60); // Per minute

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="p-6">
          <h1 className="text-2xl font-bold mb-6">Screen Recorder</h1>
          
          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md mb-4">
              {error}
            </div>
          )}

          {/* Quality Settings */}
          <div className="mb-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                <span className="text-sm font-medium">Quality:</span>
              </div>
              <Select value={quality} onValueChange={(value: QualityPreset) => setQuality(value)} disabled={isRecording}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(QUALITY_PRESETS).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="text-xs text-muted-foreground space-y-1">
              <div>Resolution: {currentConfig.resolution.width}×{currentConfig.resolution.height} @ {currentConfig.frameRate}fps</div>
              <div>Video: {(currentConfig.videoBitsPerSecond / 1000000).toFixed(1)} Mbps | Audio: {(currentConfig.audioBitsPerSecond / 1000).toFixed(0)} kbps</div>
              <div>Estimated file size: ~{estimatedSizeMB} MB per minute</div>
            </div>
          </div>

          {/* Zoom Settings */}
          <div className="mb-6 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 mb-4">
              <ZoomIn className="w-4 h-4" />
              <span className="text-sm font-medium">Live Zoom Settings</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Zoom Intensity: {zoomConfig.intensity}x
                </label>
                <Slider
                  value={[zoomConfig.intensity]}
                  onValueChange={([value]) => setZoomConfig(prev => ({ ...prev, intensity: value }))}
                  min={1.5}
                  max={4}
                  step={0.5}
                  disabled={isRecording}
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Duration: {zoomConfig.duration / 1000}s
                </label>
                <Slider
                  value={[zoomConfig.duration]}
                  onValueChange={([value]) => setZoomConfig(prev => ({ ...prev, duration: value }))}
                  min={1000}
                  max={5000}
                  step={500}
                  disabled={isRecording}
                  className="w-full"
                />
              </div>
              
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  Animation Speed: {zoomConfig.animationSpeed}ms
                </label>
                <Slider
                  value={[zoomConfig.animationSpeed]}
                  onValueChange={([value]) => setZoomConfig(prev => ({ ...prev, animationSpeed: value }))}
                  min={100}
                  max={800}
                  step={100}
                  disabled={isRecording}
                  className="w-full"
                />
              </div>
            </div>
            
            <div className="text-xs text-muted-foreground mt-3">
              💡 Press <kbd className="px-1 py-0.5 text-xs bg-muted border rounded">X</kbd>, <kbd className="px-1 py-0.5 text-xs bg-muted border rounded">Z</kbd>, or <kbd className="px-1 py-0.5 text-xs bg-muted border rounded">Q</kbd> while recording to zoom at mouse location
            </div>
          </div>

          {/* Recording Controls */}
          <div className="flex gap-4 mb-6">
            <Button
              onClick={isRecording ? stopRecording : startRecording}
              variant={isRecording ? "destructive" : "default"}
              size="lg"
            >
              {isRecording ? (
                <>
                  <Square className="w-4 h-4 mr-2" />
                  Stop Recording
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Start Recording
                </>
              )}
            </Button>

            {recordedVideoUrl && (
              <Button onClick={downloadVideo} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Download ({quality.toUpperCase()})
              </Button>
            )}
          </div>

          {/* Recorded Video Playback */}
          {recordedVideoUrl && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Recorded Video</h3>
              <video
                src={recordedVideoUrl}
                controls
                className="w-full max-h-96 bg-muted rounded-lg"
              />
            </div>
          )}


          {/* Recording Status */}
          {isRecording && (
            <div className="mt-6 space-y-3">
              {/* Prominent Recording Indicator */}
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium text-red-700 dark:text-red-300">
                    🔴 Recording {currentConfig.name}
                  </span>
                </div>
                
                {/* Tab Focus Warning */}
                <div className={`text-xs p-2 rounded ${
                  !isTabFocused 
                    ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border border-yellow-500/30' 
                    : 'bg-green-500/20 text-green-700 dark:text-green-300 border border-green-500/30'
                }`}>
                  {!isTabFocused ? (
                    <span>⚠️ <strong>Tab not focused!</strong> Zoom shortcuts only work when this tab is active. Return to this tab for zoom controls.</span>
                  ) : (
                    <span>✅ <strong>Tab focused.</strong> Zoom shortcuts are active on this tab only.</span>
                  )}
                </div>
              </div>

              {/* Zoom Instructions */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                <div className="text-xs text-muted-foreground flex items-center gap-2 mb-2">
                  <ZoomIn className="w-3 h-3" />
                  <span className="font-medium">Zoom Controls (This Tab Only):</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Press <kbd className="px-1 py-0.5 text-xs bg-muted border rounded">X</kbd>, <kbd className="px-1 py-0.5 text-xs bg-muted border rounded">Z</kbd>, or <kbd className="px-1 py-0.5 text-xs bg-muted border rounded">Q</kbd> to create zoom markers ({zoomConfig.intensity}x for {zoomConfig.duration / 1000}s)
                </div>
                {zoomCounter > 0 && (
                  <div className="text-xs text-primary mt-2 flex items-center gap-2">
                    🎯 Zoom markers created: {zoomCounter} | Last position: ({mousePositionRef.current.x}, {mousePositionRef.current.y})
                  </div>
                )}
              </div>

              {/* Important Limitation Notice */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <div className="text-xs text-blue-700 dark:text-blue-300">
                  <strong>📝 Current Limitation:</strong> Zoom shortcuts only work when this browser tab is focused. 
                  For cross-tab functionality, we'd need a Chrome extension (coming in future updates).
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default SimpleVideoRecorder;