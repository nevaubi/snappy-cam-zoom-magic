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
  // Enhanced options for complete visual fidelity
  padding?: number;
  cornerRadius?: number;
  backgroundColor?: string;
  backgroundImage?: string | null;
  backgroundImageFit?: 'cover' | 'contain' | 'fill';
  zoomEffects?: ZoomEffect[];
  outputWidth?: number;
  outputHeight?: number;
}

export interface ZoomEffect {
  id: string;
  startTime: number;
  endTime: number;
  zoomAmount: number;
  zoomSpeed: number;
  targetX: number;
  targetY: number;
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

        // Multiple CDN fallbacks with correct version
        const cdnUrls = [
          'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd',
          'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd',
          'https://cdnjs.cloudflare.com/ajax/libs/ffmpeg.js/0.12.10/umd'
        ];

        let lastError: Error | null = null;
        
        for (const baseURL of cdnUrls) {
          try {
            console.log(`Trying to load FFmpeg from: ${baseURL}`);
            await ffmpeg.load({
              coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
              wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
            });
            
            isFFmpegLoaded = true;
            console.log('FFmpeg loaded successfully from:', baseURL);
            return;
          } catch (error) {
            console.warn(`Failed to load from ${baseURL}:`, error);
            lastError = error as Error;
            continue;
          }
        }

        throw new Error(`Failed to load FFmpeg from all CDN sources. Last error: ${lastError?.message}`);
      } catch (error) {
        console.error('FFmpeg loading failed completely:', error);
        ffmpegInstance = null;
        isFFmpegLoaded = false;
        loadingPromise = null;
        throw error;
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

    // Get video metadata first
    const videoElement = document.createElement('video');
    videoElement.src = URL.createObjectURL(videoBlob);
    await new Promise((resolve) => {
      videoElement.onloadedmetadata = resolve;
    });
    
    const originalWidth = videoElement.videoWidth;
    const originalHeight = videoElement.videoHeight;
    const videoDuration = videoElement.duration;
    URL.revokeObjectURL(videoElement.src);

    // Output dimensions
    const outputWidth = options.outputWidth || 1920;
    const outputHeight = options.outputHeight || 1080;

    // Write input video to FFmpeg
    await ffmpeg.writeFile('input.webm', await fetchFile(videoBlob));

    // Handle background image if provided
    if (options.backgroundImage && options.backgroundImage.startsWith('data:')) {
      const backgroundBlob = await fetch(options.backgroundImage).then(r => r.blob());
      await ffmpeg.writeFile('background.jpg', await fetchFile(backgroundBlob));
    }

    // Build complex filter graph
    const filterParts: string[] = [];
    let videoInput = '[0:v]';

    // Apply trim timing first (seeking and duration)
    const trimStart = options.trimStart || 0;
    let trimDuration = videoDuration;
    if (options.trimEnd && options.trimEnd > trimStart) {
      trimDuration = options.trimEnd - trimStart;
    }

    // Create background layer
    let backgroundInput = '';
    if (options.backgroundImage && options.backgroundImage.startsWith('data:')) {
      // Scale background image to output size
      backgroundInput = `[1:v]scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=increase,crop=${outputWidth}:${outputHeight}[bg];`;
    } else {
      // Create solid color background
      const bgColor = options.backgroundColor || '#000000';
      backgroundInput = `color=c=${bgColor}:size=${outputWidth}x${outputHeight}:duration=${trimDuration}[bg];`;
    }
    filterParts.push(backgroundInput);

    // Apply crop to original video if specified
    if (options.cropX !== undefined && options.cropY !== undefined && 
        options.cropWidth !== undefined && options.cropHeight !== undefined) {
      const cropW = Math.round(originalWidth * (options.cropWidth / 100));
      const cropH = Math.round(originalHeight * (options.cropHeight / 100));
      const cropX = Math.round(originalWidth * (options.cropX / 100));
      const cropY = Math.round(originalHeight * (options.cropY / 100));
      filterParts.push(`${videoInput}crop=${cropW}:${cropH}:${cropX}:${cropY}[cropped];`);
      videoInput = '[cropped]';
    }

    // Apply zoom effects if present
    if (options.zoomEffects && options.zoomEffects.length > 0) {
      const zoomFilters = generateZoomFilters(options.zoomEffects, videoDuration, originalWidth, originalHeight);
      if (zoomFilters) {
        filterParts.push(`${videoInput}${zoomFilters}[zoomed];`);
        videoInput = '[zoomed]';
      }
    }

    // Calculate video dimensions with padding
    const padding = options.padding || 0;
    const paddingPx = Math.round((padding / 100) * Math.min(outputWidth, outputHeight));
    const videoWidth = outputWidth - (paddingPx * 2);
    const videoHeight = outputHeight - (paddingPx * 2);

    // Scale video to fit within padded area
    filterParts.push(`${videoInput}scale=${videoWidth}:${videoHeight}:force_original_aspect_ratio=decrease[scaled];`);

    // Apply corner radius if specified
    if (options.cornerRadius && options.cornerRadius > 0) {
      const radius = options.cornerRadius;
      // Create rounded corner mask
      filterParts.push(`[scaled]geq='if(lte(lum(X,Y),16),0,255)':128:128[rounded];`);
      videoInput = '[rounded]';
    } else {
      videoInput = '[scaled]';
    }

    // Overlay video on background with padding
    filterParts.push(`[bg]${videoInput}overlay=(W-w)/2:(H-h)/2[final]`);

    // Build FFmpeg command
    const args = ['-i', 'input.webm'];
    
    // Add background image input if present
    if (options.backgroundImage && options.backgroundImage.startsWith('data:')) {
      args.push('-i', 'background.jpg');
    }

    // Add seek and duration
    args.push('-ss', `${trimStart}s`);
    args.push('-t', `${trimDuration}s`);

    // Add complex filter
    args.push('-filter_complex', filterParts.join(''));
    args.push('-map', '[final]');
    args.push('-map', '0:a?'); // Copy audio if present

    // Quality settings
    const quality = options.quality || 'high';
    if (quality === 'high') {
      args.push('-crf', '18');
    } else if (quality === 'medium') {
      args.push('-crf', '23');
    } else {
      args.push('-crf', '28');
    }
    
    args.push('-c:v', 'libx264', '-preset', 'medium', '-c:a', 'aac', 'output.mp4');

    // Set up progress monitoring
    if (onProgress) {
      ffmpeg.on('progress', (event) => {
        onProgress(event.progress * 100);
      });
    }

    console.log('FFmpeg command:', args.join(' '));
    
    // Execute FFmpeg command
    await ffmpeg.exec(args);
    
    // Read the output
    const data = await ffmpeg.readFile('output.mp4');
    
    // Clean up
    await ffmpeg.deleteFile('input.webm');
    await ffmpeg.deleteFile('output.mp4');
    if (options.backgroundImage && options.backgroundImage.startsWith('data:')) {
      await ffmpeg.deleteFile('background.jpg');
    }
    
    return new Blob([data], { type: 'video/mp4' });
  }, [loadFFmpeg]);

  // Helper function to generate zoom effect filters
  const generateZoomFilters = (zoomEffects: ZoomEffect[], duration: number, width: number, height: number): string => {
    if (!zoomEffects.length) return '';
    
    const zoomExpressions: string[] = [];
    
    for (const effect of zoomEffects) {
      const startTime = effect.startTime;
      const endTime = effect.endTime;
      const zoom = effect.zoomAmount;
      const targetX = (effect.targetX / 7) * width; // Convert from grid to pixels
      const targetY = (effect.targetY / 7) * height;
      
      // Create time-based zoom expression
      const timeCondition = `between(t,${startTime},${endTime})`;
      const zoomFactor = `${zoom}`;
      const zoomExpression = `if(${timeCondition},${zoomFactor},1)`;
      zoomExpressions.push(zoomExpression);
    }
    
    if (zoomExpressions.length === 0) return '';
    
    const combinedZoom = zoomExpressions.join('+') + `-${zoomExpressions.length - 1}`;
    return `scale=iw*max(1,(${combinedZoom})):ih*max(1,(${combinedZoom}))`;
  };

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