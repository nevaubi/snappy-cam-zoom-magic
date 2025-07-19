import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Square, Camera, Monitor, Download, ZoomIn, ZoomOut, Upload, Settings, Crop, Scissors, Pause, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';
import { useVideoProcessor } from '@/hooks/useVideoProcessor';
import { VideoTimeline } from './VideoTimeline';

interface RecordingConfig {
  webcamEnabled: boolean;
  screenEnabled: boolean;
  webcamSize: number;
  webcamX: number;
  webcamY: number;
  roundness: number;
  backgroundImage: string | null;
  videoRoundness: number;
}

interface VideoEditorState {
  zoom: number;
  zoomSpeed: number;
  cropX: number;
  cropY: number;
  cropWidth: number;
  cropHeight: number;
  trimStart: number;
  trimEnd: number;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
}

const VideoRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [processedVideoUrl, setProcessedVideoUrl] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [activeTab, setActiveTab] = useState<'record' | 'edit'>('record');
  
  const { processVideo, getVideoDuration, loadFFmpeg } = useVideoProcessor();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);
  const animationFrameRef = useRef<number>();

  const [config, setConfig] = useState<RecordingConfig>({
    webcamEnabled: true,
    screenEnabled: true,
    webcamSize: 25,
    webcamX: 75,
    webcamY: 75,
    roundness: 50,
    backgroundImage: null,
    videoRoundness: 15
  });

  const [editorState, setEditorState] = useState<VideoEditorState>({
    zoom: 1,
    zoomSpeed: 1,
    cropX: 0,
    cropY: 0,
    cropWidth: 100,
    cropHeight: 100,
    trimStart: 0,
    trimEnd: 100,
    currentTime: 0,
    duration: 0,
    isPlaying: false
  });

  // Initialize FFmpeg when component mounts
  useEffect(() => {
    loadFFmpeg();
  }, [loadFFmpeg]);

  // Initialize video elements for streams
  const initializeVideoElements = useCallback(async () => {
    if (config.screenEnabled && screenStreamRef.current && screenVideoRef.current) {
      screenVideoRef.current.srcObject = screenStreamRef.current;
      screenVideoRef.current.muted = true;
      await screenVideoRef.current.play();
    }
    
    if (config.webcamEnabled && webcamStreamRef.current && webcamVideoRef.current) {
      webcamVideoRef.current.srcObject = webcamStreamRef.current;
      webcamVideoRef.current.muted = true;
      await webcamVideoRef.current.play();
    }
  }, [config.screenEnabled, config.webcamEnabled]);

  // Canvas composition for recording
  const setupCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 1920;
    canvas.height = 1080;

    const compositeStreams = () => {
      if (!isRecording) return;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw background if exists
      if (backgroundImageRef.current) {
        ctx.drawImage(backgroundImageRef.current, 0, 0, canvas.width, canvas.height);
      } else {
        // Gradient background
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, 'hsl(265 89% 70%)');
        gradient.addColorStop(1, 'hsl(280 100% 75%)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      // Draw screen capture
      if (config.screenEnabled && screenVideoRef.current && screenVideoRef.current.readyState >= 2) {
        ctx.save();
        const radius = config.videoRoundness;
        if (radius > 0) {
          ctx.beginPath();
          ctx.roundRect(0, 0, canvas.width, canvas.height, radius);
          ctx.clip();
        }
        ctx.drawImage(screenVideoRef.current, 0, 0, canvas.width, canvas.height);
        ctx.restore();
      }

      // Draw webcam
      if (config.webcamEnabled && webcamVideoRef.current && webcamVideoRef.current.readyState >= 2) {
        const size = (config.webcamSize / 100) * Math.min(canvas.width, canvas.height) * 0.3;
        const x = (config.webcamX / 100) * (canvas.width - size);
        const y = (config.webcamY / 100) * (canvas.height - size);
        
        ctx.save();
        const radius = (config.roundness / 100) * (size / 2);
        if (radius > 0) {
          ctx.beginPath();
          ctx.roundRect(x, y, size, size, radius);
          ctx.clip();
        }
        ctx.drawImage(webcamVideoRef.current, x, y, size, size);
        ctx.restore();
      }

      if (isRecording) {
        animationFrameRef.current = requestAnimationFrame(compositeStreams);
      }
    };

    await initializeVideoElements();
    compositeStreams();
  }, [isRecording, config, initializeVideoElements]);

  const startRecording = async () => {
    try {
      // Get screen capture
      if (config.screenEnabled) {
        screenStreamRef.current = await navigator.mediaDevices.getDisplayMedia({
          video: { width: 1920, height: 1080 },
          audio: true
        });
      }

      // Get webcam
      if (config.webcamEnabled) {
        webcamStreamRef.current = await navigator.mediaDevices.getUserMedia({
          video: { width: 1920, height: 1080 },
          audio: false
        });
      }

      // Setup canvas recording
      const canvas = canvasRef.current;
      if (!canvas) return;

      await setupCanvas();
      
      const stream = canvas.captureStream(60);
      
      // Add audio from screen if available
      if (screenStreamRef.current) {
        const audioTracks = screenStreamRef.current.getAudioTracks();
        audioTracks.forEach(track => stream.addTrack(track));
      }

      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9'
      });

      recordedChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedVideoUrl(url);
        
        // Get video duration for timeline
        const duration = await getVideoDuration(blob);
        setEditorState(prev => ({ ...prev, duration, trimEnd: duration }));
        
        setActiveTab('edit');
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      
      toast({
        title: "Recording Started",
        description: "Your screen recording has begun!"
      });

    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "Recording Error",
        description: "Failed to start recording. Please check permissions."
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Cancel animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      // Stop all streams
      [screenStreamRef.current, webcamStreamRef.current].forEach(stream => {
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      });
      
      toast({
        title: "Recording Stopped",
        description: "Processing your video..."
      });
    }
  };

  const handleBackgroundUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          backgroundImageRef.current = img;
          setConfig(prev => ({ ...prev, backgroundImage: e.target?.result as string }));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const downloadVideo = () => {
    const videoUrl = processedVideoUrl || recordedVideoUrl;
    if (videoUrl) {
      const a = document.createElement('a');
      a.href = videoUrl;
      a.download = `recording-${Date.now()}.webm`;
      a.click();
      
      toast({
        title: "Download Started",
        description: "Your video is being downloaded!"
      });
    }
  };

  const applyVideoProcessing = async () => {
    if (!recordedVideoUrl) return;
    
    setIsProcessing(true);
    setProcessingProgress(0);
    
    try {
      const response = await fetch(recordedVideoUrl);
      const blob = await response.blob();
      
      const processedBlob = await processVideo(blob, {
        zoom: editorState.zoom,
        cropX: editorState.cropX,
        cropY: editorState.cropY,
        cropWidth: editorState.cropWidth,
        cropHeight: editorState.cropHeight,
        trimStart: editorState.trimStart,
        trimEnd: editorState.trimEnd,
        quality: 'high'
      }, (progress) => {
        setProcessingProgress(progress);
      });
      
      const processedUrl = URL.createObjectURL(processedBlob);
      setProcessedVideoUrl(processedUrl);
      
      toast({
        title: "Processing Complete",
        description: "Your video has been processed successfully!"
      });
    } catch (error) {
      console.error('Video processing error:', error);
      toast({
        title: "Processing Error",
        description: "Failed to process video. Please try again."
      });
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  };

  const resetEditing = () => {
    setEditorState(prev => ({
      ...prev,
      zoom: 1,
      cropX: 0,
      cropY: 0,
      cropWidth: 100,
      cropHeight: 100,
      trimStart: 0,
      trimEnd: prev.duration
    }));
    
    if (processedVideoUrl) {
      URL.revokeObjectURL(processedVideoUrl);
      setProcessedVideoUrl(null);
    }
  };

  const applyZoom = (zoomLevel: number) => {
    if (previewVideoRef.current) {
      previewVideoRef.current.style.transform = `scale(${zoomLevel})`;
      previewVideoRef.current.style.transition = `transform ${editorState.zoomSpeed}s cubic-bezier(0.4, 0, 0.2, 1)`;
    }
  };

  const handlePlayPause = () => {
    if (previewVideoRef.current) {
      if (editorState.isPlaying) {
        previewVideoRef.current.pause();
      } else {
        previewVideoRef.current.play();
      }
      setEditorState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
    }
  };

  const handleTimeUpdate = () => {
    if (previewVideoRef.current) {
      setEditorState(prev => ({
        ...prev,
        currentTime: previewVideoRef.current!.currentTime
      }));
    }
  };

  const handleCurrentTimeChange = (time: number) => {
    if (previewVideoRef.current) {
      previewVideoRef.current.currentTime = time;
      setEditorState(prev => ({ ...prev, currentTime: time }));
    }
  };

  const handleTrimChange = (start: number, end: number) => {
    setEditorState(prev => ({ ...prev, trimStart: start, trimEnd: end }));
  };

  // Set up video event listeners
  useEffect(() => {
    const video = previewVideoRef.current;
    if (video) {
      video.addEventListener('timeupdate', handleTimeUpdate);
      return () => video.removeEventListener('timeupdate', handleTimeUpdate);
    }
  }, [processedVideoUrl || recordedVideoUrl]);

  // Hidden video elements for canvas composition
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-accent-glow to-accent-soft bg-clip-text text-transparent mb-2">
            Video Recorder Pro
          </h1>
          <p className="text-foreground/70">Professional screen & webcam recording with advanced editing</p>
        </header>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-controls rounded-xl p-1 flex">
            <Button
              variant={activeTab === 'record' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('record')}
              className="px-6"
            >
              <Camera className="w-4 h-4 mr-2" />
              Record
            </Button>
            <Button
              variant={activeTab === 'edit' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('edit')}
              className="px-6"
              disabled={!recordedVideoUrl}
            >
              <Settings className="w-4 h-4 mr-2" />
              Edit
            </Button>
          </div>
        </div>

        {/* Recording Tab */}
        {activeTab === 'record' && (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Preview Area */}
            <div className="lg:col-span-2">
              <Card className="bg-preview border-0 overflow-hidden">
                <div className="aspect-video relative bg-gradient-to-br from-accent-glow/20 to-accent-soft/20">
                  <canvas
                    ref={canvasRef}
                    className="w-full h-full object-cover rounded-lg"
                    style={{
                      borderRadius: `${config.videoRoundness}px`
                    }}
                  />
                  
                  {/* Recording Indicator */}
                  {isRecording && (
                    <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/50 px-3 py-2 rounded-full">
                      <div className="w-3 h-3 bg-recording rounded-full animate-recording-pulse" />
                      <span className="text-white text-sm font-medium">REC</span>
                    </div>
                  )}
                  
                  {/* Webcam Preview Overlay */}
                  {config.webcamEnabled && (
                    <div
                      className="absolute border-2 border-accent-glow/50 pointer-events-none"
                      style={{
                        width: `${config.webcamSize}%`,
                        height: `${config.webcamSize}%`,
                        left: `${config.webcamX}%`,
                        top: `${config.webcamY}%`,
                        borderRadius: config.roundness === 100 ? '50%' : `${config.roundness}%`,
                        transform: 'translate(-50%, -50%)'
                      }}
                    />
                  )}
                </div>
              </Card>
            </div>

            {/* Controls Panel */}
            <div className="space-y-6">
              {/* Recording Controls */}
              <Card className="bg-controls border-0 p-6">
                <h3 className="text-lg font-semibold text-controls-foreground mb-4">Recording</h3>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Button
                      onClick={isRecording ? stopRecording : startRecording}
                      className={`flex-1 ${isRecording 
                        ? 'bg-recording hover:bg-recording/90 animate-recording-pulse' 
                        : 'bg-gradient-to-r from-accent-glow to-accent-soft hover:opacity-90'
                      }`}
                    >
                      {isRecording ? (
                        <>
                          <Square className="w-4 h-4 mr-2" />
                          Stop
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Start
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={config.screenEnabled ? 'default' : 'outline'}
                      onClick={() => setConfig(prev => ({ ...prev, screenEnabled: !prev.screenEnabled }))}
                      size="sm"
                    >
                      <Monitor className="w-4 h-4 mr-1" />
                      Screen
                    </Button>
                    <Button
                      variant={config.webcamEnabled ? 'default' : 'outline'}
                      onClick={() => setConfig(prev => ({ ...prev, webcamEnabled: !prev.webcamEnabled }))}
                      size="sm"
                    >
                      <Camera className="w-4 h-4 mr-1" />
                      Webcam
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Webcam Settings */}
              {config.webcamEnabled && (
                <Card className="bg-controls border-0 p-6">
                  <h3 className="text-lg font-semibold text-controls-foreground mb-4">Webcam Settings</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-controls-foreground/70 mb-2 block">Size: {config.webcamSize}%</label>
                      <Slider
                        value={[config.webcamSize]}
                        onValueChange={([value]) => setConfig(prev => ({ ...prev, webcamSize: value }))}
                        max={50}
                        min={10}
                        step={1}
                        className="w-full"
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm text-controls-foreground/70 mb-2 block">Position X: {config.webcamX}%</label>
                      <Slider
                        value={[config.webcamX]}
                        onValueChange={([value]) => setConfig(prev => ({ ...prev, webcamX: value }))}
                        max={100}
                        min={0}
                        step={1}
                        className="w-full"
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm text-controls-foreground/70 mb-2 block">Position Y: {config.webcamY}%</label>
                      <Slider
                        value={[config.webcamY]}
                        onValueChange={([value]) => setConfig(prev => ({ ...prev, webcamY: value }))}
                        max={100}
                        min={0}
                        step={1}
                        className="w-full"
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm text-controls-foreground/70 mb-2 block">Roundness: {config.roundness}%</label>
                      <Slider
                        value={[config.roundness]}
                        onValueChange={([value]) => setConfig(prev => ({ ...prev, roundness: value }))}
                        max={100}
                        min={0}
                        step={1}
                        className="w-full"
                      />
                    </div>
                  </div>
                </Card>
              )}

              {/* Video Settings */}
              <Card className="bg-controls border-0 p-6">
                <h3 className="text-lg font-semibold text-controls-foreground mb-4">Video Style</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-controls-foreground/70 mb-2 block">Corner Roundness: {config.videoRoundness}px</label>
                    <Slider
                      value={[config.videoRoundness]}
                      onValueChange={([value]) => setConfig(prev => ({ ...prev, videoRoundness: value }))}
                      max={50}
                      min={0}
                      step={1}
                      className="w-full"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm text-controls-foreground/70 mb-2 block">Background Image</label>
                    <div className="flex gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleBackgroundUpload}
                        className="hidden"
                        id="bg-upload"
                      />
                      <label htmlFor="bg-upload" className="flex-1">
                        <Button variant="outline" className="w-full" asChild>
                          <span>
                            <Upload className="w-4 h-4 mr-2" />
                            Upload
                          </span>
                        </Button>
                      </label>
                      {config.backgroundImage && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setConfig(prev => ({ ...prev, backgroundImage: null }));
                            backgroundImageRef.current = null;
                          }}
                          size="sm"
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Edit Tab */}
        {activeTab === 'edit' && recordedVideoUrl && (
          <div className="space-y-8">
            {/* Video Preview */}
            <Card className="bg-preview border-0 overflow-hidden">
              <div className="aspect-video relative bg-black">
                <video
                  ref={previewVideoRef}
                  src={processedVideoUrl || recordedVideoUrl}
                  className="w-full h-full object-contain"
                  style={{
                    transform: `scale(${editorState.zoom})`,
                    transformOrigin: 'center center',
                    transition: `transform ${editorState.zoomSpeed}s cubic-bezier(0.4, 0, 0.2, 1)`
                  }}
                />
                
                {/* Processing overlay */}
                {isProcessing && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="bg-controls p-6 rounded-lg text-center">
                      <div className="text-controls-foreground mb-2">Processing Video...</div>
                      <Progress value={processingProgress} className="w-48" />
                      <div className="text-sm text-controls-foreground/70 mt-2">
                        {Math.round(processingProgress)}%
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Timeline */}
            {editorState.duration > 0 && (
              <VideoTimeline
                videoUrl={processedVideoUrl || recordedVideoUrl}
                duration={editorState.duration}
                currentTime={editorState.currentTime}
                trimStart={editorState.trimStart}
                trimEnd={editorState.trimEnd}
                onCurrentTimeChange={handleCurrentTimeChange}
                onTrimChange={handleTrimChange}
                onPlayPause={handlePlayPause}
                isPlaying={editorState.isPlaying}
              />
            )}

            {/* Editing Controls */}
            <div className="grid lg:grid-cols-4 gap-6">
              {/* Zoom Controls */}
              <Card className="bg-controls border-0 p-6">
                <h3 className="text-lg font-semibold text-controls-foreground mb-4">Zoom</h3>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        const newZoom = Math.max(0.5, editorState.zoom - 0.1);
                        setEditorState(prev => ({ ...prev, zoom: newZoom }));
                      }}
                      size="sm"
                      variant="outline"
                      className="flex-1"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => {
                        const newZoom = Math.min(3, editorState.zoom + 0.1);
                        setEditorState(prev => ({ ...prev, zoom: newZoom }));
                      }}
                      size="sm"
                      variant="outline"
                      className="flex-1"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div>
                    <label className="text-sm text-controls-foreground/70 mb-2 block">
                      Level: {editorState.zoom.toFixed(1)}x
                    </label>
                    <Slider
                      value={[editorState.zoom]}
                      onValueChange={([value]) => {
                        setEditorState(prev => ({ ...prev, zoom: value }));
                      }}
                      max={3}
                      min={0.5}
                      step={0.1}
                      className="w-full"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm text-controls-foreground/70 mb-2 block">
                      Speed: {editorState.zoomSpeed}s
                    </label>
                    <Slider
                      value={[editorState.zoomSpeed]}
                      onValueChange={([value]) => setEditorState(prev => ({ ...prev, zoomSpeed: value }))}
                      max={3}
                      min={0.1}
                      step={0.1}
                      className="w-full"
                    />
                  </div>
                </div>
              </Card>

              {/* Crop Controls */}
              <Card className="bg-controls border-0 p-6">
                <h3 className="text-lg font-semibold text-controls-foreground mb-4">Crop</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-sm text-controls-foreground/70 mb-1 block">X: {editorState.cropX}%</label>
                      <Slider
                        value={[editorState.cropX]}
                        onValueChange={([value]) => setEditorState(prev => ({ ...prev, cropX: value }))}
                        max={50}
                        min={0}
                        step={1}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-controls-foreground/70 mb-1 block">Y: {editorState.cropY}%</label>
                      <Slider
                        value={[editorState.cropY]}
                        onValueChange={([value]) => setEditorState(prev => ({ ...prev, cropY: value }))}
                        max={50}
                        min={0}
                        step={1}
                        className="w-full"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-sm text-controls-foreground/70 mb-1 block">W: {editorState.cropWidth}%</label>
                      <Slider
                        value={[editorState.cropWidth]}
                        onValueChange={([value]) => setEditorState(prev => ({ ...prev, cropWidth: value }))}
                        max={100}
                        min={10}
                        step={1}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-controls-foreground/70 mb-1 block">H: {editorState.cropHeight}%</label>
                      <Slider
                        value={[editorState.cropHeight]}
                        onValueChange={([value]) => setEditorState(prev => ({ ...prev, cropHeight: value }))}
                        max={100}
                        min={10}
                        step={1}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              </Card>

              {/* Processing Controls */}
              <Card className="bg-controls border-0 p-6">
                <h3 className="text-lg font-semibold text-controls-foreground mb-4">Process</h3>
                <div className="space-y-3">
                  <Button
                    onClick={applyVideoProcessing}
                    disabled={isProcessing}
                    className="w-full bg-accent-glow hover:bg-accent-glow/90"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Apply Effects
                  </Button>
                  
                  <Button
                    onClick={resetEditing}
                    variant="outline"
                    className="w-full"
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reset
                  </Button>
                </div>
              </Card>

              {/* Export Controls */}
              <Card className="bg-controls border-0 p-6">
                <h3 className="text-lg font-semibold text-controls-foreground mb-4">Export</h3>
                <div className="space-y-3">
                  <Button
                    onClick={downloadVideo}
                    className="w-full bg-gradient-to-r from-accent-glow to-accent-soft hover:opacity-90"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* Hidden video elements for canvas composition */}
        <video ref={screenVideoRef} className="hidden" muted />
        <video ref={webcamVideoRef} className="hidden" muted />
      </div>
    </div>
  );
};

export default VideoRecorder;