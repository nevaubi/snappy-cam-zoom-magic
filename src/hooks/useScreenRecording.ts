import { useState, useRef } from 'react';

export type QualityPreset = 'standard' | 'high' | 'ultra';

interface QualityConfig {
  resolution: { width: number; height: number };
  bitrate: number;
  mimeType: string;
}

const QUALITY_PRESETS: Record<QualityPreset, QualityConfig> = {
  standard: {
    resolution: { width: 1280, height: 720 },
    bitrate: 2500000, // 2.5 Mbps
    mimeType: 'video/webm;codecs=vp9'
  },
  high: {
    resolution: { width: 1920, height: 1080 },
    bitrate: 5000000, // 5 Mbps
    mimeType: 'video/webm;codecs=vp9'
  },
  ultra: {
    resolution: { width: 2560, height: 1440 },
    bitrate: 10000000, // 10 Mbps
    mimeType: 'video/webm;codecs=vp9'
  }
};

export const useScreenRecording = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const getSupportedMimeType = (preferredType: string): string => {
    const types = [preferredType, 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
    return types.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';
  };

  const startRecording = async (
    targetElement?: HTMLElement,
    quality: QualityPreset = 'high'
  ): Promise<void> => {
    try {
      setError(null);
      setRecordedBlob(null);
      chunksRef.current = [];

      const config = QUALITY_PRESETS[quality];
      let stream: MediaStream;

      if (targetElement) {
        // Record specific element
        stream = await (targetElement as any).captureStream?.() || 
                 await navigator.mediaDevices.getDisplayMedia({
                   video: {
                     width: config.resolution.width,
                     height: config.resolution.height,
                     frameRate: 30
                   },
                   audio: false
                 });
      } else {
        // Record display media
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: config.resolution.width,
            height: config.resolution.height,
            frameRate: 30
          },
          audio: false
        });
      }

      streamRef.current = stream;
      const mimeType = getSupportedMimeType(config.mimeType);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: config.bitrate
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        setIsRecording(false);
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setError('Recording failed');
        setIsRecording(false);
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);

    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Failed to start recording');
      setIsRecording(false);
    }
  };

  const stopRecording = (): void => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const downloadRecording = (filename: string = 'recorded-video'): void => {
    if (!recordedBlob) return;

    const url = URL.createObjectURL(recordedBlob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `${filename}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return {
    isRecording,
    recordedBlob,
    error,
    startRecording,
    stopRecording,
    downloadRecording
  };
};