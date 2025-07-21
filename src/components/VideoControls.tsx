import React from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause, SkipBack, Download, Loader2 } from 'lucide-react';

interface VideoControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onGoToStart: () => void;
  onExport: () => void;
  isExporting: boolean;
  hasEdits: boolean;
}

export const VideoControls: React.FC<VideoControlsProps> = ({
  isPlaying,
  onPlayPause,
  onGoToStart,
  onExport,
  isExporting,
  hasEdits
}) => {
  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        onClick={onPlayPause}
        className="flex items-center gap-2 text-foreground border-border hover:bg-accent hover:text-accent-foreground"
      >
        {isPlaying ? (
          <>
            <Pause className="w-4 h-4" />
            Pause
          </>
        ) : (
          <>
            <Play className="w-4 h-4" />
            Play
          </>
        )}
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={onGoToStart}
        className="flex items-center gap-2 text-foreground border-border hover:bg-accent hover:text-accent-foreground"
      >
        <SkipBack className="w-4 h-4" />
        Go to Start
      </Button>

      {hasEdits && (
        <Button
          onClick={onExport}
          disabled={isExporting}
          className="flex items-center gap-2"
        >
          {isExporting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Exporting...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Export Edited Video
            </>
          )}
        </Button>
      )}
    </div>
  );
};