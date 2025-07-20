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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const compositeStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>(null);
  const zoomEventsRef = useRef<ZoomEvent[]>([]);
  const isZoomingRef = useRef(false);

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

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const config = QUALITY_PRESETS[quality];
    canvas.width = config.resolution.width;
    canvas.height = config.resolution.height;

    const drawFrame = () => {
      if (!isRecording) return;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw the video frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Check for active zoom
      const now = performance.now();
      const activeZoom = zoomEventsRef.current.find(zoom => 
        now >= zoom.timestamp && now <= zoom.timestamp + zoomConfig.duration
      );

      if (activeZoom && !isZoomingRef.current) {
        performZoom(ctx, activeZoom, now);
      }

      animationFrameRef.current = requestAnimationFrame(drawFrame);
    };

    drawFrame();
  }, [isRecording, quality, zoomConfig]);

  const performZoom = (ctx: CanvasRenderingContext2D, zoomEvent: ZoomEvent, currentTime: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const elapsed = currentTime - zoomEvent.timestamp;
    const progress = Math.min(elapsed / zoomConfig.animationSpeed, 1);
    
    // Zoom in animation
    if (elapsed < zoomConfig.animationSpeed) {
      const scale = 1 + (zoomConfig.intensity - 1) * progress;
      const zoomX = zoomEvent.x;
      const zoomY = zoomEvent.y;
      
      ctx.save();
      ctx.translate(zoomX, zoomY);
      ctx.scale(scale, scale);
      ctx.translate(-zoomX, -zoomY);
      ctx.restore();
    }
    // Hold zoom
    else if (elapsed < zoomConfig.duration - zoomConfig.animationSpeed) {
      const zoomX = zoomEvent.x;
      const zoomY = zoomEvent.y;
      
      ctx.save();
      ctx.translate(zoomX, zoomY);
      ctx.scale(zoomConfig.intensity, zoomConfig.intensity);
      ctx.translate(-zoomX, -zoomY);
      ctx.restore();
    }
    // Zoom out animation
    else {
      const outProgress = (elapsed - (zoomConfig.duration - zoomConfig.animationSpeed)) / zoomConfig.animationSpeed;
      const scale = zoomConfig.intensity - (zoomConfig.intensity - 1) * outProgress;
      const zoomX = zoomEvent.x;
      const zoomY = zoomEvent.y;
      
      ctx.save();
      ctx.translate(zoomX, zoomY);
      ctx.scale(scale, scale);
      ctx.translate(-zoomX, -zoomY);
      ctx.restore();
    }

    // Remove completed zoom events
    if (elapsed >= zoomConfig.duration) {
      zoomEventsRef.current = zoomEventsRef.current.filter(z => z !== zoomEvent);
    }
  };

  const handleDoubleClick = useCallback((event: MouseEvent) => {
    if (!isRecording) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    zoomEventsRef.current.push({
      x,
      y,
      timestamp: performance.now()
    });
  }, [isRecording]);

  useEffect(() => {
    if (isRecording) {
      document.addEventListener('dblclick', handleDoubleClick);
      return () => document.removeEventListener('dblclick', handleDoubleClick);
    }
  }, [isRecording, handleDoubleClick]);

  const startRecording = async () => {
    try {
      setError('');
      const config = QUALITY_PRESETS[quality];
      
      // Enhanced screen capture with quality constraints
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: config.resolution.width },
          height: { ideal: config.resolution.height },
          frameRate: { ideal: config.frameRate },
          displaySurface: 'monitor'
        },
        audio: {
          sampleRate: 48000,
          channelCount: 2,
          echoCancellation: false,
          noiseSuppression: false
        }
      });

      streamRef.current = screenStream;
      
      // Setup video element to receive the screen stream
      const video = videoRef.current;
      if (video) {
        video.srcObject = screenStream;
        video.play();
        
        video.onloadedmetadata = () => {
          setupCanvas();
          
          // Get canvas stream for recording
          const canvas = canvasRef.current;
          if (canvas) {
            const canvasStream = canvas.captureStream(config.frameRate);
            
            // Add audio tracks from screen stream
            const audioTracks = screenStream.getAudioTracks();
            audioTracks.forEach(track => canvasStream.addTrack(track));
            
            compositeStreamRef.current = canvasStream;
            
            // Start MediaRecorder with the composite stream
            chunksRef.current = [];
            const mimeType = getSupportedMimeType(config.mimeType);
            
            const options: MediaRecorderOptions = {
              mimeType,
              videoBitsPerSecond: config.videoBitsPerSecond,
              audioBitsPerSecond: config.audioBitsPerSecond
            };

            const mediaRecorder = new MediaRecorder(canvasStream, options);
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

            // Start recording with 1-second intervals for smoother data handling
            mediaRecorder.start(1000);
            setIsRecording(true);
          };
        };
      }

    } catch (err) {
      setError('Failed to start recording. Please allow screen capture and try again.');
      console.error('Recording error:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      
      // Stop animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      // Stop all stream tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      
      if (compositeStreamRef.current) {
        compositeStreamRef.current.getTracks().forEach(track => track.stop());
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
              💡 Double-click anywhere on your screen while recording to trigger zoom at that location
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

          {/* Hidden canvas and video for zoom processing */}
          <canvas ref={canvasRef} className="hidden" />
          <video ref={videoRef} className="hidden" muted />

          {/* Recording Status */}
          {isRecording && (
            <div className="mt-6 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                Recording in progress at {currentConfig.name}...
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <ZoomIn className="w-3 h-3" />
                Double-click anywhere to zoom ({zoomConfig.intensity}x for {zoomConfig.duration / 1000}s)
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default SimpleVideoRecorder;