export interface RecordingOptions {
  width?: number;
  height?: number;
  frameRate?: number;
  videoBitsPerSecond?: number;
  mimeType?: string;
}

export interface RecordingProgress {
  isRecording: boolean;
  recordingTime: number;
  totalDuration: number;
  status: 'idle' | 'preparing' | 'recording' | 'processing' | 'completed' | 'error';
  error?: string;
}

export class ScreenRecordingExporter {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private progressCallback?: (progress: RecordingProgress) => void;
  private startTime: number = 0;
  private expectedDuration: number = 0;
  private recordingTimeout: NodeJS.Timeout | null = null;

  constructor(private options: RecordingOptions = {}) {
    this.options = {
      width: 1920,
      height: 1080,
      frameRate: 60,
      videoBitsPerSecond: 8000000, // 8 Mbps for high quality
      mimeType: 'video/webm;codecs=h264',
      ...options
    };
  }

  async requestScreenCapture(): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: this.options.width },
          height: { ideal: this.options.height },
          frameRate: { ideal: this.options.frameRate }
        },
        audio: false // We'll add audio from the original video separately if needed
      });

      return stream;
    } catch (error) {
      throw new Error(`Failed to capture screen: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async startRecording(
    duration: number,
    onProgress?: (progress: RecordingProgress) => void
  ): Promise<void> {
    this.progressCallback = onProgress;
    this.expectedDuration = duration;
    this.recordedChunks = [];
    
    try {
      this.updateProgress('preparing', 0);
      
      const stream = await this.requestScreenCapture();
      
      // Check if browser supports the preferred codec
      const mimeType = MediaRecorder.isTypeSupported(this.options.mimeType!) 
        ? this.options.mimeType!
        : 'video/webm';

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: this.options.videoBitsPerSecond
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        this.updateProgress('processing', this.expectedDuration);
      };

      this.mediaRecorder.onerror = (event) => {
        this.updateProgress('error', 0, 'Recording failed');
        console.error('MediaRecorder error:', event);
      };

      this.updateProgress('recording', 0);
      this.mediaRecorder.start(100); // Collect data every 100ms
      this.startTime = Date.now();

      // Update progress during recording
      const progressInterval = setInterval(() => {
        if (this.mediaRecorder?.state === 'recording') {
          const elapsed = (Date.now() - this.startTime) / 1000;
          this.updateProgress('recording', elapsed);
          
          if (elapsed >= this.expectedDuration) {
            this.stopRecording();
            clearInterval(progressInterval);
          }
        } else {
          clearInterval(progressInterval);
        }
      }, 100);

      // Auto-stop after expected duration (with small buffer)
      this.recordingTimeout = setTimeout(() => {
        this.stopRecording();
      }, (duration + 1) * 1000);

    } catch (error) {
      this.updateProgress('error', 0, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        reject(new Error('No active recording to stop'));
        return;
      }

      if (this.recordingTimeout) {
        clearTimeout(this.recordingTimeout);
        this.recordingTimeout = null;
      }

      this.mediaRecorder.onstop = () => {
        this.updateProgress('processing', this.expectedDuration);
        
        const blob = new Blob(this.recordedChunks, { 
          type: this.recordedChunks[0]?.type || 'video/webm' 
        });
        
        this.updateProgress('completed', this.expectedDuration);
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  private updateProgress(
    status: RecordingProgress['status'], 
    recordingTime: number, 
    error?: string
  ) {
    if (this.progressCallback) {
      this.progressCallback({
        isRecording: status === 'recording',
        recordingTime,
        totalDuration: this.expectedDuration,
        status,
        error
      });
    }
  }

  async exportToFile(blob: Blob, filename: string = 'exported-video.webm'): Promise<void> {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  isSupported(): boolean {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia && MediaRecorder);
  }

  getSupportedMimeTypes(): string[] {
    const types = [
      'video/webm;codecs=h264',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4'
    ];
    
    return types.filter(type => MediaRecorder.isTypeSupported(type));
  }
}