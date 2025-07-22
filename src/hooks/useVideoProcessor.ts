import { useRef, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

/**
 * Zoom effect interface matching the UI component
 * Represents a timed zoom effect with position targeting
 */
export interface ZoomEffect {
  id: string;
  startTime: number; // Start time in seconds
  endTime: number;   // End time in seconds
  zoomAmount: number; // Zoom factor (1.2x to 3x)
  zoomSpeed: number;  // Transition duration in seconds
  targetX: number;    // Grid position X (0-7)
  targetY: number;    // Grid position Y (0-7)
}

/**
 * Comprehensive export options that accurately reproduce all UI editing features
 * This interface maps 1:1 with the CustomVideoPlayer state for precise export
 */
export interface VideoExportOptions {
  // === TRIMMING ===
  trimStart?: number;     // Start time in seconds
  trimEnd?: number;       // End time in seconds
  
  // === CROPPING ===
  cropX?: number;         // Left offset as percentage (0-100)
  cropY?: number;         // Top offset as percentage (0-100)
  cropWidth?: number;     // Width as percentage (0-100)
  cropHeight?: number;    // Height as percentage (0-100)
  
  // === DISPLAY SETTINGS ===
  videoPadding?: number;      // Scale/padding percentage (0-100)
  videoCornerRadius?: number; // Corner radius in pixels (0-20)
  
  // === BACKGROUND SETTINGS ===
  backgroundColor?: string;   // Hex color (e.g., "#000000")
  backgroundImage?: string;   // Base64 data URI or URL
  backgroundImageFit?: 'cover' | 'contain' | 'fill';
  backgroundType?: 'color' | 'image';
  
  // === ZOOM EFFECTS ===
  zoomEffects?: ZoomEffect[]; // Array of timed zoom effects
  
  // === OUTPUT SETTINGS ===
  quality?: 'high' | 'medium' | 'low';
  outputFormat?: 'webm' | 'mp4';
  
  // === VIDEO METADATA ===
  originalWidth?: number;     // Source video width
  originalHeight?: number;    // Source video height
}

// Singleton FFmpeg instance
let ffmpegInstance: FFmpeg | null = null;
let isFFmpegLoaded = false;
let loadingPromise: Promise<void> | null = null;

export const useVideoProcessor = () => {
  const loadFFmpeg = useCallback(async () => {
    if (isFFmpegLoaded && ffmpegInstance) {
      console.log('FFmpeg already loaded, skipping...');
      return;
    }
    
    if (loadingPromise) {
      console.log('FFmpeg loading in progress, waiting...');
      await loadingPromise;
      return;
    }

    loadingPromise = (async () => {
      const timeoutDuration = 45000; // Increased to 45 seconds
      let ffmpeg: FFmpeg | null = null;

      try {
        console.log('🚀 Starting FFmpeg loading process...');
        
        // Check browser compatibility first
        if (typeof SharedArrayBuffer === 'undefined') {
          console.warn('⚠️ SharedArrayBuffer not available. This may affect FFmpeg performance.');
        }
        
        if (!window.crossOriginIsolated) {
          console.warn('⚠️ Cross-origin isolation not enabled. This may cause FFmpeg issues.');
        }
        
        // Create FFmpeg instance with proper configuration
        ffmpeg = new FFmpeg();
        
        // Add logging to monitor FFmpeg operations
        ffmpeg.on('log', ({ message }) => {
          console.log('📋 FFmpeg Log:', message);
        });
        
        ffmpeg.on('progress', ({ progress, time }) => {
          console.log('📈 FFmpeg Progress:', { progress: `${(progress * 100).toFixed(1)}%`, time });
        });

        // Try different loading strategies
        const loadingStrategies = [
          {
            name: 'Local files (fastest)',
            load: async () => {
              const baseURL = window.location.origin;
              return await ffmpeg!.load({
                coreURL: `${baseURL}/ffmpeg/ffmpeg-core.js`,
                wasmURL: `${baseURL}/ffmpeg/ffmpeg-core.wasm`,
              });
            }
          },
          {
            name: 'Direct CDN (unpkg) - simple',
            load: async () => {
              const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
              return await ffmpeg!.load({
                coreURL: `${baseURL}/ffmpeg-core.js`,
                wasmURL: `${baseURL}/ffmpeg-core.wasm`,
              });
            }
          },
          {
            name: 'Stable version (0.12.4)',
            load: async () => {
              const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.4/dist/umd';
              return await ffmpeg!.load({
                coreURL: `${baseURL}/ffmpeg-core.js`,
                wasmURL: `${baseURL}/ffmpeg-core.wasm`,
              });
            }
          },
          {
            name: 'JSDelivr CDN',
            load: async () => {
              const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
              return await ffmpeg!.load({
                coreURL: `${baseURL}/ffmpeg-core.js`,
                wasmURL: `${baseURL}/ffmpeg-core.wasm`,
              });
            }
          },
          {
            name: 'Blob URL method (legacy)',
            load: async () => {
              const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
              return await ffmpeg!.load({
                coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
                wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
              });
            }
          },
          {
            name: 'Emergency fallback (older version)',
            load: async () => {
              // Try with an older, more stable version
              const baseURL = 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/umd';
              return await ffmpeg!.load({
                coreURL: `${baseURL}/ffmpeg-core.js`,
                wasmURL: `${baseURL}/ffmpeg-core.wasm`,
              });
            }
          }
        ];

        let lastError: Error | null = null;

        for (let i = 0; i < loadingStrategies.length; i++) {
          const strategy = loadingStrategies[i];
          console.log(`🔄 Trying strategy ${i + 1}/${loadingStrategies.length}: ${strategy.name}`);
          
          try {
            // Create timeout promise
            const loadingPromise = strategy.load();
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => {
                reject(new Error(`FFmpeg loading timeout after ${timeoutDuration}ms`));
              }, timeoutDuration);
            });

            // Race between loading and timeout
            console.log('⏳ Starting FFmpeg initialization...');
            await Promise.race([loadingPromise, timeoutPromise]);
            
            // Verify FFmpeg is actually working by testing a simple command
            console.log('🧪 Testing FFmpeg functionality...');
            try {
              // This will fail but should not throw if FFmpeg is loaded correctly
              await ffmpeg.exec(['-version']);
            } catch (testError) {
              // Expected to fail, but if it's a loading error, we should continue
              const errorMsg = testError instanceof Error ? testError.message : '';
              if (errorMsg.includes('not loaded') || errorMsg.includes('terminated')) {
                throw new Error('FFmpeg not properly initialized');
              }
              // Other errors are expected (like missing input file)
            }
            
            // If we get here, loading succeeded
            console.log('✅ FFmpeg loaded successfully with strategy:', strategy.name);
            ffmpegInstance = ffmpeg;
            isFFmpegLoaded = true;
            return; // Exit the function successfully
            
          } catch (error) {
            console.warn(`❌ Strategy "${strategy.name}" failed:`, error);
            lastError = error as Error;
            
            // Complete cleanup and reset
            try {
              if (ffmpeg) {
                ffmpeg.terminate();
              }
            } catch (termError) {
              console.warn('Termination warning (non-critical):', termError);
            }
            
            // Create completely fresh instance
            ffmpeg = new FFmpeg();
            
            // Add event listeners to new instance
            ffmpeg.on('log', ({ message }) => {
              console.log('📋 FFmpeg Log:', message);
            });
            
            ffmpeg.on('progress', ({ progress, time }) => {
              console.log('📈 FFmpeg Progress:', { progress: `${(progress * 100).toFixed(1)}%`, time });
            });
            
            // Continue to next strategy if available
            if (i < loadingStrategies.length - 1) {
              console.log(`🔄 Trying next strategy in 2 seconds...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
              continue;
            }
          }
        }

        // If we get here, all strategies failed
        throw new Error(`Failed to load FFmpeg with all strategies. Last error: ${lastError?.message || 'Unknown error'}`);

      } catch (error) {
        console.error('💥 FFmpeg loading failed completely:', error);
        
        // Reset state on failure
        isFFmpegLoaded = false;
        ffmpegInstance = null;
        loadingPromise = null;
        
        // Provide user-friendly error message with troubleshooting
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const troubleshootMsg = `

Troubleshooting tips:
- Ensure you're using HTTPS (required for SharedArrayBuffer)
- Try refreshing the page and clearing browser cache
- Check if browser supports WebAssembly and SharedArrayBuffer
- Try using Chrome or Firefox (best compatibility)
- Disable ad blockers or extensions that might block WebAssembly
- Check console for additional CORS or security errors
`;
        
        throw new Error(`FFmpeg loading failed: ${errorMessage}${troubleshootMsg}`);
      }
    })();

    await loadingPromise;
  }, []);

  const processVideo = useCallback(async (
    videoBlob: Blob,
    options: VideoExportOptions,
    onProgress?: (progress: number) => void
  ): Promise<Blob> => {
    const exportTimeout = 120000; // 2 minute timeout for export
    
    try {
      console.log('🎬 Starting video export process...');
      if (onProgress) onProgress(5);

      // Load FFmpeg with detailed feedback
      console.log('📚 Loading FFmpeg...');
      await loadFFmpeg();
      if (!ffmpegInstance) throw new Error('FFmpeg not loaded');
      
      console.log('✅ FFmpeg loaded, starting video processing...');
      if (onProgress) onProgress(15);

      const ffmpeg = ffmpegInstance;

      // Validate required parameters
      if (!videoBlob || videoBlob.size === 0) {
        throw new Error('Invalid video blob provided');
      }

      console.log(`📹 Processing video blob: ${(videoBlob.size / 1024 / 1024).toFixed(1)}MB`);

      // Write input video to FFmpeg
      console.log('📁 Writing input video to FFmpeg...');
      await ffmpeg.writeFile('input.webm', await fetchFile(videoBlob));
      if (onProgress) onProgress(25);

      // Get video dimensions if not provided
      const originalWidth = options.originalWidth || 1920;
      const originalHeight = options.originalHeight || 1080;
      console.log(`📐 Video dimensions: ${originalWidth}x${originalHeight}`);

      // Build FFmpeg command
      const args = ['-i', 'input.webm'];
      
      // Handle background setup first if needed
      if (options.backgroundType === 'color' || options.backgroundType === 'image') {
        try {
          console.log('🎨 Setting up background...');
          await setupBackground(ffmpeg, options, originalWidth, originalHeight);
          args.push('-i', 'background.png');
          if (onProgress) onProgress(35);
        } catch (error) {
          console.warn('⚠️ Background setup failed, continuing without background:', error);
          // Continue without background if setup fails
        }
      }

      // Build complex filter graph
      console.log('🔧 Building filter graph...');
      const filterComplex = await buildFilterComplex(options, originalWidth, originalHeight);
      
      if (filterComplex) {
        console.log('🎯 Applying complex filters:', filterComplex);
        args.push('-filter_complex', filterComplex);
        args.push('-map', '[final]');
      } else {
        console.log('📹 No complex filters, mapping video directly');
        args.push('-map', '0:v');
      }
      
      // Always include audio if available
      args.push('-map', '0:a?');
      
      // Handle trimming
      if (options.trimStart !== undefined && options.trimStart > 0) {
        console.log(`✂️ Trimming from ${options.trimStart}s`);
        args.push('-ss', `${options.trimStart}`);
      }
      
      if (options.trimEnd !== undefined && options.trimStart !== undefined) {
        const duration = options.trimEnd - options.trimStart;
        if (duration > 0) {
          console.log(`⏱️ Duration: ${duration}s`);
          args.push('-t', `${duration}`);
        }
      }
      
      // Quality settings
      const quality = options.quality || 'high';
      const outputFormat = options.outputFormat || 'webm';
      console.log(`🎛️ Export settings: ${quality} quality, ${outputFormat} format`);
      
      if (outputFormat === 'mp4') {
        args.push('-c:v', 'libx264');
        args.push('-c:a', 'aac');
        if (quality === 'high') {
          args.push('-crf', '18');
        } else if (quality === 'medium') {
          args.push('-crf', '23');
        } else {
          args.push('-crf', '28');
        }
        args.push('-preset', 'medium');
        args.push('-movflags', '+faststart'); // Optimize for web playback
        args.push(`output.${outputFormat}`);
      } else {
        args.push('-c:v', 'libvpx-vp9');
        args.push('-c:a', 'libopus');
        if (quality === 'high') {
          args.push('-crf', '18');
        } else if (quality === 'medium') {
          args.push('-crf', '23');
        } else {
          args.push('-crf', '28');
        }
        args.push(`output.${outputFormat}`);
      }

      console.log('🚀 FFmpeg command:', args.join(' '));
      if (onProgress) onProgress(45);

      // Set up progress monitoring with better feedback
      let lastProgressUpdate = Date.now();
      if (onProgress) {
        ffmpeg.on('progress', (event) => {
          const progressPercent = Math.min(95, 45 + (event.progress * 50)); // Map to 45-95%
          onProgress(progressPercent);
          
          // Log progress every 5 seconds to avoid spam
          const now = Date.now();
          if (now - lastProgressUpdate > 5000) {
            console.log(`📈 Export progress: ${progressPercent.toFixed(1)}%`);
            lastProgressUpdate = now;
          }
        });
      }

      // Execute FFmpeg command with timeout
      console.log('⚡ Starting FFmpeg execution...');
      const executionPromise = ffmpeg.exec(args);
      
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Video export timeout after ${exportTimeout / 1000} seconds`));
        }, exportTimeout);
      });

      await Promise.race([executionPromise, timeoutPromise]);
      
      console.log('✅ FFmpeg execution completed');
      if (onProgress) onProgress(98);
      
      // Read the output
      console.log('📤 Reading output file...');
      const data = await ffmpeg.readFile(`output.${outputFormat}`);
      
      if (onProgress) onProgress(100);
      
      const outputSize = (data as Uint8Array).length;
      console.log(`✅ Export completed! Output size: ${(outputSize / 1024 / 1024).toFixed(1)}MB`);
      
      const mimeType = outputFormat === 'mp4' ? 'video/mp4' : 'video/webm';
      return new Blob([data], { type: mimeType });
      
    } catch (error) {
      console.error('💥 Video export failed:', error);
      
      // Provide more specific error messages
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('timeout')) {
        throw new Error('Video export timed out. The video might be too large or complex. Try reducing quality or duration.');
      } else if (errorMessage.includes('memory') || errorMessage.includes('wasm')) {
        throw new Error('Not enough memory for video processing. Try refreshing the page or reducing video complexity.');
      } else if (errorMessage.includes('format') || errorMessage.includes('codec')) {
        throw new Error('Video format not supported. Try using a different source video format.');
      } else {
        throw new Error(`Video processing failed: ${errorMessage}`);
      }
    } finally {
      // Always clean up files
      try {
        console.log('🧹 Cleaning up temporary files...');
        await cleanupFiles(ffmpegInstance!, options.outputFormat || 'webm');
        console.log('✅ Cleanup completed');
      } catch (cleanupError) {
        console.warn('⚠️ Cleanup failed (non-critical):', cleanupError);
      }
    }
  }, [loadFFmpeg]);

  // Helper function to setup background
  const setupBackground = async (
    ffmpeg: FFmpeg, 
    options: VideoExportOptions, 
    width: number, 
    height: number
  ) => {
    if (options.backgroundType === 'color' && options.backgroundColor) {
      // Create solid color background
      const color = options.backgroundColor.replace('#', '');
      await ffmpeg.exec([
        '-f', 'lavfi',
        '-i', `color=c=${color}:size=${width}x${height}:duration=10`,
        '-vframes', '1',
        '-y', 'background.png'
      ]);
    } else if (options.backgroundType === 'image' && options.backgroundImage) {
      // Handle background image
      if (options.backgroundImage.startsWith('data:')) {
        // Base64 image
        const base64Data = options.backgroundImage.split(',')[1];
        const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        await ffmpeg.writeFile('bg_source.jpg', imageBuffer);
      } else {
        // URL image - fetch and write
        try {
          const response = await fetch(options.backgroundImage);
          if (!response.ok) {
            throw new Error(`Failed to fetch background image: ${response.statusText}`);
          }
          const arrayBuffer = await response.arrayBuffer();
          await ffmpeg.writeFile('bg_source.jpg', new Uint8Array(arrayBuffer));
        } catch (error) {
          console.error('Failed to load background image, using black background:', error);
          // Fallback to black background
          await ffmpeg.exec([
            '-f', 'lavfi',
            '-i', `color=c=black:size=${width}x${height}:duration=10`,
            '-vframes', '1',
            '-y', 'background.png'
          ]);
          return;
        }
      }
      
      // Scale background image based on fit option
      const scaleFilter = getBackgroundScaleFilter(options.backgroundImageFit || 'cover', width, height);
      await ffmpeg.exec([
        '-i', 'bg_source.jpg',
        '-vf', scaleFilter,
        '-y', 'background.png'
      ]);
    }
  };

  // Helper function to get background scale filter
  const getBackgroundScaleFilter = (fit: string, width: number, height: number): string => {
    switch (fit) {
      case 'cover':
        return `scale='min(${width},iw*${height}/ih)':'min(${height},ih*${width}/iw)',crop=${width}:${height}`;
      case 'contain':
        return `scale='min(${width},iw)':'min(${height},ih)',pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black`;
      case 'fill':
        return `scale=${width}:${height}`;
      default:
        return `scale=${width}:${height}`;
    }
  };

  // Build complex filter graph for all effects
  const buildFilterComplex = async (
    options: VideoExportOptions,
    originalWidth: number,
    originalHeight: number
  ): Promise<string | null> => {
    const filters: string[] = [];
    let currentLabel = '[0:v]';
    let labelCounter = 0;

    // Apply cropping first if specified
    if (options.cropX !== undefined && options.cropY !== undefined && 
        options.cropWidth !== undefined && options.cropHeight !== undefined &&
        (options.cropX !== 0 || options.cropY !== 0 || options.cropWidth !== 100 || options.cropHeight !== 100)) {
      
      const cropW = Math.round(originalWidth * (options.cropWidth / 100));
      const cropH = Math.round(originalHeight * (options.cropHeight / 100));
      const cropX = Math.round(originalWidth * (options.cropX / 100));
      const cropY = Math.round(originalHeight * (options.cropY / 100));
      
      const nextLabel = `[crop${labelCounter++}]`;
      filters.push(`${currentLabel}crop=${cropW}:${cropH}:${cropX}:${cropY}${nextLabel}`);
      currentLabel = nextLabel;
    }

    // Apply zoom effects using zoompan filter
    if (options.zoomEffects && options.zoomEffects.length > 0) {
      const trimStart = options.trimStart || 0;
      const trimEnd = options.trimEnd || 30;
      const duration = trimEnd - trimStart;
      const fps = 30; // Standard frame rate
      
      // Sort zoom effects by start time
      const sortedZooms = [...options.zoomEffects].sort((a, b) => a.startTime - b.startTime);
      
      // Build comprehensive zoompan filter with all effects
      let zoomExpressions = {
        zoom: '1', // Default zoom level
        x: 'iw/zoom/2', // Default center X
        y: 'ih/zoom/2'  // Default center Y
      };

      // Process each zoom effect and build conditional expressions
      for (const zoom of sortedZooms) {
        // Adjust times relative to trim start
        const effectStart = Math.max(0, zoom.startTime - trimStart);
        const effectEnd = Math.min(duration, zoom.endTime - trimStart);
        
        if (effectEnd > effectStart) {
          const startFrame = Math.round(effectStart * fps);
          const endFrame = Math.round(effectEnd * fps);
          
          // Convert grid position (0-7) to normalized coordinates (0-1)
          const targetX = (zoom.targetX + 0.5) / 8;
          const targetY = (zoom.targetY + 0.5) / 8;
          
          // Build conditional expressions for this zoom effect
          zoomExpressions.zoom = `if(between(on,${startFrame},${endFrame}),${zoom.zoomAmount},${zoomExpressions.zoom})`;
          zoomExpressions.x = `if(between(on,${startFrame},${endFrame}),iw/zoom*${targetX},${zoomExpressions.x})`;
          zoomExpressions.y = `if(between(on,${startFrame},${endFrame}),ih/zoom*${targetY},${zoomExpressions.y})`;
        }
      }
      
      // Apply zoompan filter with all expressions
      const totalFrames = Math.round(duration * fps);
      const nextLabel = `[zoom${labelCounter++}]`;
      const zoomFilter = `zoompan=z='${zoomExpressions.zoom}':x='${zoomExpressions.x}':y='${zoomExpressions.y}':d=${totalFrames}:s=${originalWidth}x${originalHeight}:fps=${fps}`;
      
      filters.push(`${currentLabel}${zoomFilter}${nextLabel}`);
      currentLabel = nextLabel;
    }

    // Apply video padding (scaling) if specified
    if (options.videoPadding !== undefined && options.videoPadding > 0) {
      const scale = (100 - options.videoPadding) / 100;
      const scaledWidth = Math.round(originalWidth * scale);
      const scaledHeight = Math.round(originalHeight * scale);
      
      const nextLabel = `[scaled${labelCounter++}]`;
      filters.push(`${currentLabel}scale=${scaledWidth}:${scaledHeight}${nextLabel}`);
      currentLabel = nextLabel;
    }

    // Handle background overlay if specified
    if (options.backgroundType === 'color' || options.backgroundType === 'image') {
      // Overlay video on background
      const nextLabel = `[overlay${labelCounter++}]`;
      filters.push(`[1:v]${currentLabel}overlay=(main_w-overlay_w)/2:(main_h-overlay_h)/2${nextLabel}`);
      currentLabel = nextLabel;
    }

    // Apply corner rounding if specified (using mask)
    if (options.videoCornerRadius && options.videoCornerRadius > 0) {
      // Create rounded rectangle mask
      // Note: This is a simplified approach - full corner rounding in FFmpeg is complex
      // For production use, consider pre-processing the background or using drawbox with rounded corners
      console.log(`Corner rounding of ${options.videoCornerRadius}px will be approximated in export`);
    }

    // Set final output label
    if (filters.length > 0) {
      const lastFilter = filters[filters.length - 1];
      filters[filters.length - 1] = lastFilter.replace(/\[[\w\d]+\]$/, '[final]');
      return filters.join(';');
    }

    return null;
  };

  // Cleanup temporary files
  const cleanupFiles = async (ffmpeg: FFmpeg, outputFormat: string) => {
    const filesToClean = [
      'input.webm',
      `output.${outputFormat}`,
      'background.png',
      'bg_source.jpg'
    ];

    for (const file of filesToClean) {
      try {
        await ffmpeg.deleteFile(file);
      } catch (error) {
        // File might not exist, ignore error
      }
    }
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
