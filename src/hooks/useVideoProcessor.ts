import { useRef, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export interface VideoProcessingOptions {
  zoom?: number;
  cropX?: number;
  cropY?: number;
  cropWidth?: number;
  cropHeight?: number;
  trimStart?: number;
  trimEnd?: number;
  quality?: 'high' | 'medium' | 'low';
  // New options for UI edits
  videoPadding?: number;
  backgroundColor?: string;
  videoDuration?: number;
}

// Singleton FFmpeg instance
let ffmpegInstance: FFmpeg | null = null;
let isFFmpegLoaded = false;
let loadingPromise: Promise<void> | null = null;

export const useVideoProcessor = () => {
  const loadFFmpeg = useCallback(async () => {
    if (isFFmpegLoaded && ffmpegInstance) return;
    
    if (loadingPromise) {
      await loadingPromise;
      return;
    }

    loadingPromise = (async () => {
      try {
        console.log('Loading FFmpeg...');
        const ffmpeg = new FFmpeg();
        ffmpegInstance = ffmpeg;

        // Try local files first (served by Vite dev server)
        try {
          console.log('Attempting to load FFmpeg from local files...');
          
          const baseURL = '/node_modules/@ffmpeg/core/dist/umd';
          
          await ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
          });
          
          console.log('FFmpeg loaded successfully from local files');
          isFFmpegLoaded = true;
          return;
        } catch (localError) {
          console.warn('Failed to load from local files:', localError);
          
          // Fallback to CDN with matching versions
          const cdnSources = [
            'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd',
            'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd',
          ];

          let loaded = false;
          for (const baseURL of cdnSources) {
            try {
              console.log(`Attempting to load FFmpeg from CDN: ${baseURL}`);
              await ffmpeg.load({
                coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
              });
              loaded = true;
              console.log(`FFmpeg loaded successfully from CDN: ${baseURL}`);
              break;
            } catch (error) {
              console.warn(`Failed to load from CDN ${baseURL}:`, error);
              continue;
            }
          }

          if (!loaded) {
            throw new Error('Failed to load FFmpeg from all sources (local and CDN)');
          }
        }

        isFFmpegLoaded = true;
      } catch (error) {
        console.error('FFmpeg loading failed:', error);
        throw new Error(`FFmpeg loading failed: ${error.message}`);
      }
    })();

    await loadingPromise;
  }, []);

  const processVideo = useCallback(async (
    videoBlob: Blob,
    options: VideoProcessingOptions,
    onProgress?: (progress: number) => void
  ): Promise<Blob> => {
    await loadFFmpeg();
    if (!ffmpegInstance) throw new Error('FFmpeg not loaded');
    const ffmpeg = ffmpegInstance;

    console.log('Processing video with options:', options);

    // Write input video to FFmpeg
    await ffmpeg.writeFile('input.webm', await fetchFile(videoBlob));

    // Build FFmpeg command with background composition
    const args: string[] = [];
    
    // Handle background color and video scaling
    if (options.backgroundColor && options.videoPadding !== undefined) {
      console.log('Applying background and padding');
      // Create colored background
      const backgroundColor = options.backgroundColor.replace('#', '');
      const scale = (100 - options.videoPadding) / 100;
      
      // Determine duration for background
      const duration = options.videoDuration || 30;
      const trimDuration = options.trimEnd && options.trimStart ? 
        options.trimEnd - options.trimStart : duration;
      
      // Create a colored background and scale/overlay the video
      args.push('-f', 'lavfi', '-i', `color=c=${backgroundColor}:size=1920x1080:d=${trimDuration}`);
      args.push('-i', 'input.webm');
      
      // Build filter complex for trimming, scaling, and overlaying
      let filterComplex = '';
      
      // Trim video first if needed
      if (options.trimStart !== undefined && options.trimStart > 0) {
        const trimEnd = options.trimEnd || duration;
        const trimDur = trimEnd - options.trimStart;
        filterComplex += `[1:v]trim=start=${options.trimStart}:duration=${trimDur},setpts=PTS-STARTPTS,`;
        filterComplex += `scale=iw*${scale}:ih*${scale}[scaled];`;
        
        // Audio trimming
        filterComplex += `[1:a]atrim=start=${options.trimStart}:duration=${trimDur},asetpts=PTS-STARTPTS[audio];`;
      } else {
        filterComplex += `[1:v]scale=iw*${scale}:ih*${scale}[scaled];`;
        filterComplex += `[1:a]acopy[audio];`;
      }
      
      // Overlay scaled video on background (centered)
      filterComplex += `[0:v][scaled]overlay=(W-w)/2:(H-h)/2[v]`;
      
      args.push('-filter_complex', filterComplex);
      args.push('-map', '[v]');
      args.push('-map', '[audio]');
    } else {
      // Simple processing without background
      args.push('-i', 'input.webm');
      
      const filters: string[] = [];
      
      // Trim video
      if (options.trimStart !== undefined && options.trimStart > 0) {
        args.push('-ss', `${options.trimStart}`);
      }
      
      if (options.trimEnd !== undefined && options.trimStart !== undefined) {
        const trimDuration = options.trimEnd - options.trimStart;
        args.push('-t', `${trimDuration}`);
      }
      
      // Apply video filters if any
      if (filters.length > 0) {
        args.push('-vf', filters.join(','));
      }
    }
    
    // Quality settings
    const quality = options.quality || 'high';
    if (quality === 'high') {
      args.push('-crf', '18');
    } else if (quality === 'medium') {
      args.push('-crf', '23');
    } else {
      args.push('-crf', '28');
    }
    
    args.push('-c:v', 'libvpx-vp9', '-c:a', 'libopus', 'output.webm');

    console.log('FFmpeg command:', args.join(' '));

    // Set up progress monitoring
    if (onProgress) {
      ffmpeg.on('progress', (event) => {
        console.log('FFmpeg progress:', event.progress);
        onProgress(event.progress * 100);
      });
    }

    // Execute FFmpeg command
    await ffmpeg.exec(args);
    
    // Read the output
    const data = await ffmpeg.readFile('output.webm');
    
    // Clean up
    await ffmpeg.deleteFile('input.webm');
    await ffmpeg.deleteFile('output.webm');
    
    console.log('Video processing completed');
    return new Blob([data], { type: 'video/webm' });
  }, [loadFFmpeg]);

  const extractThumbnail = useCallback(async (videoBlob: Blob, timeSeconds: number = 0): Promise<string> => {
    await loadFFmpeg();
    if (!ffmpegInstance) throw new Error('FFmpeg not loaded');
    const ffmpeg = ffmpegInstance;

    await ffmpeg.writeFile('input.webm', await fetchFile(videoBlob));
    
    await ffmpeg.exec([
      '-i', 'input.webm',
      '-ss', `${timeSeconds}`,
      '-vframes', '1',
      '-f', 'image2',
      'thumbnail.jpg'
    ]);
    
    const data = await ffmpeg.readFile('thumbnail.jpg');
    
    await ffmpeg.deleteFile('input.webm');
    await ffmpeg.deleteFile('thumbnail.jpg');
    
    const blob = new Blob([data], { type: 'image/jpeg' });
    return URL.createObjectURL(blob);
  }, [loadFFmpeg]);

  const getVideoDuration = useCallback(async (videoBlob: Blob): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.onloadedmetadata = () => {
        resolve(video.duration);
        URL.revokeObjectURL(video.src);
      };
      video.src = URL.createObjectURL(videoBlob);
    });
  }, []);

  return {
    processVideo,
    extractThumbnail,
    getVideoDuration,
    loadFFmpeg
  };
};
