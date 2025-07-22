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
              title: "Using Popup Fallback",
              description: "Region capture not supported. Will use popup window method.",
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
                title: "Using Popup Fallback",
                description: "Full screen detected. Switching to popup window method for precise capture.",
              });
              // Signal that we need popup fallback
              (window as any)._needsPopupFallback = true;
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
            title: "Using Popup Fallback",
            description: "Region capture failed. Using popup window method.",
          });
          (window as any)._needsPopupFallback = true;
          resolve();
        }
      });
    });
  }, []);

  const createPopupExport = useCallback(async (element: HTMLVideoElement, filename = 'export.webm'): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        const rect = element.getBoundingClientRect();
        const videoStyle = window.getComputedStyle(element);
        
        // Create minimal HTML for popup
        const popupHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Video Export</title>
            <style>
              body { 
                margin: 0; 
                padding: 0; 
                background: black; 
                overflow: hidden;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
              }
              video { 
                width: 100%;
                height: 100%;
                object-fit: contain;
                border-radius: ${videoStyle.borderRadius};
              }
            </style>
          </head>
          <body>
            <video id="exportVideo" controls autoplay muted>
              <source src="${element.src}" type="video/mp4">
            </video>
            <script>
              const video = document.getElementById('exportVideo');
              video.currentTime = ${element.currentTime};
              
              // Listen for messages from parent
              window.addEventListener('message', (event) => {
                if (event.data.type === 'PLAY') {
                  video.currentTime = event.data.currentTime;
                  video.play();
                } else if (event.data.type === 'PAUSE') {
                  video.pause();
                } else if (event.data.type === 'SEEK') {
                  video.currentTime = event.data.currentTime;
                }
              });
              
              // Notify parent when video ends
              video.addEventListener('ended', () => {
                window.opener?.postMessage({ type: 'VIDEO_ENDED' }, '*');
              });
              
              // Ready signal
              window.addEventListener('load', () => {
                window.opener?.postMessage({ type: 'POPUP_READY' }, '*');
              });
            </script>
          </body>
          </html>
        `;

        // Calculate popup dimensions
        const popupWidth = Math.max(rect.width, 400);
        const popupHeight = Math.max(rect.height, 300);
        
        toast({
          title: "Opening Export Window",
          description: "Select the video window that appears for recording.",
        });

        // Open popup
        const popup = window.open(
          'about:blank',
          'video-export',
          `width=${popupWidth},height=${popupHeight},left=${screen.width/2 - popupWidth/2},top=${screen.height/2 - popupHeight/2},resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,status=no`
        );

        if (!popup) {
          toast({
            title: "Popup Blocked",
            description: "Please allow popups for this site and try again.",
          });
          reject(new Error('Popup blocked'));
          return;
        }

        // Write HTML to popup
        popup.document.write(popupHtml);
        popup.document.close();

        let popupStream: MediaStream | null = null;
        let recorder: MediaRecorder | null = null;
        let recordingStarted = false;

        // Handle messages from popup
        const messageHandler = async (event: MessageEvent) => {
          if (event.source !== popup) return;

          if (event.data.type === 'POPUP_READY') {
            try {
              // Wait a bit for popup to fully render
              setTimeout(async () => {
                try {
                  // Capture the popup window
                  popupStream = await navigator.mediaDevices.getDisplayMedia({
                    video: { displaySurface: 'window' } as any,
                    audio: false,
                  });

                  toast({
                    title: "Recording Started",
                    description: "Video export in progress...",
                  });

                  // Start recording
                  const chunks: BlobPart[] = [];
                  recorder = new MediaRecorder(popupStream, {
                    mimeType: 'video/webm;codecs=h264',
                    videoBitsPerSecond: 12_000_000
                  });

                  recorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                      chunks.push(event.data);
                    }
                  };

                  recorder.onstop = () => {
                    const blob = new Blob(chunks, { type: 'video/webm' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    a.click();
                    URL.revokeObjectURL(url);

                    toast({
                      title: "Export Complete",
                      description: "Video has been downloaded successfully!",
                    });

                    // Cleanup
                    popup.close();
                    resolve();
                  };

                  recorder.start();
                  recordingStarted = true;

                  // Start video playback in popup
                  popup.postMessage({ 
                    type: 'PLAY', 
                    currentTime: element.currentTime 
                  }, '*');

                } catch (error) {
                  console.error('Failed to capture popup:', error);
                  toast({
                    title: "Capture Failed",
                    description: "Please select the video window when prompted.",
                  });
                  popup.close();
                  reject(error);
                }
              }, 500);
            } catch (error) {
              popup.close();
              reject(error);
            }
          } else if (event.data.type === 'VIDEO_ENDED') {
            if (recorder && recordingStarted) {
              recorder.stop();
            }
          }
        };

        // Cleanup function
        const cleanup = () => {
          window.removeEventListener('message', messageHandler);
          if (popupStream) {
            popupStream.getTracks().forEach(track => track.stop());
          }
          if (popup && !popup.closed) {
            popup.close();
          }
        };

        // Handle popup close
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            cleanup();
            if (!recordingStarted) {
              reject(new Error('Popup was closed before recording started'));
            }
          }
        }, 1000);

        window.addEventListener('message', messageHandler);
        
        // Auto-cleanup after 5 minutes
        setTimeout(() => {
          cleanup();
          if (!recordingStarted) {
            reject(new Error('Popup export timeout'));
          }
        }, 5 * 60 * 1000);

      } catch (error) {
        console.error('Error creating popup export:', error);
        reject(error);
      }
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
    createPopupExport,
  };
};