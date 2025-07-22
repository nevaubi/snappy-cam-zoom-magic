import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle, Download, X } from 'lucide-react';
import { ExportProgress } from '@/utils/VideoExporter';

interface ExportProgressModalProps {
  isOpen: boolean;
  progress: ExportProgress;
  onCancel: () => void;
  onDownload?: () => void;
  exportedBlob?: Blob | null;
}

export const ExportProgressModal: React.FC<ExportProgressModalProps> = ({
  isOpen,
  progress,
  onCancel,
  onDownload,
  exportedBlob
}) => {
  const getPhaseText = () => {
    switch (progress.phase) {
      case 'initializing':
        return 'Initializing Export...';
      case 'processing':
        return 'Rendering Video...';
      case 'finalizing':
        return 'Finalizing Export...';
      case 'complete':
        return 'Export Complete!';
      case 'error':
        return 'Export Failed';
      default:
        return 'Processing...';
    }
  };

  const getTimeRemaining = () => {
    if (progress.currentTime && progress.totalTime && progress.phase === 'processing') {
      const remaining = progress.totalTime - progress.currentTime;
      const minutes = Math.floor(remaining / 60);
      const seconds = Math.floor(remaining % 60);
      return `${minutes}:${seconds.toString().padStart(2, '0')} remaining`;
    }
    return null;
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {progress.phase === 'complete' && (
              <CheckCircle className="h-5 w-5 text-green-500" />
            )}
            {progress.phase === 'error' && (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            )}
            {getPhaseText()}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <Progress 
              value={progress.progress} 
              className="w-full"
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{Math.round(progress.progress)}%</span>
              {getTimeRemaining() && (
                <span>{getTimeRemaining()}</span>
              )}
            </div>
          </div>

          {/* Current Status */}
          {progress.message && (
            <div className="text-sm text-center">
              {progress.message}
            </div>
          )}

          {/* Time Progress for Processing Phase */}
          {progress.phase === 'processing' && progress.currentTime && progress.totalTime && (
            <div className="text-sm text-center text-muted-foreground">
              Processing: {formatTime(progress.currentTime)} / {formatTime(progress.totalTime)}
            </div>
          )}

          {/* Keep Tab Active Warning */}
          {(progress.phase === 'processing' || progress.phase === 'finalizing') && (
            <div className="bg-accent/10 border border-accent/20 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <div className="font-medium">Keep this tab active</div>
                  <div className="text-muted-foreground">
                    Switching tabs may slow down or interrupt the export process
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {progress.phase === 'complete' && exportedBlob && onDownload && (
              <Button 
                onClick={onDownload} 
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Video
              </Button>
            )}
            
            {progress.phase !== 'complete' && (
              <Button 
                variant="outline" 
                onClick={onCancel}
                className="flex-1"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel Export
              </Button>
            )}

            {progress.phase === 'complete' && (
              <Button 
                variant="outline" 
                onClick={onCancel}
                className="flex-1"
              >
                Close
              </Button>
            )}
          </div>

          {/* Export Info */}
          {progress.phase === 'complete' && (
            <div className="text-xs text-center text-muted-foreground">
              Exported as 1440p WebM • 60fps • 8Mbps
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
