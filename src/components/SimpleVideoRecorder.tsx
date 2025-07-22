import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Play, Square, Download, Settings, Upload, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { CustomVideoPlayer } from './CustomVideoPlayer';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { getDurationFromBlob } from '@/utils/videoDuration';

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

interface SimpleVideoRecorderProps {
  onCloseSidebar?: () => void;
}

const SimpleVideoRecorder = ({ onCloseSidebar }: SimpleVideoRecorderProps = {}) => {
  const [showRightPanels, setShowRightPanels] = useState(true);
  const { user } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string>('');
  const [quality, setQuality] = useState<QualityPreset>('high');
  const [error, setError] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [supabaseVideoUrl, setSupabaseVideoUrl] = useState<string>('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

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

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setRecordedVideoUrl(url);
        setIsRecording(false);
        
        // Upload to Supabase
        await uploadVideoToSupabase(blob, mimeType);
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

  const uploadVideoToSupabase = async (blob: Blob, mimeType: string) => {
    try {
      setIsUploading(true);
      setUploadProgress(0);
      
      const config = QUALITY_PRESETS[quality];
      const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const filename = `screen-recording-${quality}-${new Date().toISOString().slice(0, 19)}.${extension}`;
      
      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('recorded-videos')
        .upload(filename, blob, {
          contentType: mimeType,
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('recorded-videos')
        .getPublicUrl(filename);

      if (!urlData.publicUrl) throw new Error('Failed to get public URL');

      // Get video duration reliably
      let duration: number | null = null;
      try {
        duration = await getDurationFromBlob(blob);
        console.log('Successfully detected duration:', duration);
      } catch (error) {
        console.error('Failed to detect video duration:', error);
        // Continue without duration - store as null
      }

      // Save metadata to database
      const { error: dbError } = await supabase
        .from('recordedvids')
        .insert({
          filename,
          file_url: urlData.publicUrl,
          file_size: blob.size,
          duration,
          quality_preset: quality,
          user_id: user?.id
        });

      if (dbError) throw dbError;

      setSupabaseVideoUrl(urlData.publicUrl);
      setUploadProgress(100);
      toast.success('Video uploaded successfully!');
      
    } catch (error) {
      console.error('Upload error:', error);
      setError('Failed to upload video. You can still download it locally.');
      toast.error('Upload failed, but you can still download the video');
    } finally {
      setIsUploading(false);
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
      <div className="mx-4 md:mx-8 lg:mx-12 xl:mx-16 space-y-6">
        <Card className="p-6">
          {/* Header Row with Controls */}
          <div className="flex items-center gap-4 mb-6 flex-wrap">
            <h1 className="text-2xl font-bold">Screen Recorder</h1>
            
            <Button
              onClick={isRecording ? stopRecording : startRecording}
              variant={isRecording ? "destructive" : "default"}
              size="default"
              className={isRecording ? "shadow-lg shadow-destructive/25 animate-recording-pulse" : "shadow-lg shadow-primary/25"}
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

            {recordedVideoUrl && (
              <Button onClick={downloadVideo} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Download ({quality.toUpperCase()})
              </Button>
            )}

            <Button
              variant="outline" 
              size="sm"
              onClick={() => {
                setShowRightPanels(!showRightPanels);
                if (!showRightPanels && onCloseSidebar) {
                  onCloseSidebar();
                }
              }}
              className="ml-auto"
            >
              {showRightPanels ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
              {showRightPanels ? 'Hide panels' : 'Show panels'}
            </Button>
          </div>
          
          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md mb-4">
              {error}
            </div>
          )}

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2 p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm font-medium text-primary">Uploading to cloud storage...</span>
              </div>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          )}

          {/* Recorded Video Playback */}
          {supabaseVideoUrl ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <h3 className="text-sm font-medium">Cloud Video Ready</h3>
              </div>
              <CustomVideoPlayer 
                src={supabaseVideoUrl} 
                className="w-full" 
                onCloseSidebar={onCloseSidebar}
                showRightPanels={showRightPanels}
              />
            </div>
          ) : recordedVideoUrl && !isUploading ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-500" />
                <h3 className="text-sm font-medium">Local Video (Upload Failed)</h3>
              </div>
              <CustomVideoPlayer 
                src={recordedVideoUrl} 
                className="w-full" 
                onCloseSidebar={onCloseSidebar}
                showRightPanels={showRightPanels}
              />
            </div>
          ) : null}

          {/* Recording Status */}
          {isRecording && (
            <div className="mt-6 flex items-center gap-2 text-sm font-medium">
              <div className="w-3 h-3 bg-recording rounded-full animate-recording-pulse shadow-lg shadow-recording/50" />
              <span className="text-recording">Recording in progress at {currentConfig.name}...</span>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default SimpleVideoRecorder;
