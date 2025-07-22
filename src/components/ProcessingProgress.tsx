import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Download, Settings, Zap, Upload, CheckCircle } from 'lucide-react';

interface ProcessingProgressProps {
  stage: 'downloading' | 'loading-ffmpeg' | 'processing' | 'uploading' | 'complete';
  progress: number;
  message: string;
}

const stageIcons = {
  downloading: Download,
  'loading-ffmpeg': Settings,
  processing: Zap,
  uploading: Upload,
  complete: CheckCircle,
};

const stageLabels = {
  downloading: 'Downloading Video',
  'loading-ffmpeg': 'Loading FFmpeg',
  processing: 'Processing Video',
  uploading: 'Uploading Result',
  complete: 'Complete',
};

export const ProcessingProgress: React.FC<ProcessingProgressProps> = ({
  stage,
  progress,
  message,
}) => {
  const Icon = stageIcons[stage];
  const stageLabel = stageLabels[stage];

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <div className="font-medium text-sm">{stageLabel}</div>
            <div className="text-xs text-muted-foreground">{message}</div>
          </div>
        </div>
        
        <div className="space-y-2">
          <Progress value={progress} className="w-full" />
          <div className="text-right text-xs text-muted-foreground">
            {Math.round(progress)}%
          </div>
        </div>
      </CardContent>
    </Card>
  );
};