
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Play, Square, Download, Settings, Upload, CheckCircle, AlertCircle, Video } from 'lucide-react';
import { CustomVideoPlayer } from './CustomVideoPlayer';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { getDurationFromBlob } from '@/utils/videoDuration';
import { useSidebar } from '@/components/ui/sidebar';

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
  const { user } = useAuth();
  const { setOpen: setSidebarOpen } = useSidebar();
  const [isRecording, setIsRecording] = useState(false);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string>('');
  const [quality, setQuality] = useState<QualityPreset>('high');
  const [error, setError] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [supabaseVideoUrl, setSupabaseVideoUrl] = useState<string>('');
  const [isExportMode, setIsExportMode] = useState(false);
  const [exportProgress, setExportProgress] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Detect if we're in export mode (video already exists)
  React.useEffect(() => {
    setIsExportMode(!!supabaseVideoUrl);
  }, [supabaseVideoUrl]);

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

  const startExportRecording = async () => {
    try {
      setError('');
      setExportProgress('Preparing export...');
      
      // Force ultra quality for export
      const config = QUALITY_PRESETS['ultra'];
      
      // Hide sidebar for clean export
      setSidebarOpen(false);
      
      // Wait a moment for sidebar to close
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setExportProgress('Starting screen capture...');
      
      // Start screen capture
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

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setRecordedVideoUrl(url);
        setIsRecording(false);
        setExportProgress('');
        
        // Replace the preview with the new export
        await uploadVideoToSupabase(blob, mimeType, true);
        
        toast.success('Video exported successfully!');
      };

      // Start recording
      mediaRecorder.start(1000);
      setIsRecording(true);
      setExportProgress('Recording export - please play your video now');

      // Auto-play the current video
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play();
        
        // Stop recording when video ends
        videoRef.current.onended = () => {
          if (mediaRecorderRef.current && isRecording) {
            stopRecording();
          }
        };
      }

    } catch (err) {
      setError('Failed to start export recording. Please allow screen capture and try again.');
      setExportProgress('');
      console.error('Export recording error:', err);
    }
  };

  const startRecording = async () => {
    if (isExportMode) {
      return startExportRecording();
    }

    try {
      setError('');
      const config = QUALITY_PRESETS[quality];
      
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

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setRecordedVideoUrl(url);
        setIsRecording(false);
        
        await uploadVideoToSupabase(blob, mimeType);
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
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };

  const uploadVideoToSupabase = async (blob: Blob, mimeType: string, isExport = false) => {
    try {
      setIsUploading(true);
      setUploadProgress(0);
      
      const config = isExport ? QUALITY_PRESETS['ultra'] : QUALITY_PRESETS[quality];
      const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const prefix = isExport ? 'export' : 'screen-recording';
      const qualityLabel = isExport ? 'ultra' : quality;
      const filename = `${prefix}-${qualityLabel}-${new Date().toISOString().slice(0, 19)}.${extension}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('recorded-videos')
        .upload(filename, blob, {
          contentType: mimeType,
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('recorded-videos')
        .getPublicUrl(filename);

      if (!urlData.publicUrl) throw new Error('Failed to get public URL');

      let duration: number | null = null;
      try {
        duration = await getDurationFromBlob(blob);
        console.log('Successfully detected duration:', duration);
      } catch (error) {
        console.error('Failed to detect video duration:', error);
      }

      const { error: dbError } = await supabase
        .from('recordedvids')
        .insert({
          filename,
          file_url: urlData.publicUrl,
          file_size: blob.size,
          duration,
          quality_preset: qualityLabel,
          user_id: user?.id
        });

      if (dbError) throw dbError;

      setSupabaseVideoUrl(urlData.publicUrl);
      setUploadProgress(100);
      
      if (isExport) {
        toast.success('Export completed successfully!');
      } else {
        toast.success('Video uploaded successfully!');
      }
      
    } catch (error) {
      console.error('Upload error:', error);
      setError('Failed to upload video. You can still download it locally.');
      if (isExport) {
        toast.error('Export upload failed, but you can still download the video');
      } else {
        toast.error('Upload failed, but you can still download the video');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const downloadVideo = () => {
    if (recordedVideoUrl) {
      const config = isExportMode ? QUALITY_PRESETS['ultra'] : QUALITY_PRESETS[quality];
      const extension = config.mimeType.includes('mp4') ? 'mp4' : 'webm';
      const prefix = isExportMode ? 'export' : 'screen-recording';
      const qualityLabel = isExportMode ? 'ultra' : quality;
      const filename = `${prefix}-${qualityLabel}-${new Date().toISOString().slice(0, 19)}.${extension}`;
      
      const a = document.createElement('a');
      a.href = recordedVideoUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const currentConfig = isExportMode ? QUALITY_PRESETS['ultra'] : QUALITY_PRESETS[quality];
  const estimatedSizeMB = Math.round((currentConfig.videoBitsPerSecond + currentConfig.audioBitsPerSecond) / 8 / 1024 / 1024 * 60);

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-4 md:mx-8 lg:mx-12 xl:mx-16 space-y-6">
        <Card className="p-6">
          <h1 className="text-2xl font-bold mb-6">
            {isExportMode ? 'Video Export' : 'Screen Recorder'}
          </h1>
          
          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md mb-4">
              {error}
            </div>
          )}

          {exportProgress && (
            <div className="bg-blue-50 text-blue-700 p-3 rounded-md mb-4 flex items-center gap-2">
              <Video className="w-4 h-4 animate-pulse" />
              {exportProgress}
            </div>
          )}

          {/* Quality Settings - Hidden in export mode */}
          {!isExportMode && (
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
          )}

          {/* Export Mode Info */}
          {isExportMode && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-medium text-blue-900 mb-2">Export Mode Active</h3>
              <p className="text-sm text-blue-700 mb-2">
                Click "Export Video" to record your edited video in Ultra HD (1440p) quality.
              </p>
              <div className="text-xs text-blue-600 space-y-1">
                <div>Export Quality: {currentConfig.name} @ {currentConfig.frameRate}fps</div>
                <div>The sidebar will auto-hide and your video will auto-play during export.</div>
              </div>
            </div>
          )}

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
                  {isExportMode ? 'Stop Export' : 'Stop Recording'}
                </>
              ) : (
                <>
                  {isExportMode ? (
                    <>
                      <Video className="w-4 h-4 mr-2" />
                      Export Video
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Start Recording
                    </>
                  )}
                </>
              )}
            </Button>

            {recordedVideoUrl && (
              <Button onClick={downloadVideo} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Download ({isExportMode ? 'ULTRA' : quality.toUpperCase()})
              </Button>
            )}
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 animate-spin" />
                <span className="text-sm font-medium">
                  {isExportMode ? 'Uploading exported video...' : 'Uploading to cloud storage...'}
                </span>
              </div>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          )}

          {/* Video Playback */}
          {supabaseVideoUrl ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <h3 className="text-sm font-medium">
                  {isExportMode ? 'Exported Video Ready' : 'Cloud Video Ready'}
                </h3>
              </div>
              <div className={isExportMode ? 'flex justify-center' : ''}>
                <CustomVideoPlayer 
                  ref={videoRef}
                  src={supabaseVideoUrl} 
                  className={isExportMode ? 'max-w-4xl mx-auto' : 'w-full'} 
                />
              </div>
            </div>
          ) : recordedVideoUrl && !isUploading ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-500" />
                <h3 className="text-sm font-medium">Local Video (Upload Failed)</h3>
              </div>
              <CustomVideoPlayer src={recordedVideoUrl} className="w-full" />
            </div>
          ) : null}

          {/* Recording Status */}
          {isRecording && (
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              {isExportMode 
                ? `Exporting in progress at ${currentConfig.name}...` 
                : `Recording in progress at ${currentConfig.name}...`
              }
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default SimpleVideoRecorder;
