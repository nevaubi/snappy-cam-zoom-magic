import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Download, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { exportEditedVideo, VideoEditingState } from '@/services/videoExportService';
import { toast } from 'sonner';

interface VideoExportButtonProps {
  videoBlob: Blob | null;
  videoRef: React.RefObject<HTMLVideoElement>;
  // All editing state from CustomVideoPlayer
  editingState: {
    trimStart: number;
    trimEnd: number;
    duration: number;
    videoPadding: number;
    videoCornerRadius: number;
    backgroundColor: string;
    backgroundType: 'color' | 'image';
    backgroundImage: string | null;
    backgroundImageFit: 'cover' | 'contain' | 'fill';
    appliedCropSettings: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    zoomEffects: Array<{
      id: string;
      startTime: number;
      endTime: number;
      zoomAmount: number;
      zoomSpeed: number;
      targetX: number;
      targetY: number;
    }>;
    quality: 'high' | 'medium' | 'low';
  };
}

export const VideoExportButton: React.FC<VideoExportButtonProps> = ({
  videoBlob,
  videoRef,
  editingState
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'success' | 'error'>('idle');

  const handleExport = async () => {
    if (!videoBlob) {
      toast.error('No video to export');
      return;
    }

    setIsExporting(true);
    setExportStatus('exporting');
    setExportProgress(0);

    try {
      // Get original video dimensions
      const video = videoRef.current;
      const originalWidth = video?.videoWidth || 1920;
      const originalHeight = video?.videoHeight || 1080;

      // Prepare editing state for export
      const exportState: VideoEditingState = {
        trimStart: editingState.trimStart,
        trimEnd: editingState.trimEnd,
        duration: editingState.duration,
        videoPadding: editingState.videoPadding,
        videoCornerRadius: editingState.videoCornerRadius,
        backgroundColor: editingState.backgroundColor,
        backgroundType: editingState.backgroundType,
        backgroundImage: editingState.backgroundImage,
        backgroundImageFit: editingState.backgroundImageFit,
        cropSettings: editingState.appliedCropSettings,
        zoomEffects: editingState.zoomEffects,
        quality: editingState.quality,
        originalWidth,
        originalHeight
      };

      // Export video with progress tracking
      const exportedBlob = await exportEditedVideo(
        videoBlob,
        exportState,
        (progress) => setExportProgress(progress)
      );

      // Create download link
      const url = URL.createObjectURL(exportedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `edited-video-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportStatus('success');
      toast.success('Video exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      setExportStatus('error');
      toast.error('Failed to export video. Please try again.');
    } finally {
      setIsExporting(false);
      setTimeout(() => {
        setExportStatus('idle');
        setExportProgress(0);
      }, 3000);
    }
  };

  return (
    <div className="space-y-4">
      {/* Export Button */}
      <Button
        onClick={handleExport}
        disabled={!videoBlob || isExporting}
        size="lg"
        className="w-full"
        variant={exportStatus === 'success' ? 'default' : exportStatus === 'error' ? 'destructive' : 'primary'}
      >
        {isExporting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Exporting... {Math.round(exportProgress)}%
          </>
        ) : exportStatus === 'success' ? (
          <>
            <CheckCircle className="w-4 h-4 mr-2" />
            Export Complete!
          </>
        ) : exportStatus === 'error' ? (
          <>
            <AlertCircle className="w-4 h-4 mr-2" />
            Export Failed
          </>
        ) : (
          <>
            <Download className="w-4 h-4 mr-2" />
            Export Edited Video
          </>
        )}
      </Button>

      {/* Progress Bar */}
      {isExporting && (
        <div className="space-y-2">
          <Progress value={exportProgress} className="w-full" />
          <p className="text-sm text-muted-foreground text-center">
            Processing video with all effects...
          </p>
        </div>
      )}

      {/* Export Info */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p>• Export includes all edits: trim, crop, zoom, background, etc.</p>
        <p>• Output format: MP4 (H.264/AAC) for maximum compatibility</p>
        <p>• Quality: {editingState.quality.toUpperCase()}</p>
      </div>
    </div>
  );
};
