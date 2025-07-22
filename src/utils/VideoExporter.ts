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
  private readonly FPS = 60; // Increased to 60fps for smooth zoom animations
  private readonly BITRATE = 8000000; // 8Mbps for higher quality

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

      // Start recording with optimized chunk size for 60fps
      this.mediaRecorder.start(100); // 100ms chunks for 60fps timing

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
    
    // Track rendering performance
    const startTime = performance.now();
    let lastProgressUpdate = 0;

    while (currentTime < trimEnd && !this.shouldCancel) {
      try {
        // Seek to current time
        this.video.currentTime = Math.min(currentTime, trimEnd - 0.001); // Prevent seeking past end
        
        // Wait for seek to complete with timeout
        await this.waitForSeek();
        
        // Render frame with all effects
        await this.renderFrame(settings, currentTime);
        
        frameCount++;
        currentTime += frameInterval;
        
        // Update progress more efficiently (every 15 frames or 300ms for 60fps)
        const now = performance.now();
        if (frameCount % 15 === 0 || now - lastProgressUpdate > 300) {
          const progress = 20 + (frameCount / totalFrames) * 75; // 20-95% range
          const elapsedSeconds = (now - startTime) / 1000;
          const framesPerSecond = frameCount / elapsedSeconds;
          const estimatedTotalTime = totalFrames / framesPerSecond;
          const remainingTime = Math.max(0, estimatedTotalTime - elapsedSeconds);
          
          // Show zoom effect being processed
          const activeZoom = this.getActiveZoomEffect(settings.zoomEffects, currentTime);
          const zoomMessage = activeZoom ? ` (Zoom ${activeZoom.zoomAmount}x active)` : '';
          
          onProgress({
            phase: 'processing',
            progress: Math.min(95, progress),
            currentTime,
            totalTime: duration,
            message: `Rendering frame ${frameCount}/${totalFrames}${zoomMessage} (~${Math.round(remainingTime)}s remaining)`
          });
          
          lastProgressUpdate = now;
        }
        
        // Reduce blocking with adaptive delay optimized for 60fps
        if (frameCount % 20 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0.5));
        }
      } catch (error) {
        console.warn(`Frame ${frameCount} rendering issue:`, error);
        // Skip problematic frame and continue
        frameCount++;
        currentTime += frameInterval;
      }
    }

    if (this.shouldCancel) {
      throw new Error('Export cancelled by user');
    }
  }

  private async waitForSeek(): Promise<void> {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 150; // Increased timeout for better seeking accuracy
      
      const checkSeek = () => {
        // Check if video has seeked to the correct time and has data
        if (this.video.readyState >= 2) { // HAVE_CURRENT_DATA
          resolve();
        } else if (attempts > maxAttempts) {
          reject(new Error('Video seek timeout'));
        } else {
          attempts++;
          // Use shorter intervals for more responsive seeking
          setTimeout(checkSeek, 8); // ~8ms intervals for 120fps checking
        }
      };
      
      // Use fastSeek for better performance if available
      if ('fastSeek' in this.video) {
        (this.video as any).fastSeek(this.video.currentTime);
      }
      
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

    // Calculate video dimensions with padding (matching preview scaling)
    const paddingScale = (100 - videoPadding) / 100;
    const videoWidth = this.EXPORT_WIDTH * paddingScale;
    const videoHeight = this.EXPORT_HEIGHT * paddingScale;
    const paddingX = (this.EXPORT_WIDTH - videoWidth) / 2;
    const paddingY = (this.EXPORT_HEIGHT - videoHeight) / 2;

    // Get active zoom effect
    const activeZoom = this.getActiveZoomEffect(zoomEffects, currentTime);
    
    this.ctx.save();
    
    // Apply corner radius clipping path to match preview
    if (videoCornerRadius > 0) {
      const scaledRadius = (videoCornerRadius / 100) * Math.min(videoWidth, videoHeight) * 0.1;
      this.roundRect(paddingX, paddingY, videoWidth, videoHeight, scaledRadius);
      this.ctx.clip();
    }

    // Apply transforms in the correct order to match preview
    const interpolatedZoom = activeZoom ? this.getInterpolatedZoom(activeZoom, currentTime) : null;
    this.applyVideoTransforms(cropSettings, interpolatedZoom, paddingX, paddingY, videoWidth, videoHeight);

    // Calculate source coordinates from crop settings - fixed coordinate system
    const sourceX = Math.round((cropSettings.x / 100) * this.video.videoWidth);
    const sourceY = Math.round((cropSettings.y / 100) * this.video.videoHeight);
    const sourceWidth = Math.round((cropSettings.width / 100) * this.video.videoWidth);
    const sourceHeight = Math.round((cropSettings.height / 100) * this.video.videoHeight);

    // Ensure source dimensions are valid
    const clampedSourceX = Math.max(0, Math.min(sourceX, this.video.videoWidth - 1));
    const clampedSourceY = Math.max(0, Math.min(sourceY, this.video.videoHeight - 1));
    const clampedSourceWidth = Math.max(1, Math.min(sourceWidth, this.video.videoWidth - clampedSourceX));
    const clampedSourceHeight = Math.max(1, Math.min(sourceHeight, this.video.videoHeight - clampedSourceY));

    // Draw video frame using 9-parameter drawImage for proper cropping
    this.ctx.drawImage(
      this.video,
      clampedSourceX, clampedSourceY, clampedSourceWidth, clampedSourceHeight,  // Source crop area
      paddingX, paddingY, videoWidth, videoHeight   // Destination area
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

  private getInterpolatedZoom(zoomEffect: ZoomEffect, currentTime: number): { amount: number; targetX: number; targetY: number } {
    const progress = (currentTime - zoomEffect.startTime) / (zoomEffect.endTime - zoomEffect.startTime);
    
    // Use cubic-bezier easing to match CSS transitions: cubic-bezier(0.4, 0, 0.2, 1)
    const easeProgress = this.cubicBezierEasing(progress, 0.4, 0, 0.2, 1);
    
    // Interpolate zoom amount based on zoom speed
    let zoomAmount: number;
    const effectDuration = zoomEffect.endTime - zoomEffect.startTime;
    const zoomSpeed = Math.max(0.1, Math.min(2, zoomEffect.zoomSpeed));
    
    if (effectDuration <= 1) {
      // Short effects: linear interpolation
      zoomAmount = 1 + (zoomEffect.zoomAmount - 1) * easeProgress;
    } else {
      // Longer effects: consider zoom speed
      const speedFactor = zoomSpeed;
      const zoomInDuration = effectDuration * 0.4 * (1 / speedFactor);
      const holdDuration = effectDuration * 0.2;
      const zoomOutDuration = effectDuration * 0.4 * (1 / speedFactor);
      
      const relativeTime = progress * effectDuration;
      
      if (relativeTime <= zoomInDuration) {
        // Zoom in phase
        const zoomProgress = relativeTime / zoomInDuration;
        zoomAmount = 1 + (zoomEffect.zoomAmount - 1) * this.cubicBezierEasing(zoomProgress, 0.4, 0, 0.2, 1);
      } else if (relativeTime <= zoomInDuration + holdDuration) {
        // Hold phase
        zoomAmount = zoomEffect.zoomAmount;
      } else {
        // Zoom out phase
        const zoomOutProgress = (relativeTime - zoomInDuration - holdDuration) / zoomOutDuration;
        zoomAmount = zoomEffect.zoomAmount - (zoomEffect.zoomAmount - 1) * this.cubicBezierEasing(zoomOutProgress, 0.4, 0, 0.2, 1);
      }
    }

    return {
      amount: Math.max(1, zoomAmount),
      targetX: zoomEffect.targetX,
      targetY: zoomEffect.targetY
    };
  }

  private cubicBezierEasing(t: number, x1: number, y1: number, x2: number, y2: number): number {
    // Simplified cubic-bezier implementation for common easing curves
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    
    // For the common ease curve (0.4, 0, 0.2, 1), use approximation
    const c = 3 * x1;
    const b = 3 * (x2 - x1) - c;
    const a = 1 - c - b;
    
    const tSquared = t * t;
    const tCubed = tSquared * t;
    
    return a * tCubed + b * tSquared + c * t;
  }

  private applyVideoTransforms(
    cropSettings: { x: number; y: number; width: number; height: number },
    interpolatedZoom: { amount: number; targetX: number; targetY: number } | null,
    paddingX: number,
    paddingY: number,
    videoWidth: number,
    videoHeight: number
  ): void {
    // Move to the center of the video area first (matches preview transform origin)
    this.ctx.translate(paddingX + videoWidth / 2, paddingY + videoHeight / 2);

    // Apply crop centering transform exactly like getCenteringTransform in preview
    if (cropSettings.width < 100 || cropSettings.height < 100 || cropSettings.x !== 0 || cropSettings.y !== 0) {
      const cropCenterX = cropSettings.x + (cropSettings.width / 2);
      const cropCenterY = cropSettings.y + (cropSettings.height / 2);
      const offsetX = (50 - cropCenterX) * 2;
      const offsetY = (50 - cropCenterY) * 2;
      
      // Scale to match CSS percentage transform
      this.ctx.translate(
        (offsetX / 100) * videoWidth / 2,
        (offsetY / 100) * videoHeight / 2
      );
    }

    // Apply zoom transform exactly like preview CSS transform
    if (interpolatedZoom && interpolatedZoom.amount > 1) {
      const zoomAmount = interpolatedZoom.amount;
      
      // Calculate zoom origin to match preview transformOrigin exactly
      // Preview uses: (targetX / 7) * 100 then clamps to 10-90
      const targetXPercent = Math.max(10, Math.min(90, (interpolatedZoom.targetX / 7) * 100));
      const targetYPercent = Math.max(10, Math.min(90, (interpolatedZoom.targetY / 7) * 100));
      
      // Convert to canvas coordinates relative to video center
      const originX = ((targetXPercent - 50) / 100) * videoWidth;
      const originY = ((targetYPercent - 50) / 100) * videoHeight;
      
      // Apply zoom transform: translate to origin, scale, translate back
      this.ctx.translate(originX, originY);
      this.ctx.scale(zoomAmount, zoomAmount);
      this.ctx.translate(-originX, -originY);
    }

    // Translate back to top-left for drawImage
    this.ctx.translate(-videoWidth / 2, -videoHeight / 2);
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