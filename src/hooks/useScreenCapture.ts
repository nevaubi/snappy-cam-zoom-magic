import { useRef, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';

// Singleton stream to avoid multiple permission prompts
let displayStream: MediaStream | null = null;

export const useScreenCapture = () => {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const getTabStream = useCallback(async (): Promise<MediaStream> => {
    if (displayStream?.active) {
      return displayStream;
    }

    try {
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      // Handle stream end
      displayStream.getVideoTracks()[0].addEventListener('ended', () => {
        displayStream = null;
      });

      return displayStream;
    } catch (error) {
      console.error('Error getting display media:', error);
      throw new Error('Screen capture permission denied or unsupported');
    }
  }, []);

  const cropToPreview = useCallback(async (track: MediaStreamTrack, element: HTMLElement) => {
    try {
      // Check if CropTarget is supported (Chromium browsers)
      if ('CropTarget' in window) {
        const cropTarget = await (window as any).CropTarget.fromElement(element);
        await (track as any).applyConstraints({
          advanced: [{ cropTarget }],
        });
      } else {
        // Show warning for non-Chromium browsers
        toast({
          title: "Limited Browser Support",
          description: "For best results, use Chrome, Edge, or Brave browser. Other browsers will capture the entire tab.",
        });
      }
    } catch (error) {
      console.warn('Failed to apply crop target:', error);
    }
  }, []);

  const startRecording = useCallback((stream: MediaStream, filename = 'export.webm'): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        chunksRef.current = [];
        
        const recorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=h264',
          videoBitsPerSecond: 12_000_000, // 12 Mbps for high quality
        });

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };

        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
          const url = URL.createObjectURL(blob);
          
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          a.click();
          
          URL.revokeObjectURL(url);
          resolve();
        };

        recorder.onerror = (event) => {
          reject(new Error(`Recording failed: ${event}`));
        };

        recorderRef.current = recorder;
        recorder.start();
      } catch (error) {
        reject(error);
      }
    });
  }, []);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
  }, []);

  const isSupported = useCallback(() => {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  }, []);

  const cleanup = useCallback(() => {
    if (displayStream) {
      displayStream.getTracks().forEach(track => track.stop());
      displayStream = null;
    }
    if (recorderRef.current) {
      recorderRef.current = null;
    }
  }, []);

  return {
    getTabStream,
    cropToPreview,
    startRecording,
    stopRecording,
    isSupported,
    cleanup,
  };
};