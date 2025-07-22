import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// Video editing state interface matching your current implementation
export interface VideoEditingState {
  // Trim settings
  trimStart: number;
  trimEnd: number;
  duration: number;
  
  // Display settings
  videoPadding: number; // 0-100 percentage
  videoCornerRadius: number; // pixels
  backgroundColor: string; // hex color
  backgroundType: 'color' | 'image';
  backgroundImage: string | null; // base64 or URL
  backgroundImageFit: 'cover' | 'contain' | 'fill';
  
  // Crop settings
  cropSettings: {
    x: number; // percentage
    y: number; // percentage
    width: number; // percentage
    height: number; // percentage
  };
  
  // Zoom effects
  zoomEffects: Array<{
    id: string;
    startTime: number;
    endTime: number;
    zoomAmount: number; // 1.2 to 3
    zoomSpeed: number; // seconds
    targetX: number; // 0-7 grid position
    targetY: number; // 0-7 grid position
  }>;
  
  // Quality
  quality: 'high' | 'medium' | 'low';
  
  // Original video dimensions
  originalWidth?: number;
  originalHeight?: number;
}

export class VideoExportService {
  private ffmpeg: FFmpeg | null = null;
  private isLoaded = false;

  async initialize() {
    if (this.isLoaded) return;
    
    console.log('Initializing FFmpeg...');
    this.ffmpeg = new FFmpeg();
    
    // Try multiple CDN sources in order
    const cdnConfigs = [
      {
        coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
        wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm',
      },
      {
        coreURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
        wasmURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm',
      },
      {
        coreURL: 'https://cdnjs.cloudflare.com/ajax/libs/ffmpeg-core/0.12.6/umd/ffmpeg-core.js',
        wasmURL: 'https://cdnjs.cloudflare.com/ajax/libs/ffmpeg-core/0.12.6/umd/ffmpeg-core.wasm',
      }
    ];
    
    let lastError: Error | null = null;
    
    for (const config of cdnConfigs) {
      try {
        console.log(`Trying to load FFmpeg from: ${config.coreURL}`);
        
        // Set log level to false to reduce console noise
        this.ffmpeg.on('log', ({ message }) => {
          console.log('FFmpeg:', message);
        });
        
        await this.ffmpeg.load({
          coreURL: await toBlobURL(config.coreURL, 'text/javascript'),
          wasmURL: await toBlobURL(config.wasmURL, 'application/wasm'),
        });
        
        this.isLoaded = true;
        console.log('FFmpeg loaded successfully!');
        return;
      } catch (error) {
        console.warn(`Failed to load FFmpeg from ${config.coreURL}:`, error);
        lastError = error as Error;
        // Try next CDN
      }
    }
    
    // If all CDNs fail, throw the last error
    throw new Error(`Failed to load FFmpeg from all CDN sources. Last error: ${lastError?.message}`);
  }

  async exportVideo(
    videoBlob: Blob,
    editingState: VideoEditingState,
    onProgress?: (progress: number) => void
  ): Promise<Blob> {
    try {
      await this.initialize();
      if (!this.ffmpeg) throw new Error('FFmpeg not initialized');

      // Get video metadata first
      const metadata = await this.getVideoMetadata(videoBlob);
      const inputWidth = metadata.width || 1920;
      const inputHeight = metadata.height || 1080;
      
      console.log('Video metadata:', metadata);
      
      // Determine input format based on blob type
      const inputFormat = videoBlob.type.includes('mp4') ? 'mp4' : 'webm';
      const inputFilename = `input.${inputFormat}`;
      
      // Write input files
      console.log('Writing input video file...');
      await this.ffmpeg.writeFile(inputFilename, await fetchFile(videoBlob));
      
      // Handle background image if needed
      if (editingState.backgroundType === 'image' && editingState.backgroundImage) {
        console.log('Writing background image...');
        await this.writeBackgroundImage(editingState.backgroundImage);
      }

      // Build complex FFmpeg command
      const command = this.buildFFmpegCommand(editingState, inputWidth, inputHeight, inputFilename);
      
      // Set up progress monitoring
      if (onProgress) {
        this.ffmpeg.on('progress', (event) => {
          const progress = Math.min(event.progress * 100, 99); // Cap at 99% until fully complete
          onProgress(progress);
        });
      }

      // Execute FFmpeg command
      console.log('Executing FFmpeg command:', command.join(' '));
      await this.ffmpeg.exec(command);
      
      // Read output
      console.log('Reading output file...');
      const data = await this.ffmpeg.readFile('output.mp4');
      
      // Cleanup
      await this.cleanup(inputFilename);
      
      // Call progress one final time at 100%
      if (onProgress) {
        onProgress(100);
      }
      
      return new Blob([data], { type: 'video/mp4' });
    } catch (error) {
      console.error('Export error:', error);
      // Try to cleanup even if export failed
      try {
        await this.cleanup('input.webm');
        await this.cleanup('input.mp4');
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  private async getVideoMetadata(videoBlob: Blob): Promise<{ width: number; height: number; duration: number }> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      
      const cleanup = () => {
        URL.revokeObjectURL(video.src);
      };
      
      video.onloadedmetadata = () => {
        resolve({
          width: video.videoWidth,
          height: video.videoHeight,
          duration: video.duration
        });
        cleanup();
      };
      
      video.onerror = () => {
        cleanup();
        reject(new Error('Failed to load video metadata'));
      };
      
      video.src = URL.createObjectURL(videoBlob);
    });
  }

  private async writeBackgroundImage(imageData: string) {
    if (!this.ffmpeg) return;
    
    try {
      if (imageData.startsWith('data:')) {
        // Handle base64 data URL
        const base64Data = imageData.split(',')[1];
        const binaryData = atob(base64Data);
        const bytes = new Uint8Array(binaryData.length);
        for (let i = 0; i < binaryData.length; i++) {
          bytes[i] = binaryData.charCodeAt(i);
        }
        await this.ffmpeg.writeFile('background.jpg', bytes);
      } else {
        // Handle URL
        const response = await fetch(imageData);
        const blob = await response.blob();
        await this.ffmpeg.writeFile('background.jpg', await fetchFile(blob));
      }
    } catch (error) {
      console.error('Failed to write background image:', error);
      throw new Error('Failed to process background image');
    }
  }

  private buildFFmpegCommand(
    state: VideoEditingState, 
    inputWidth: number, 
    inputHeight: number,
    inputFilename: string
  ): string[] {
    const cmd: string[] = [];
    
    // Input files
    if (state.backgroundType === 'image' && state.backgroundImage) {
      cmd.push('-i', 'background.jpg');
    }
    cmd.push('-i', inputFilename);
    
    // Calculate dimensions after cropping
    const cropX = Math.round(inputWidth * (state.cropSettings.x / 100));
    const cropY = Math.round(inputHeight * (state.cropSettings.y / 100));
    const cropW = Math.round(inputWidth * (state.cropSettings.width / 100));
    const cropH = Math.round(inputHeight * (state.cropSettings.height / 100));
    
    // Calculate output dimensions (maintain aspect ratio)
    const outputWidth = 1920;
    const outputHeight = 1080;
    
    // Build complex filter graph
    const filters: string[] = [];
    
    // Step 1: Trim and crop the video
    if (state.cropSettings.width < 100 || state.cropSettings.height < 100) {
      filters.push(`[${state.backgroundType === 'image' ? '1' : '0'}:v]crop=${cropW}:${cropH}:${cropX}:${cropY}[cropped]`);
    } else {
      filters.push(`[${state.backgroundType === 'image' ? '1' : '0'}:v]copy[cropped]`);
    }
    
    // Step 2: Apply zoom effects if any
    if (state.zoomEffects.length > 0) {
      filters.push(this.buildZoomFilter(state.zoomEffects, state.duration, cropW, cropH));
    } else {
      filters.push('[cropped]copy[zoomed]');
    }
    
    // Step 3: Apply padding/scaling
    const scale = (100 - state.videoPadding) / 100;
    const scaledW = Math.round(outputWidth * scale);
    const scaledH = Math.round(outputHeight * scale);
    
    // Maintain aspect ratio
    filters.push(`[zoomed]scale=${scaledW}:${scaledH}:force_original_aspect_ratio=decrease[scaled]`);
    
    // Step 4: Apply corner radius if needed
    if (state.videoCornerRadius > 0) {
      filters.push(this.buildRoundCornersFilter(state.videoCornerRadius, scaledW, scaledH));
    } else {
      filters.push('[scaled]copy[rounded]');
    }
    
    // Step 5: Create background and overlay video
    if (state.backgroundType === 'color') {
      // Create solid color background
      const bgColor = state.backgroundColor.replace('#', '');
      filters.push(`color=c=${bgColor}:s=${outputWidth}x${outputHeight}:d=${state.duration}[bg]`);
    } else if (state.backgroundType === 'image') {
      // Scale background image according to fit mode
      const bgFilter = this.buildBackgroundImageFilter(state.backgroundImageFit, outputWidth, outputHeight);
      filters.push(`[0:v]${bgFilter}[bg]`);
    } else {
      // Default black background
      filters.push(`color=c=000000:s=${outputWidth}x${outputHeight}:d=${state.duration}[bg]`);
    }
    
    // Calculate overlay position to center the video
    const overlayX = `(W-w)/2`;
    const overlayY = `(H-h)/2`;
    filters.push(`[bg][rounded]overlay=${overlayX}:${overlayY}[final]`);
    
    // Add filter complex
    cmd.push('-filter_complex', filters.join(';'));
    
    // Map the final video stream
    cmd.push('-map', '[final]');
    
    // Map audio from original video if it exists
    cmd.push('-map', `${state.backgroundType === 'image' ? '1' : '0'}:a?`);
    
    // Trim settings
    if (state.trimStart > 0) {
      cmd.push('-ss', `${state.trimStart}`);
    }
    if (state.trimEnd < state.duration) {
      const duration = state.trimEnd - state.trimStart;
      cmd.push('-t', `${duration}`);
    }
    
    // Quality settings
    const qualitySettings = this.getQualitySettings(state.quality);
    cmd.push(...qualitySettings);
    
    // Add format flags for better compatibility
    cmd.push(
      '-movflags', '+faststart',
      '-pix_fmt', 'yuv420p',
      '-f', 'mp4',
      'output.mp4'
    );
    
    return cmd;
  }

  private buildZoomFilter(zoomEffects: VideoEditingState['zoomEffects'], duration: number, videoW: number, videoH: number): string {
    // For simplicity with multiple zoom effects, we'll use a different approach
    // Instead of zoompan (which is complex for multiple effects), we'll use scale filter
    // This is a simplified version - for production, you might want more complex handling
    
    let filterStr = '[cropped]';
    
    // If we have zoom effects, apply the first one (simplified for now)
    if (zoomEffects.length > 0) {
      const effect = zoomEffects[0];
      const zoom = effect.zoomAmount;
      
      // Calculate crop window for zoom
      const zoomW = Math.round(videoW / zoom);
      const zoomH = Math.round(videoH / zoom);
      
      // Calculate position based on target
      const posX = Math.round((effect.targetX / 7) * (videoW - zoomW));
      const posY = Math.round((effect.targetY / 7) * (videoH - zoomH));
      
      filterStr += `crop=${zoomW}:${zoomH}:${posX}:${posY},scale=${videoW}:${videoH}`;
    } else {
      filterStr += 'copy';
    }
    
    filterStr += '[zoomed]';
    return filterStr;
  }

  private buildRoundCornersFilter(radius: number, width: number, height: number): string {
    // Simplified rounded corners using drawbox
    // For true rounded corners, you'd need a more complex geq filter
    return `[scaled]format=yuva420p,drawbox=w=${width}:h=${height}:t=fill:replace=1:color=black@0[rounded]`;
  }

  private buildBackgroundImageFilter(fit: 'cover' | 'contain' | 'fill', width: number, height: number): string {
    switch (fit) {
      case 'cover':
        return `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`;
      case 'contain':
        return `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`;
      case 'fill':
        return `scale=${width}:${height}:force_original_aspect_ratio=disable`;
      default:
        return `scale=${width}:${height}`;
    }
  }

  private getQualitySettings(quality: 'high' | 'medium' | 'low'): string[] {
    const settings: string[] = [];
    
    switch (quality) {
      case 'high':
        settings.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '18');
        settings.push('-c:a', 'aac', '-b:a', '192k');
        break;
      case 'medium':
        settings.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '23');
        settings.push('-c:a', 'aac', '-b:a', '128k');
        break;
      case 'low':
        settings.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '28');
        settings.push('-c:a', 'aac', '-b:a', '96k');
        break;
    }
    
    return settings;
  }

  private async cleanup(inputFilename?: string) {
    if (!this.ffmpeg) return;
    
    const filesToDelete = [
      inputFilename || 'input.webm',
      'output.mp4',
      'background.jpg'
    ];
    
    for (const file of filesToDelete) {
      try {
        await this.ffmpeg.deleteFile(file);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }
}

// Export function to be used in your components
export async function exportEditedVideo(
  videoBlob: Blob,
  editingState: VideoEditingState,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const exportService = new VideoExportService();
  return exportService.exportVideo(videoBlob, editingState, onProgress);
}
