// src/components/VideoExportModal.tsx
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { AlertCircle, Download, Monitor, Zap, Clock, X } from 'lucide-react';
import { VideoExporter, ExportSettings, ExportProgress, VideoEditSettings } from '@/utils/VideoExporter';
import { toast } from 'sonner';

interface VideoExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  editSettings: VideoEditSettings;
}

export const VideoExportModal: React.FC<VideoExportModalProps> = ({
  isOpen,
  onClose,
  videoUrl,
  editSettings
}) => {
  const [exportQuality, setExportQuality] = useState<ExportSettings['quality']>('high');
  const [exportFormat, setExportFormat] = useState<ExportSettings['format']>('webm');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportedBlob, setExportedBlob] = useState<Blob | null>(null);
  const [exporter, setExporter] = useState<VideoExporter | null>(null);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (exporter) {
        exporter.cancel();
      }
    };
  }, [exporter]);

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress(null);
    setExportedBlob(null);

    const settings: ExportSettings = {
      quality: exportQuality,
      format: exportFormat
    };

    try {
      const videoExporter = new VideoExporter(videoUrl, editSettings, settings);
      setExporter(videoExporter);

      await videoExporter.export(
        // Progress callback
        (progress) => {
          setExportProgress(progress);
        },
        // Complete callback
        (blob) => {
          setExportedBlob(blob);
          setIsExporting(false);
          toast.success('Video exported successfully!');
        },
        // Error callback
        (error) => {
          console.error('Export error:', error);
          setIsExporting(false);
          toast.error('Export failed: ' + error.message);
        }
      );
    } catch (error) {
      console.error('Export setup error:', error);
      setIsExporting(false);
      toast.error('Failed to start export');
    }
  };

  const handleCancel = () => {
    if (exporter) {
      exporter.cancel();
    }
    setIsExporting(false);
    setExportProgress(null);
  };

  const handleDownload = () => {
    if (!exportedBlob) return;

    const url = URL.createObjectURL(exportedBlob);
    const a = document.createElement('a');
    a.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    a.download = `snappy-export-${exportQuality}-${timestamp}.${exportFormat}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Close modal after download
    onClose();
  };

  const formatTime = (milliseconds: number): string => {
    const seconds = Math.ceil(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  const getQualityInfo = (quality: ExportSettings['quality']) => {
    switch (quality) {
      case 'standard':
        return { resolution: '720p', bitrate: '2.5 Mbps', size: '~20 MB/min' };
      case 'high':
        return { resolution: '1080p', bitrate: '5 Mbps', size: '~40 MB/min' };
      case 'ultra':
        return { resolution: '1440p', bitrate: '8 Mbps', size: '~60 MB/min' };
    }
  };

  const qualityInfo = getQualityInfo(exportQuality);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export Video</DialogTitle>
          <DialogDescription>
            Export your edited video with high quality
          </DialogDescription>
        </DialogHeader>

        {!isExporting && !exportedBlob && (
          <div className="space-y-6">
            {/* Quality Selection */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Export Quality</label>
              <Select value={exportQuality} onValueChange={(value) => setExportQuality(value as ExportSettings['quality'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4" />
                      <span>Standard (720p)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="high">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      <span>High (1080p)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="ultra">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-yellow-500" />
                      <span>Ultra (1440p)</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              
              {/* Quality Info */}
              <Card className="p-3 bg-muted/50">
                <div className="text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Resolution:</span>
                    <span className="font-mono">{qualityInfo.resolution}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bitrate:</span>
                    <span className="font-mono">{qualityInfo.bitrate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Est. Size:</span>
                    <span className="font-mono">{qualityInfo.size}</span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Format Selection */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Export Format</label>
              <Select value={exportFormat} onValueChange={(value) => setExportFormat(value as ExportSettings['format'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="webm">WebM (VP9)</SelectItem>
                  <SelectItem value="mp4">MP4 (H.264)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 rounded-md">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div className="text-xs space-y-1">
                <p className="font-medium">Important:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Keep this tab open during export</li>
                  <li>Export runs 2x faster than video length</li>
                  <li>You can minimize the window but don't close it</li>
                </ul>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button onClick={onClose} variant="outline" className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleExport} className="flex-1">
                Start Export
              </Button>
            </div>
          </div>
        )}

        {/* Export Progress */}
        {isExporting && exportProgress && (
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Exporting...</span>
                <span className="text-sm text-muted-foreground">
                  {exportProgress.percentage.toFixed(0)}%
                </span>
              </div>
              
              <Progress value={exportProgress.percentage} className="h-2" />
              
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Frame {exportProgress.currentFrame} of {exportProgress.totalFrames}</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTime(exportProgress.estimatedTimeRemaining)} remaining
                </span>
              </div>
            </div>

            <Card className="p-4 bg-blue-500/10 border-blue-500/20">
              <p className="text-sm text-center">
                Processing your video at {exportQuality === 'ultra' ? '1440p' : exportQuality === 'high' ? '1080p' : '720p'}...
              </p>
            </Card>

            <Button 
              onClick={handleCancel} 
              variant="outline" 
              className="w-full"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel Export
            </Button>
          </div>
        )}

        {/* Export Complete */}
        {exportedBlob && (
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
                <Download className="h-8 w-8 text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold">Export Complete!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Your video is ready to download
                </p>
              </div>
            </div>

            <Card className="p-3 bg-muted/50">
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Quality:</span>
                  <span className="font-mono">{qualityInfo.resolution}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Format:</span>
                  <span className="font-mono uppercase">{exportFormat}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Size:</span>
                  <span className="font-mono">{(exportedBlob.size / (1024 * 1024)).toFixed(1)} MB</span>
                </div>
              </div>
            </Card>

            <div className="flex gap-3">
              <Button onClick={onClose} variant="outline" className="flex-1">
                Done
              </Button>
              <Button onClick={handleDownload} className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
