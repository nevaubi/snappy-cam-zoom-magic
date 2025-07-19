interface StreamConfig {
  webcamEnabled: boolean;
  screenEnabled: boolean;
}

interface StreamState {
  screenStream: MediaStream | null;
  webcamStream: MediaStream | null;
  screenVideo: HTMLVideoElement | null;
  webcamVideo: HTMLVideoElement | null;
  isReady: boolean;
}

export class StreamManager {
  private state: StreamState = {
    screenStream: null,
    webcamStream: null,
    screenVideo: null,
    webcamVideo: null,
    isReady: false
  };

  private listeners: Array<() => void> = [];

  async initializeStreams(config: StreamConfig): Promise<void> {
    try {
      this.state.isReady = false;
      
      const promises: Promise<void>[] = [];

      // Initialize screen capture
      if (config.screenEnabled) {
        promises.push(this.initializeScreen());
      }

      // Initialize webcam
      if (config.webcamEnabled) {
        promises.push(this.initializeWebcam());
      }

      await Promise.all(promises);
      this.state.isReady = true;
      this.notifyListeners();
    } catch (error) {
      console.error('Stream initialization failed:', error);
      throw error;
    }
  }

  private async initializeScreen(): Promise<void> {
    try {
      this.state.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: 1920, height: 1080, frameRate: 30 },
        audio: true
      });

      this.state.screenVideo = document.createElement('video');
      this.state.screenVideo.muted = true;
      this.state.screenVideo.autoplay = true;
      this.state.screenVideo.playsInline = true;
      this.state.screenVideo.srcObject = this.state.screenStream;

      return new Promise((resolve, reject) => {
        this.state.screenVideo!.addEventListener('canplay', () => resolve(), { once: true });
        this.state.screenVideo!.addEventListener('error', reject, { once: true });
        this.state.screenVideo!.play().catch(reject);
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        throw new Error('Screen recording permission denied');
      }
      throw new Error('Failed to capture screen');
    }
  }

  private async initializeWebcam(): Promise<void> {
    try {
      this.state.webcamStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, frameRate: 30 },
        audio: false
      });

      this.state.webcamVideo = document.createElement('video');
      this.state.webcamVideo.muted = true;
      this.state.webcamVideo.autoplay = true;
      this.state.webcamVideo.playsInline = true;
      this.state.webcamVideo.srcObject = this.state.webcamStream;

      return new Promise((resolve, reject) => {
        this.state.webcamVideo!.addEventListener('canplay', () => resolve(), { once: true });
        this.state.webcamVideo!.addEventListener('error', reject, { once: true });
        this.state.webcamVideo!.play().catch(reject);
      });
    } catch (error) {
      console.warn('Webcam access failed:', error);
      // Don't throw for webcam failures, just log warning
    }
  }

  getScreenVideo(): HTMLVideoElement | null {
    return this.state.screenVideo;
  }

  getWebcamVideo(): HTMLVideoElement | null {
    return this.state.webcamVideo;
  }

  getScreenStream(): MediaStream | null {
    return this.state.screenStream;
  }

  getWebcamStream(): MediaStream | null {
    return this.state.webcamStream;
  }

  isReady(): boolean {
    return this.state.isReady;
  }

  onReady(callback: () => void): void {
    this.listeners.push(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach(callback => callback());
  }

  cleanup(): void {
    // Stop all streams
    if (this.state.screenStream) {
      this.state.screenStream.getTracks().forEach(track => track.stop());
    }
    if (this.state.webcamStream) {
      this.state.webcamStream.getTracks().forEach(track => track.stop());
    }

    // Clear state
    this.state = {
      screenStream: null,
      webcamStream: null,
      screenVideo: null,
      webcamVideo: null,
      isReady: false
    };

    this.listeners = [];
  }
}

// Canvas drawing utility to replace roundRect for compatibility
export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  if (radius === 0) {
    ctx.rect(x, y, width, height);
    return;
  }

  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}