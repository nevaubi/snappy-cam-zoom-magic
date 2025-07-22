import { ZoomEffect } from '@/components/ZoomTimeline';

export interface ExportSettings {
  // Video source and timing
  videoSrc: string;
  trimStart: number;
  trimEnd: number;
  
  // Visual effects
  cropSettings: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  
  // Background styling
  backgroundColor: string;
  backgroundType: 'color' | 'image';
  backgroundImage: string | null;
  backgroundImageFit: 'cover' | 'contain' | 'fill';
  
  // Video styling
  videoPadding: number;
  videoCornerRadius: number;
  
  // Zoom effects
  zoomEffects: ZoomEffect[];
}

export interface ExportProgress {
  phase: 'initializing' | 'processing' | 'finalizing' | 'complete' | 'error';
  progress: number; // 0-100
  currentTime?: number;
  totalTime?: number;
  message?: string;
}

export class VideoExporter {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private video: HTMLVideoElement;
  private mediaRecorder: MediaRecorder | null = null;
  private isExporting = false;
  private shouldCancel = false;
  
  // Export dimensions - fixed 1440p
  private readonly EXPORT_WIDTH = 2560;
  private readonly EXPORT_HEIGHT = 1440;
  private readonly FPS = 60;
  private readonly BITRATE = 8000000; // 8Mbps

  constructor() {
    // Create invisible canvas for export rendering
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.EXPORT_WIDTH;
    this.canvas.height = this.EXPORT_HEIGHT;
    this.canvas.style.display = 'none'; // Hide from view
    document.body.appendChild(this.canvas); // Required for captureStream
    
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D context from canvas');
    }
    this.ctx = ctx;
    
    // Create invisible video element for source
    this.video = document.createElement('video');
    this.video.crossOrigin = 'anonymous';
    this.video.muted = true;
    this.video.preload = 'metadata';
  }

  async exportVideo(
    settings: ExportSettings,
    onProgress: (progress: ExportProgress) => void
  ): Promise<Blob> {
    if (this.isExporting) {
      throw new Error('Export already in progress');
    }

    this.isExporting = true;
    this.shouldCancel = false;

    try {
      onProgress({
        phase: 'initializing',
        progress: 0,
        message: 'Loading video source...'
      });

      // Load video source
      await this.loadVideo(settings.videoSrc);
      
      onProgress({
        phase: 'initializing',
        progress: 10,
        message: 'Setting up export canvas...'
      });

      // Setup canvas stream and MediaRecorder
      const stream = this.canvas.captureStream(this.FPS);
      const chunks: Blob[] = [];

      const mimeType = this.getSupportedMimeType();
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: this.BITRATE
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      const recordingPromise = new Promise<Blob>((resolve, reject) => {
        if (!this.mediaRecorder) {
          reject(new Error('MediaRecorder not initialized'));
          return;
        }

        this.mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType });
          resolve(blob);
        };

        this.mediaRecorder.onerror = (event) => {
          reject(new Error('MediaRecorder error: ' + event));
        };
      });

      onProgress({
        phase: 'processing',
        progress: 20,
        message: 'Starting frame-by-frame rendering...'
      });

      // Start recording
      this.mediaRecorder.start(100); // 100ms chunks for smoother data flow

      // Render frames
      await this.renderFrames(settings, onProgress);

      onProgress({
        phase: 'finalizing',
        progress: 95,
        message: 'Finalizing export...'
      });

      // Stop recording and wait for final blob
      this.mediaRecorder.stop();
      const exportedBlob = await recordingPromise;

      onProgress({
        phase: 'complete',
        progress: 100,
        message: 'Export completed successfully!'
      });

      return exportedBlob;

    } catch (error) {
      onProgress({
        phase: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : 'Export failed'
      });
      throw error;
    } finally {
      this.cleanup();
      this.isExporting = false;
    }
  }

  private async loadVideo(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.video.onloadedmetadata = () => {
        resolve();
      };
      
      this.video.onerror = () => {
        reject(new Error('Failed to load video source'));
      };
      
      this.video.src = src;
    });
  }

  private async renderFrames(
    settings: ExportSettings,
    onProgress: (progress: ExportProgress) => void
  ): Promise<void> {
    const { trimStart, trimEnd } = settings;
    const duration = trimEnd - trimStart;
    const frameInterval = 1 / this.FPS;
    
    let currentTime = trimStart;
    let frameCount = 0;
    const totalFrames = Math.ceil(duration * this.FPS);

    while (currentTime < trimEnd && !this.shouldCancel) {
      // Seek to current time
      this.video.currentTime = currentTime;
      
      // Wait for seek to complete
      await this.waitForSeek();
      
      // Render frame with all effects
      await this.renderFrame(settings, currentTime);
      
      // Update progress
      frameCount++;
      const progress = 20 + (frameCount / totalFrames) * 75; // 20-95% range
      
      onProgress({
        phase: 'processing',
        progress: Math.min(95, progress),
        currentTime,
        totalTime: duration,
        message: `Rendering frame ${frameCount} of ${totalFrames}...`
      });
      
      currentTime += frameInterval;
      
      // Small delay to prevent browser blocking
      if (frameCount % 30 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }

    if (this.shouldCancel) {
      throw new Error('Export cancelled by user');
    }
  }

  private async waitForSeek(): Promise<void> {
    return new Promise((resolve) => {
      const checkSeek = () => {
        if (this.video.readyState >= 2) { // HAVE_CURRENT_DATA
          resolve();
        } else {
          requestAnimationFrame(checkSeek);
        }
      };
      checkSeek();
    });
  }

  private async renderFrame(settings: ExportSettings, currentTime: number): Promise<void> {
    const {
      cropSettings,
      backgroundColor,
      backgroundType,
      backgroundImage,
      backgroundImageFit,
      videoPadding,
      videoCornerRadius,
      zoomEffects
    } = settings;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.EXPORT_WIDTH, this.EXPORT_HEIGHT);

    // Apply background
    await this.renderBackground(backgroundColor, backgroundType, backgroundImage, backgroundImageFit);

    // Calculate video dimensions with padding
    const paddingPx = (videoPadding / 100) * Math.min(this.EXPORT_WIDTH, this.EXPORT_HEIGHT);
    const videoWidth = this.EXPORT_WIDTH - (paddingPx * 2);
    const videoHeight = this.EXPORT_HEIGHT - (paddingPx * 2);

    // Apply zoom effect
    const activeZoom = this.getActiveZoomEffect(zoomEffects, currentTime);
    
    this.ctx.save();
    
    // Apply corner radius clipping
    if (videoCornerRadius > 0) {
      this.roundRect(paddingPx, paddingPx, videoWidth, videoHeight, videoCornerRadius);
      this.ctx.clip();
    }

    // Apply crop and zoom transforms
    this.applyVideoTransforms(cropSettings, activeZoom, paddingPx, videoWidth, videoHeight);

    // Draw video frame
    this.ctx.drawImage(
      this.video,
      paddingPx,
      paddingPx,
      videoWidth,
      videoHeight
    );

    this.ctx.restore();
  }

  private async renderBackground(
    backgroundColor: string,
    backgroundType: 'color' | 'image',
    backgroundImage: string | null,
    backgroundImageFit: 'cover' | 'contain' | 'fill'
  ): Promise<void> {
    if (backgroundType === 'color') {
      this.ctx.fillStyle = backgroundColor;
      this.ctx.fillRect(0, 0, this.EXPORT_WIDTH, this.EXPORT_HEIGHT);
    } else if (backgroundType === 'image' && backgroundImage) {
      const img = await this.loadImage(backgroundImage);
      this.drawImageWithFit(img, backgroundImageFit);
    }
  }

  private async loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load background image'));
      img.crossOrigin = 'anonymous';
      img.src = src;
    });
  }

  private drawImageWithFit(img: HTMLImageElement, fit: 'cover' | 'contain' | 'fill'): void {
    const canvasRatio = this.EXPORT_WIDTH / this.EXPORT_HEIGHT;
    const imageRatio = img.width / img.height;

    let drawWidth = this.EXPORT_WIDTH;
    let drawHeight = this.EXPORT_HEIGHT;
    let drawX = 0;
    let drawY = 0;

    if (fit === 'cover') {
      if (imageRatio > canvasRatio) {
        drawWidth = this.EXPORT_HEIGHT * imageRatio;
        drawX = (this.EXPORT_WIDTH - drawWidth) / 2;
      } else {
        drawHeight = this.EXPORT_WIDTH / imageRatio;
        drawY = (this.EXPORT_HEIGHT - drawHeight) / 2;
      }
    } else if (fit === 'contain') {
      if (imageRatio > canvasRatio) {
        drawHeight = this.EXPORT_WIDTH / imageRatio;
        drawY = (this.EXPORT_HEIGHT - drawHeight) / 2;
      } else {
        drawWidth = this.EXPORT_HEIGHT * imageRatio;
        drawX = (this.EXPORT_WIDTH - drawWidth) / 2;
      }
    }
    // 'fill' uses default values (full canvas)

    this.ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
  }

  private getActiveZoomEffect(zoomEffects: ZoomEffect[], currentTime: number): ZoomEffect | null {
    return zoomEffects.find(zoom => 
      currentTime >= zoom.startTime && currentTime <= zoom.endTime
    ) || null;
  }

  private applyVideoTransforms(
    cropSettings: { x: number; y: number; width: number; height: number },
    activeZoom: ZoomEffect | null,
    paddingPx: number,
    videoWidth: number,
    videoHeight: number
  ): void {
    // Apply crop by adjusting source coordinates
    const cropX = (cropSettings.x / 100) * this.video.videoWidth;
    const cropY = (cropSettings.y / 100) * this.video.videoHeight;
    const cropWidth = (cropSettings.width / 100) * this.video.videoWidth;
    const cropHeight = (cropSettings.height / 100) * this.video.videoHeight;

    // Apply zoom
    if (activeZoom) {
      const zoomAmount = activeZoom.zoomAmount;
      const targetX = (activeZoom.targetX / 7) * videoWidth; // Convert from 7x7 grid to pixels
      const targetY = (activeZoom.targetY / 7) * videoHeight;

      this.ctx.translate(targetX, targetY);
      this.ctx.scale(zoomAmount, zoomAmount);
      this.ctx.translate(-targetX, -targetY);
    }

    // Apply crop centering transform
    if (cropSettings.width < 100 || cropSettings.height < 100) {
      const cropCenterX = cropSettings.x + (cropSettings.width / 2);
      const cropCenterY = cropSettings.y + (cropSettings.height / 2);
      const offsetX = (50 - cropCenterX) * 2;
      const offsetY = (50 - cropCenterY) * 2;
      
      this.ctx.translate(
        (offsetX / 100) * videoWidth,
        (offsetY / 100) * videoHeight
      );
    }
  }

  private roundRect(x: number, y: number, width: number, height: number, radius: number): void {
    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + width - radius, y);
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.ctx.lineTo(x + width, y + height - radius);
    this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    this.ctx.lineTo(x + radius, y + height);
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y);
    this.ctx.closePath();
  }

  private getSupportedMimeType(): string {
    const types = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4'
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    throw new Error('No supported video format found');
  }

  cancel(): void {
    this.shouldCancel = true;
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
  }

  private cleanup(): void {
    if (this.mediaRecorder) {
      this.mediaRecorder = null;
    }
    if (this.video.src) {
      URL.revokeObjectURL(this.video.src);
    }
    // Remove canvas from DOM
    if (this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}