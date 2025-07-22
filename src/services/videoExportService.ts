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
    
    this.ffmpeg = new FFmpeg();
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    
    await this.ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    
    this.isLoaded = true;
  }

  async exportVideo(
    videoBlob: Blob,
    editingState: VideoEditingState,
    onProgress?: (progress: number) => void
  ): Promise<Blob> {
    await this.initialize();
    if (!this.ffmpeg) throw new Error('FFmpeg not initialized');

    try {
      // Get video metadata first
      const metadata = await this.getVideoMetadata(videoBlob);
      const inputWidth = metadata.width || 1920;
      const inputHeight = metadata.height || 1080;
      
      // Write input files
      await this.ffmpeg.writeFile('input.webm', await fetchFile(videoBlob));
      
      // Handle background image if needed
      if (editingState.backgroundType === 'image' && editingState.backgroundImage) {
        await this.writeBackgroundImage(editingState.backgroundImage);
      }

      // Build complex FFmpeg command
      const command = this.buildFFmpegCommand(editingState, inputWidth, inputHeight);
      
      // Set up progress monitoring
      if (onProgress) {
        this.ffmpeg.on('progress', (event) => {
          onProgress(event.progress * 100);
        });
      }

      // Execute FFmpeg command
      console.log('Executing FFmpeg command:', command.join(' '));
      await this.ffmpeg.exec(command);
      
      // Read output
      const data = await this.ffmpeg.readFile('output.mp4');
      
      // Cleanup
      await this.cleanup();
      
      return new Blob([data], { type: 'video/mp4' });
    } catch (error) {
      console.error('Export error:', error);
      await this.cleanup();
      throw error;
    }
  }

  private async getVideoMetadata(videoBlob: Blob): Promise<{ width: number; height: number; duration: number }> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.onloadedmetadata = () => {
        resolve({
          width: video.videoWidth,
          height: video.videoHeight,
          duration: video.duration
        });
        URL.revokeObjectURL(video.src);
      };
      video.src = URL.createObjectURL(videoBlob);
    });
  }

  private async writeBackgroundImage(imageData: string) {
    if (!this.ffmpeg) return;
    
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
  }

  private buildFFmpegCommand(state: VideoEditingState, inputWidth: number, inputHeight: number): string[] {
    const cmd: string[] = [];
    
    // Input files
    if (state.backgroundType === 'image' && state.backgroundImage) {
      cmd.push('-i', 'background.jpg');
    }
    cmd.push('-i', 'input.webm');
    
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
      filters.push(`color=c=${state.backgroundColor.replace('#', '')}:s=${outputWidth}x${outputHeight}:d=${state.duration}[bg]`);
    } else if (state.backgroundType === 'image') {
      // Scale background image according to fit mode
      const bgFilter = this.buildBackgroundImageFilter(state.backgroundImageFit, outputWidth, outputHeight);
      filters.push(`[0:v]${bgFilter}[bg]`);
    }
    
    // Overlay the video on background
    const overlayX = Math.round((outputWidth - scaledW) / 2);
    const overlayY = Math.round((outputHeight - scaledH) / 2);
    filters.push(`[bg][rounded]overlay=${overlayX}:${overlayY}[final]`);
    
    // Add filter complex
    cmd.push('-filter_complex', filters.join(';'));
    
    // Map the final video stream
    cmd.push('-map', '[final]');
    
    // Map audio from original video
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
    
    // Output format
    cmd.push('-f', 'mp4', '-movflags', '+faststart', 'output.mp4');
    
    return cmd;
  }

  private buildZoomFilter(zoomEffects: VideoEditingState['zoomEffects'], duration: number, videoW: number, videoH: number): string {
    // Build complex zoom expression using FFmpeg's zoompan filter
    let zoomExpression = '[cropped]zoompan=';
    
    // Build zoom level expression
    let zoomExpr = 'z=';
    let panXExpr = 'x=';
    let panYExpr = 'y=';
    
    // Sort effects by start time
    const sortedEffects = [...zoomEffects].sort((a, b) => a.startTime - b.startTime);
    
    // Build conditional expressions for each zoom effect
    sortedEffects.forEach((effect, index) => {
      const startFrame = Math.round(effect.startTime * 25); // Assuming 25fps
      const endFrame = Math.round(effect.endTime * 25);
      const zoomInFrames = Math.round(effect.zoomSpeed * 25);
      
      // Calculate target position in pixels (from 8x8 grid to actual pixels)
      const targetX = (effect.targetX / 7) * videoW;
      const targetY = (effect.targetY / 7) * videoH;
      
      if (index > 0) {
        zoomExpr += '+';
        panXExpr += '+';
        panYExpr += '+';
      }
      
      // Zoom expression with smooth in/out
      zoomExpr += `if(between(on,${startFrame},${endFrame}),`;
      zoomExpr += `min(${effect.zoomAmount},1+(${effect.zoomAmount}-1)*min(1,(on-${startFrame})/${zoomInFrames})),`;
      zoomExpr += `if(between(on,${endFrame},${endFrame + zoomInFrames}),`;
      zoomExpr += `${effect.zoomAmount}-(${effect.zoomAmount}-1)*min(1,(on-${endFrame})/${zoomInFrames}),0))`;
      
      // Pan expressions
      panXExpr += `if(between(on,${startFrame},${endFrame}),`;
      panXExpr += `${targetX}*min(1,(on-${startFrame})/${zoomInFrames}),0)`;
      
      panYExpr += `if(between(on,${startFrame},${endFrame}),`;
      panYExpr += `${targetY}*min(1,(on-${startFrame})/${zoomInFrames}),0)`;
    });
    
    // If no effects active, default to 1
    if (zoomEffects.length === 0) {
      zoomExpr += '1';
      panXExpr += '0';
      panYExpr += '0';
    } else {
      // Add default zoom of 1 when no effects are active
      zoomExpr = `if(${zoomExpr},${zoomExpr},1)`;
      panXExpr = `if(${panXExpr},${panXExpr},0)`;
      panYExpr = `if(${panYExpr},${panYExpr},0)`;
    }
    
    // Combine expressions
    zoomExpression += `${zoomExpr}:${panXExpr}:${panYExpr}:d=${Math.round(duration * 25)}:s=${videoW}x${videoH}:fps=25[zoomed]`;
    
    return zoomExpression;
  }

  private buildRoundCornersFilter(radius: number, width: number, height: number): string {
    // Create rounded corners using geq filter
    const r = radius;
    return `[scaled]format=yuva444p,geq=lum='lum(X,Y)':` +
           `a='if(lt(X,${r})*lt(Y,${r}),if(gt(hypot(${r}-X,${r}-Y),${r}),0,255),` +
           `if(lt(X,${r})*gt(Y,${height}-${r}),if(gt(hypot(${r}-X,Y-${height}+${r}),${r}),0,255),` +
           `if(gt(X,${width}-${r})*lt(Y,${r}),if(gt(hypot(X-${width}+${r},${r}-Y),${r}),0,255),` +
           `if(gt(X,${width}-${r})*gt(Y,${height}-${r}),if(gt(hypot(X-${width}+${r},Y-${height}+${r}),${r}),0,255),` +
           `255))))'[rounded]`;
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
    
    settings.push('-pix_fmt', 'yuv420p'); // Ensure compatibility
    
    return settings;
  }

  private async cleanup() {
    if (!this.ffmpeg) return;
    
    try {
      await this.ffmpeg.deleteFile('input.webm');
      await this.ffmpeg.deleteFile('output.mp4');
      await this.ffmpeg.deleteFile('background.jpg');
    } catch (error) {
      // Ignore cleanup errors
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
