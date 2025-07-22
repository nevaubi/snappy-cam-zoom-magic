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

        // Try self-hosted files first
        try {
          console.log('Attempting to load from self-hosted files...');
          const baseURL = '/ffmpeg';
          
          await ffmpeg.load({
            coreURL: `${baseURL}/ffmpeg-core.js`,
            wasmURL: `${baseURL}/ffmpeg-core.wasm`,
            workerURL: `${baseURL}/ffmpeg-core.worker.js`,
          });
          
          isFFmpegLoaded = true;
          console.log('FFmpeg loaded successfully from self-hosted files');
          return;
        } catch (selfHostedError) {
          console.warn('Self-hosted FFmpeg files not available, trying CDN fallbacks...');
        }

        // CDN fallbacks with correct version and paths
        const cdnConfigs = [
          {
            name: 'UNPKG ESM',
            coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js',
            wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm',
            workerURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.worker.js'
          },
          {
            name: 'jsDelivr ESM',
            coreURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js',
            wasmURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm',
            workerURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.worker.js'
          },
          {
            name: 'UNPKG UMD',
            baseURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
          }
        ];

        let lastError: Error | null = null;
        
        for (const config of cdnConfigs) {
          try {
            console.log(`Trying to load FFmpeg from: ${config.name}`);
            
            if (config.baseURL) {
              // UMD version with toBlobURL
              await ffmpeg.load({
                coreURL: await toBlobURL(`${config.baseURL}/ffmpeg-core.js`, 'text/javascript'),
                wasmURL: await toBlobURL(`${config.baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
              });
            } else {
              // ESM version with direct URLs
              await ffmpeg.load({
                coreURL: config.coreURL!,
                wasmURL: config.wasmURL!,
                workerURL: config.workerURL!,
              });
            }
            
            isFFmpegLoaded = true;
            console.log('FFmpeg loaded successfully from:', config.name);
            return;
          } catch (error) {
            console.warn(`Failed to load from ${config.name}:`, error);
            lastError = error as Error;
            continue;
          }
        }

        // All loading attempts failed
        ffmpegInstance = null;
        isFFmpegLoaded = false;
        loadingPromise = null;
        
        const errorMessage = lastError?.message?.includes('CORS') 
          ? 'Unable to load video processing library due to network restrictions. Please refresh the page or try a different browser.'
          : lastError?.message?.includes('404') || lastError?.message?.includes('Failed to fetch')
          ? 'Video processing library temporarily unavailable. Please try again later.'
          : 'Unable to load video processing library. Please refresh the page or try a different browser.';
          
        throw new Error(errorMessage);
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

    console.log('🎬 Starting video processing with options:', options);

    const inputFileName = 'input.mp4';
    const outputFileName = 'output.mp4';

    try {
      // Write input file
      await ffmpeg.writeFile(inputFileName, await fetchFile(videoBlob));

      // Output dimensions
      const width = options.outputWidth || 1920;
      const height = options.outputHeight || 1080;

      // Start with simple, working filter chain
      let filterParts: string[] = [];
      let videoStream = '[0:v]';

      // 1. Handle trimming with proper timing
      const trimStart = options.trimStart || 0;
      const trimEnd = options.trimEnd || 9999;
      
      if (trimStart > 0 || trimEnd < 9999) {
        const duration = trimEnd - trimStart;
        console.log(`📏 Trimming: ${trimStart}s to ${trimEnd}s (duration: ${duration}s)`);
        filterParts.push(`${videoStream}trim=start=${trimStart}:duration=${duration},setpts=PTS-STARTPTS[trimmed]`);
        videoStream = '[trimmed]';
      }

      // 2. Apply crop if needed (only if significantly different from default)
      const hasSignificantCrop = options.cropX !== undefined && options.cropY !== undefined && 
          options.cropWidth !== undefined && options.cropHeight !== undefined &&
          (Math.abs(options.cropX || 0) > 1 || Math.abs(options.cropY || 0) > 1 || 
           Math.abs((options.cropWidth || 100) - 100) > 1 || Math.abs((options.cropHeight || 100) - 100) > 1);

      if (hasSignificantCrop) {
        console.log(`✂️ Cropping: ${options.cropX}%, ${options.cropY}%, ${options.cropWidth}% x ${options.cropHeight}%`);
        filterParts.push(`${videoStream}crop=iw*${(options.cropWidth || 100)/100}:ih*${(options.cropHeight || 100)/100}:iw*${(options.cropX || 0)/100}:ih*${(options.cropY || 0)/100}[cropped]`);
        videoStream = '[cropped]';
      }

      // 3. Scale video to fit output dimensions while maintaining aspect ratio
      console.log(`📐 Scaling to ${width}x${height}`);
      filterParts.push(`${videoStream}scale=${width}:${height}:force_original_aspect_ratio=decrease[scaled]`);
      videoStream = '[scaled]';

      // 4. Create background and overlay
      const bgColor = options.backgroundColor || '#000000';
      const cleanBgColor = bgColor.replace('#', '');
      console.log(`🎨 Background color: ${cleanBgColor}`);
      
      if (options.backgroundImage && options.backgroundImage.startsWith('data:')) {
        console.log('🖼️ Using background image');
        const bgFileName = 'bg.jpg';
        try {
          const response = await fetch(options.backgroundImage);
          const bgBlob = await response.blob();
          await ffmpeg.writeFile(bgFileName, await fetchFile(bgBlob));
          
          // Create background from image and overlay video
          filterParts.push(`[1:v]scale=${width}:${height}[bg]`);
          filterParts.push(`[bg]${videoStream}overlay=(W-w)/2:(H-h)/2[final]`);
        } catch (bgError) {
          console.warn('Failed to load background image, using color instead:', bgError);
          filterParts.push(`color=c=${cleanBgColor}:size=${width}x${height}[bg]`);
          filterParts.push(`[bg]${videoStream}overlay=(W-w)/2:(H-h)/2[final]`);
        }
      } else {
        // Use solid color background
        filterParts.push(`color=c=${cleanBgColor}:size=${width}x${height}[bg]`);
        filterParts.push(`[bg]${videoStream}overlay=(W-w)/2:(H-h)/2[final]`);
      }

      const filterComplex = filterParts.join('; ');
      console.log('🔧 Filter complex:', filterComplex);
      
      // Build FFmpeg command args
      const args = [
        '-i', inputFileName,
        ...(options.backgroundImage && options.backgroundImage.startsWith('data:') ? ['-i', 'bg.jpg'] : []),
        '-filter_complex', filterComplex,
        '-map', '[final]',
        '-map', '0:a?', // Copy audio if present
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-y',
        outputFileName
      ];

      console.log('🚀 FFmpeg command:', args.join(' '));

      // Execute FFmpeg
      await ffmpeg.exec(args);

      console.log('✅ FFmpeg processing completed');

      // Read output file
      const data = await ffmpeg.readFile(outputFileName);
      
      // Cleanup
      await ffmpeg.deleteFile(inputFileName);
      await ffmpeg.deleteFile(outputFileName);
      if (options.backgroundImage && options.backgroundImage.startsWith('data:')) {
        try {
          await ffmpeg.deleteFile('bg.jpg');
        } catch (e) {
          console.warn('Could not delete bg.jpg:', e);
        }
      }

      console.log('🎉 Video processing successful, output size:', (data as Uint8Array).length);
      return new Blob([data], { type: 'video/mp4' });
    } catch (error) {
      console.error('❌ Video processing error:', error);
      throw error;
    }
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