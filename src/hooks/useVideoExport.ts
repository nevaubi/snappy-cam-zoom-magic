// src/hooks/useVideoExport.ts
import { useState, useCallback } from 'react';
import { VideoExporter, ExportSettings, ExportProgress, VideoEditSettings } from '@/utils/VideoExporter';
import { toast } from 'sonner';

export interface VideoExportState {
  isExporting: boolean;
  progress: ExportProgress | null;
  exportedBlob: Blob | null;
  error: Error | null;
}

export const useVideoExport = () => {
  const [state, setState] = useState<VideoExportState>({
    isExporting: false,
    progress: null,
    exportedBlob: null,
    error: null
  });

  const [currentExporter, setCurrentExporter] = useState<VideoExporter | null>(null);

  const exportVideo = useCallback(async (
    videoUrl: string,
    editSettings: VideoEditSettings,
    exportSettings: ExportSettings
  ) => {
    // Reset state
    setState({
      isExporting: true,
      progress: null,
      exportedBlob: null,
      error: null
    });

    try {
      const exporter = new VideoExporter(videoUrl, editSettings, exportSettings);
      setCurrentExporter(exporter);

      await exporter.export(
        // Progress callback
        (progress) => {
          setState(prev => ({ ...prev, progress }));
        },
        // Complete callback
        (blob) => {
          setState(prev => ({
            ...prev,
            isExporting: false,
            exportedBlob: blob,
            error: null
          }));
          setCurrentExporter(null);
          toast.success('Video exported successfully!');
        },
        // Error callback
        (error) => {
          setState(prev => ({
            ...prev,
            isExporting: false,
            error,
            exportedBlob: null
          }));
          setCurrentExporter(null);
          toast.error('Export failed: ' + error.message);
        }
      );
    } catch (error) {
      setState(prev => ({
        ...prev,
        isExporting: false,
        error: error as Error,
        exportedBlob: null
      }));
      setCurrentExporter(null);
      toast.error('Failed to start export');
    }
  }, []);

  const cancelExport = useCallback(() => {
    if (currentExporter) {
      currentExporter.cancel();
      setCurrentExporter(null);
      setState(prev => ({
        ...prev,
        isExporting: false,
        progress: null
      }));
      toast.info('Export cancelled');
    }
  }, [currentExporter]);

  const downloadExportedVideo = useCallback((filename?: string) => {
    if (!state.exportedBlob) return;

    const url = URL.createObjectURL(state.exportedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `video-export-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [state.exportedBlob]);

  const resetExport = useCallback(() => {
    setState({
      isExporting: false,
      progress: null,
      exportedBlob: null,
      error: null
    });
  }, []);

  return {
    ...state,
    exportVideo,
    cancelExport,
    downloadExportedVideo,
    resetExport
  };
};
