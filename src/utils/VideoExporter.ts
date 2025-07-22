// src/utils/VideoExporter.ts
import { ZoomEffect } from '@/components/ZoomTimeline';

export interface ExportSettings {
  quality: 'standard' | 'high' | 'ultra';
  format: 'webm' | 'mp4';
}

export interface ExportProgress {
  currentFrame: number;
  totalFrames: number;
  percentage: number;
  estimatedTimeRemaining: number;
}

export interface VideoEditSettings {
  trimStart: number;
  trimEnd: number;
  cropSettings: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  zoomEffects: ZoomEffect[];
  videoPadding: number;
  videoCornerRadius: number;
  backgroundColor: string;
  backgroundType: 'color' | 'image';
  backgroundImage: string | null;
  backgroundImageFit: 'cover' | 'contain' | 'fill';
}

const QUALITY_CONFIGS = {
  standard: {
    width: 1280,
    height: 720,
    bitrate: 2_500_000,
    frameRate: 30
  },
  high: {
    width: 1920,
    height: 1080,
    bitrate: 5_000_000,
    frameRate: 30
  },
  ultra: {
    width: 2560,
    height: 1440,
    bitrate: 8_000_000,
    frameRate: 30
  }
};

export class VideoExporter {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private video: HTMLVideoElement;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startTime: number = 0;
  private frameCount: number = 0;
  private isExporting: boolean = false;
  private onProgress?: (progress: ExportProgress) => void;
  private onComplete?: (blob: Blob) => void;
  private onError?: (error: Error) => void;
  private backgroundImg?: HTMLImageElement;

  constructor(
    private videoUrl: string,
    private editSettings: VideoEditSettings,
    private exportSettings: ExportSettings
  ) {
    // Create canvas at export resolution
    this.canvas = document.createElement('canvas');
    const config = QUALITY_CONFIGS[exportSettings.quality];
    this.canvas.width = config.width;
    this.canvas.height = config.height;
    
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas 2D context');
    }
    this.ctx = ctx;
    
    // Create video element for playback
    this.video = document.createElement('video');
    this.video.crossOrigin = 'anonymous';
    this.video.muted = true;
    this.video.playbackRate = 2.0; // 2x speed for faster export
  }

  async export(
    onProgress: (progress: ExportProgress) => void,
    onComplete: (blob: Blob) => void,
    onError: (error: Error) => void
  ): Promise<void> {
    this.onProgress = onProgress;
    this.onComplete = onComplete;
    this.onError = onError;
    this.isExporting = true;
    this.chunks = [];
    this.frameCount = 0;
    this.startTime = Date.now();

    try {
      // Load background image if needed
      if (this.editSettings.backgroundType === 'image' && this.editSettings.backgroundImage) {
        await this.loadBackgroundImage(this.editSettings.backgroundImage);
      }

      // Load video
      await this.loadVideo();
      
      // Set up MediaRecorder
      await this.setupRecorder();
      
      // Start export process
      await this.startExport();
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  private async loadBackgroundImage(imageUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.backgroundImg = img;
        resolve();
      };
      img.onerror = () => reject(new Error('Failed to load background image'));
      img.src = imageUrl;
    });
  }

  private async loadVideo(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.video.onloadedmetadata = () => {
        this.video.currentTime = this.editSettings.trimStart;
        resolve();
      };
      this.video.onerror = () => reject(new Error('Failed to load video'));
      this.video.src = this.videoUrl;
    });
  }

  private async setupRecorder(): Promise<void> {
    const config = QUALITY_CONFIGS[this.exportSettings.quality];
    const stream = this.canvas.captureStream(config.frameRate);
    
    const mimeType = this.exportSettings.format === 'mp4' 
      ? 'video/mp4;codecs=h264' 
      : 'video/webm;codecs=vp9';
    
    const options: MediaRecorderOptions = {
      mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : 'video/webm',
      videoBitsPerSecond: config.bitrate
    };

    this.mediaRecorder = new MediaRecorder(stream, options);
    
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.chunks, { 
        type: this.mediaRecorder?.mimeType || 'video/webm' 
      });
      if (this.onComplete) {
        this.onComplete(blob);
      }
    };
  }

  private async startExport(): Promise<void> {
    if (!this.mediaRecorder) return;
    
    this.mediaRecorder.start();
    
    // Wait for video to be seekable
    await new Promise<void>((resolve) => {
      const checkSeekable = () => {
        if (this.video.seekable.length > 0) {
          resolve();
        } else {
          setTimeout(checkSeekable, 100);
        }
      };
      checkSeekable();
    });
    
    // Start playback
    await this.video.play();
    
    // Render frames
    this.renderFrame();
  }

  private renderFrame = (): void => {
    if (!this.isExporting) return;
    
    const currentTime = this.video.currentTime;
    
    // Check if we've reached the end
    if (currentTime >= this.editSettings.trimEnd || this.video.ended) {
      this.finishExport();
      return;
    }
    
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // 1. Draw background
    this.drawBackground();
    
    // 2. Calculate video area with padding
    const padding = this.editSettings.videoPadding / 100;
    const videoArea = {
      x: this.canvas.width * padding / 2,
      y: this.canvas.height * padding / 2,
      width: this.canvas.width * (1 - padding),
      height: this.canvas.height * (1 - padding)
    };
    
    // 3. Apply rounded corners if needed
    if (this.editSettings.videoCornerRadius > 0) {
      this.ctx.save();
      this.createRoundedRectPath(
        videoArea.x,
        videoArea.y,
        videoArea.width,
        videoArea.height,
        this.editSettings.videoCornerRadius
      );
      this.ctx.clip();
    }
    
    // 4. Check for active zoom
    const activeZoom = this.editSettings.zoomEffects.find(zoom => 
      currentTime >= zoom.startTime && currentTime <= zoom.endTime
    );
    
    // 5. Apply transformations and draw video
    this.ctx.save();
    
    if (activeZoom) {
      // Calculate zoom progress
      const zoomProgress = (currentTime - activeZoom.startTime) / 
                          (activeZoom.endTime - activeZoom.startTime);
      const easedProgress = this.easeInOutCubic(zoomProgress);
      
      // Calculate current zoom level
      const currentZoomAmount = 1 + (activeZoom.zoomAmount - 1) * easedProgress;
      
      // Apply zoom transformation
      const centerX = videoArea.x + videoArea.width / 2;
      const centerY = videoArea.y + videoArea.height / 2;
      
      // Translate to zoom target
      const targetX = (activeZoom.targetX / 7) * videoArea.width + videoArea.x;
      const targetY = (activeZoom.targetY / 7) * videoArea.height + videoArea.y;
      
      this.ctx.translate(centerX, centerY);
      this.ctx.scale(currentZoomAmount, currentZoomAmount);
      this.ctx.translate(-targetX, -targetY);
    }
    
    // Apply crop and draw video
    this.drawVideoFrame(videoArea);
    
    this.ctx.restore();
    
    // Restore from rounded corners clip
    if (this.editSettings.videoCornerRadius > 0) {
      this.ctx.restore();
    }
    
    // Update progress
    this.frameCount++;
    this.updateProgress();
    
    // Continue to next frame
    requestAnimationFrame(this.renderFrame);
  };

  private drawBackground(): void {
    if (this.editSettings.backgroundType === 'color') {
      this.ctx.fillStyle = this.editSettings.backgroundColor;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    } else if (this.backgroundImg) {
      this.drawBackgroundImage();
    }
  }

  private drawBackgroundImage(): void {
    if (!this.backgroundImg) return;
    
    const canvasAspect = this.canvas.width / this.canvas.height;
    const imgAspect = this.backgroundImg.width / this.backgroundImg.height;
    
    let sx = 0, sy = 0, sw = this.backgroundImg.width, sh = this.backgroundImg.height;
    let dx = 0, dy = 0, dw = this.canvas.width, dh = this.canvas.height;
    
    if (this.editSettings.backgroundImageFit === 'cover') {
      if (canvasAspect > imgAspect) {
        // Canvas is wider, fit height
        const scale = this.canvas.width / this.backgroundImg.width;
        dh = this.backgroundImg.height * scale;
        dy = (this.canvas.height - dh) / 2;
      } else {
        // Canvas is taller, fit width
        const scale = this.canvas.height / this.backgroundImg.height;
        dw = this.backgroundImg.width * scale;
        dx = (this.canvas.width - dw) / 2;
      }
    } else if (this.editSettings.backgroundImageFit === 'contain') {
      if (canvasAspect > imgAspect) {
        // Canvas is wider, fit height
        const scale = this.canvas.height / this.backgroundImg.height;
        dw = this.backgroundImg.width * scale;
        dx = (this.canvas.width - dw) / 2;
      } else {
        // Canvas is taller, fit width
        const scale = this.canvas.width / this.backgroundImg.width;
        dh = this.backgroundImg.height * scale;
        dy = (this.canvas.height - dh) / 2;
      }
    }
    // 'fill' uses default values (stretch to fit)
    
    this.ctx.drawImage(this.backgroundImg, sx, sy, sw, sh, dx, dy, dw, dh);
  }

  private drawVideoFrame(videoArea: { x: number; y: number; width: number; height: number }): void {
    const crop = this.editSettings.cropSettings;
    
    // Calculate source rectangle (what part of video to draw)
    const srcX = (crop.x / 100) * this.video.videoWidth;
    const srcY = (crop.y / 100) * this.video.videoHeight;
    const srcW = (crop.width / 100) * this.video.videoWidth;
    const srcH = (crop.height / 100) * this.video.videoHeight;
    
    // Draw video frame
    this.ctx.drawImage(
      this.video,
      srcX, srcY, srcW, srcH,
      videoArea.x, videoArea.y, videoArea.width, videoArea.height
    );
  }

  private createRoundedRectPath(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ): void {
    radius = Math.min(radius, width / 2, height / 2);
    
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

  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  private updateProgress(): void {
    if (!this.onProgress) return;
    
    const currentTime = this.video.currentTime - this.editSettings.trimStart;
    const totalTime = this.editSettings.trimEnd - this.editSettings.trimStart;
    const percentage = (currentTime / totalTime) * 100;
    
    const elapsed = Date.now() - this.startTime;
    const estimatedTotal = elapsed / (percentage / 100);
    const estimatedRemaining = Math.max(0, estimatedTotal - elapsed);
    
    const config = QUALITY_CONFIGS[this.exportSettings.quality];
    const totalFrames = Math.floor(totalTime * config.frameRate);
    
    this.onProgress({
      currentFrame: this.frameCount,
      totalFrames,
      percentage: Math.min(100, percentage),
      estimatedTimeRemaining: estimatedRemaining
    });
  }

  private finishExport(): void {
    this.isExporting = false;
    this.video.pause();
    
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  private handleError(error: Error): void {
    this.isExporting = false;
    if (this.video) {
      this.video.pause();
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    if (this.onError) {
      this.onError(error);
    }
  }

  cancel(): void {
    this.isExporting = false;
    this.finishExport();
  }
}
