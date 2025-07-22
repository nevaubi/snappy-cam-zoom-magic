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
  videoPadding?: number;
  backgroundColor?: string;
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

        // Multiple CDN fallbacks for reliability - using version 0.12.10 (actual latest WebAssembly version)
        const cdnOptions = [
          'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd',
          'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd',
          'https://cdnjs.cloudflare.com/ajax/libs/ffmpeg-core/0.12.10/umd'
        ];

        let loadSuccess = false;
        let lastError: Error | null = null;

        for (const baseURL of cdnOptions) {
          try {
            console.log(`Attempting to load FFmpeg from: ${baseURL}`);
            console.log(`Loading @ffmpeg/core version 0.12.10 (WebAssembly version)`);
            
            await ffmpeg.load({
              coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
              wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
            });

            loadSuccess = true;
            console.log(`FFmpeg loaded successfully from: ${baseURL}`);
            console.log(`Successfully loaded @ffmpeg/core@0.12.10 WebAssembly version`);
            break;
          } catch (error) {
            console.warn(`Failed to load from ${baseURL}:`, error);
            lastError = error instanceof Error ? error : new Error(String(error));
            continue;
          }
        }

        if (!loadSuccess) {
          throw new Error(`Failed to load FFmpeg from all CDNs. Last error: ${lastError?.message || 'Unknown error'}`);
        }

        isFFmpegLoaded = true;
      } catch (error) {
        console.error('FFmpeg loading failed:', error);
        throw new Error(`Failed to load FFmpeg: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

    // Write input video to FFmpeg
    await ffmpeg.writeFile('input.webm', await fetchFile(videoBlob));

    // Build FFmpeg command
    const args = ['-i', 'input.webm'];
    
    // Get video dimensions first for accurate processing
    const tempVideo = document.createElement('video');
    tempVideo.src = URL.createObjectURL(videoBlob);
    await new Promise((resolve) => {
      tempVideo.onloadedmetadata = () => resolve(null);
    });
    
    const videoWidth = tempVideo.videoWidth || 1920;
    const videoHeight = tempVideo.videoHeight || 1080;
    URL.revokeObjectURL(tempVideo.src);
    
    console.log('Processing video with dimensions:', videoWidth, 'x', videoHeight);
    console.log('Processing options:', options);

    // Video filters
    const filters: string[] = [];
    
    // Crop filter
    if (options.cropX !== undefined && options.cropY !== undefined && 
        options.cropWidth !== undefined && options.cropHeight !== undefined) {
      const cropW = Math.round(videoWidth * (options.cropWidth / 100));
      const cropH = Math.round(videoHeight * (options.cropHeight / 100));
      const cropX = Math.round(videoWidth * (options.cropX / 100));
      const cropY = Math.round(videoHeight * (options.cropY / 100));
      filters.push(`crop=${cropW}:${cropH}:${cropX}:${cropY}`);
    }
    
    // Zoom filter (scale)
    if (options.zoom && options.zoom !== 1) {
      const scale = Math.round(videoWidth * options.zoom);
      filters.push(`scale=${scale}:${Math.round(scale * (videoHeight/videoWidth))}`);
    }
    
    // Padding filter - add padding around video with background color
    if (options.videoPadding && options.videoPadding > 0) {
      const padding = options.videoPadding;
      const bgColor = options.backgroundColor || '#000000';
      // Convert hex color to FFmpeg format (remove # and ensure 6 chars)
      const ffmpegColor = bgColor.replace('#', '').padEnd(6, '0');
      console.log('Adding padding:', padding, 'with background color:', ffmpegColor);
      filters.push(`pad=${videoWidth + 2*padding}:${videoHeight + 2*padding}:${padding}:${padding}:0x${ffmpegColor}`);
    }
    
    if (filters.length > 0) {
      args.push('-vf', filters.join(','));
    }
    
    // Trim video
    if (options.trimStart !== undefined && options.trimStart > 0) {
      args.push('-ss', `${options.trimStart}s`);
    }
    
    if (options.trimEnd !== undefined && options.trimEnd < 100) {
      // Calculate duration - this would need the original video duration
      // For now, we'll just cut at the end time
      args.push('-t', `${options.trimEnd}s`);
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

    // Set up progress monitoring
    if (onProgress) {
      ffmpeg.on('progress', (event) => {
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
