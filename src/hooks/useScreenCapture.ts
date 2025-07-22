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
      // Enhanced constraints to encourage tab selection
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'browser'
        } as any,
        audio: false,
      });

      const track = displayStream.getVideoTracks()[0];
      
      // Debug initial stream settings
      console.log('Initial stream settings:', track.getSettings());
      
      // Handle stream end
      track.addEventListener('ended', () => {
        displayStream = null;
      });

      return displayStream;
    } catch (error) {
      console.error('Error getting display media:', error);
      if (error.name === 'NotAllowedError') {
        toast({
          title: "Permission Required",
          description: "Please grant screen capture permission and select 'This tab' for region capture.",
        });
      }
      throw new Error('Screen capture permission denied or unsupported');
    }
  }, []);

  const cropToPreview = useCallback(async (track: MediaStreamTrack, element: HTMLElement) => {
    return new Promise<void>((resolve) => {
      // Use requestAnimationFrame to ensure element is fully rendered
      requestAnimationFrame(async () => {
        try {
          // Check if CropTarget is supported (Chromium browsers)
          if (!('CropTarget' in window)) {
            console.error('No Region‑Capture support – Chrome/Edge 104+ only');
            toast({
              title: "Limited Browser Support",
              description: "Region capture requires Chrome 104+ or Edge 104+. Will capture entire tab.",
            });
            resolve();
            return;
          }

          console.log('Element bounds:', element.getBoundingClientRect());
          
          const cropTarget = await (window as any).CropTarget.fromElement(element);
          console.log('CropTarget created:', cropTarget);
          
          await (track as any).applyConstraints({
            advanced: [{ cropTarget }],
          });
          
          // Debug applied constraints
          console.log('Applied constraints:', track.getConstraints());
          console.log('Settings after crop:', track.getSettings());
          
          // Check if crop was actually applied
          const settings = track.getSettings();
          if (settings.width && settings.height) {
            const elementRect = element.getBoundingClientRect();
            const isFullScreen = settings.width > elementRect.width * 1.5 || 
                               settings.height > elementRect.height * 1.5;
            
            if (isFullScreen) {
              toast({
                title: "Screen Capture Notice",
                description: "Detected full screen capture. Make sure to select 'This tab' instead of 'Entire screen' or 'Window' for region capture.",
              });
            } else {
              toast({
                title: "Region Capture Active",
                description: "Successfully cropped to video element region.",
              });
            }
          }
          
          resolve();
        } catch (error) {
          console.error('Failed to apply crop target:', error);
          toast({
            title: "Crop Failed",
            description: "Could not crop to video region. Will record entire tab.",
          });
          resolve();
        }
      });
    });
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