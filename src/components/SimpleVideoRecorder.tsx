import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Square, Download, Settings } from 'lucide-react';
import { VideoTimeline } from './VideoTimeline';
import { VideoControls } from './VideoControls';
import { useVideoProcessor } from '@/hooks/useVideoProcessor';
import { toast } from '@/hooks/use-toast';

type QualityPreset = 'standard' | 'high' | 'ultra';

interface QualityConfig {
  name: string;
  videoBitsPerSecond: number;
  audioBitsPerSecond: number;
  resolution: { width: number; height: number };
  frameRate: number;
  mimeType: string;
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
  
  // Video editing states
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [splitPoints, setSplitPoints] = useState<number[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [recordedVideoBlob, setRecordedVideoBlob] = useState<Blob | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const { processVideo } = useVideoProcessor();

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
      chunksRef.current = [];

      // Get supported MIME type with fallback
      const mimeType = getSupportedMimeType(config.mimeType);
      
      // Create MediaRecorder with quality options
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
        setRecordedVideoBlob(blob);
        setIsRecording(false);
      };

      // Start recording with 1-second intervals for smoother data handling
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

  // Video editing functions
  const handleVideoLoad = () => {
    if (videoRef.current) {
      const duration = videoRef.current.duration;
      setVideoDuration(duration);
      setTrimStart(0);
      setTrimEnd(duration);
      setSplitPoints([]);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleGoToStart = () => {
    handleSeek(0);
  };

  const handleTrimChange = (start: number, end: number) => {
    setTrimStart(start);
    setTrimEnd(end);
  };

  const handleSplit = (time: number) => {
    if (!splitPoints.includes(time)) {
      setSplitPoints([...splitPoints, time].sort((a, b) => a - b));
      toast({
        title: "Split added",
        description: `Video will be split at ${Math.floor(time / 60)}:${Math.floor(time % 60).toString().padStart(2, '0')}`
      });
    }
  };

  const handleExport = async () => {
    if (!recordedVideoBlob) return;
    
    setIsExporting(true);
    try {
      const processedBlob = await processVideo(recordedVideoBlob, {
        trimStart: trimStart,
        trimEnd: trimEnd
      });
      
      const url = URL.createObjectURL(processedBlob);
      const config = QUALITY_PRESETS[quality];
      const extension = config.mimeType.includes('mp4') ? 'mp4' : 'webm';
      const filename = `edited-recording-${quality}-${new Date().toISOString().slice(0, 19)}.${extension}`;
      
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      toast({
        title: "Export complete",
        description: "Your edited video has been downloaded"
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "There was an error processing your video",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  const hasEdits = trimStart > 0 || trimEnd < videoDuration || splitPoints.length > 0;

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
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Recorded Video</h3>
              <video
                ref={videoRef}
                src={recordedVideoUrl}
                className="w-full max-h-96 bg-muted rounded-lg"
                onLoadedMetadata={handleVideoLoad}
                onTimeUpdate={handleTimeUpdate}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />
              
              {/* Video Editing Controls */}
              {videoDuration > 0 && (
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-medium">Video Editor</h4>
                    <VideoControls
                      isPlaying={isPlaying}
                      onPlayPause={handlePlayPause}
                      onGoToStart={handleGoToStart}
                      onExport={handleExport}
                      isExporting={isExporting}
                      hasEdits={hasEdits}
                    />
                  </div>
                  
                  <VideoTimeline
                    videoRef={videoRef}
                    duration={videoDuration}
                    currentTime={currentTime}
                    onSeek={handleSeek}
                    onTrimChange={handleTrimChange}
                    onSplit={handleSplit}
                    trimStart={trimStart}
                    trimEnd={trimEnd}
                    splitPoints={splitPoints}
                  />
                  
                  {splitPoints.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Split points: {splitPoints.map(time => 
                        `${Math.floor(time / 60)}:${Math.floor(time % 60).toString().padStart(2, '0')}`
                      ).join(', ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Recording Status */}
          {isRecording && (
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              Recording in progress at {currentConfig.name}...
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default SimpleVideoRecorder;