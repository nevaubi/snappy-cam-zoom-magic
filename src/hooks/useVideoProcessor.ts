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

        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });

        isFFmpegLoaded = true;
        console.log('FFmpeg loaded successfully');
      } catch (error) {
        console.error('FFmpeg loading failed:', error);
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

    // Write input video to FFmpeg
    await ffmpeg.writeFile('input.webm', await fetchFile(videoBlob));

    // Build FFmpeg command
    const args = ['-i', 'input.webm'];
    
    // Video filters
    const filters: string[] = [];
    
    // Crop filter
    if (options.cropX !== undefined && options.cropY !== undefined && 
        options.cropWidth !== undefined && options.cropHeight !== undefined) {
      const cropW = Math.round(1920 * (options.cropWidth / 100));
      const cropH = Math.round(1080 * (options.cropHeight / 100));
      const cropX = Math.round(1920 * (options.cropX / 100));
      const cropY = Math.round(1080 * (options.cropY / 100));
      filters.push(`crop=${cropW}:${cropH}:${cropX}:${cropY}`);
    }
    
    // Zoom filter (scale)
    if (options.zoom && options.zoom !== 1) {
      const scale = Math.round(1920 * options.zoom);
      filters.push(`scale=${scale}:${Math.round(scale * 9/16)}`);
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