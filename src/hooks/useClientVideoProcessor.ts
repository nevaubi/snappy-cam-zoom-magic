import { useState } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { supabase } from '@/integrations/supabase/client';

interface ProcessingProgress {
  stage: 'downloading' | 'loading-ffmpeg' | 'processing' | 'uploading' | 'complete';
  progress: number;
  message: string;
}

export const useClientVideoProcessor = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ProcessingProgress | null>(null);

  const processVideo = async (
    videoUrl: string,
    trimStart: number,
    trimEnd: number,
    originalFilename: string
  ): Promise<string> => {
    setIsProcessing(true);
    let ffmpeg: FFmpeg | null = null;
    
    try {
      // Stage 1: Download video
      setProgress({
        stage: 'downloading',
        progress: 0,
        message: 'Downloading video...'
      });

      const videoResponse = await fetch(videoUrl);
      if (!videoResponse.ok) {
        throw new Error(`Failed to download video: ${videoResponse.statusText}`);
      }
      
      const videoBlob = await videoResponse.blob();
      const videoData = await fetchFile(videoBlob);

      setProgress({
        stage: 'downloading',
        progress: 100,
        message: 'Video downloaded successfully'
      });

      // Stage 2: Load FFmpeg
      setProgress({
        stage: 'loading-ffmpeg',
        progress: 0,
        message: 'Loading FFmpeg WASM...'
      });

      ffmpeg = new FFmpeg();
      
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
      const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');
      
      await ffmpeg.load({
        coreURL,
        wasmURL,
      });

      setProgress({
        stage: 'loading-ffmpeg',
        progress: 100,
        message: 'FFmpeg loaded successfully'
      });

      // Stage 3: Process video
      setProgress({
        stage: 'processing',
        progress: 0,
        message: 'Processing video...'
      });

      const inputFilename = 'input.webm';
      const outputFilename = 'output.webm';
      
      await ffmpeg.writeFile(inputFilename, videoData);
      
      const duration = trimEnd - trimStart;
      
      // Execute FFmpeg command to trim the video
      await ffmpeg.exec([
        '-i', inputFilename,
        '-ss', trimStart.toString(),
        '-t', duration.toString(),
        '-c', 'copy',
        outputFilename
      ]);
      
      const processedData = await ffmpeg.readFile(outputFilename);
      
      setProgress({
        stage: 'processing',
        progress: 100,
        message: 'Video processing completed'
      });

      // Stage 4: Upload processed video
      setProgress({
        stage: 'uploading',
        progress: 0,
        message: 'Uploading processed video...'
      });

      const processedBlob = new Blob([processedData], { type: 'video/webm' });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `processed-${timestamp}-${originalFilename}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('recorded-videos')
        .upload(filename, processedBlob, {
          contentType: 'video/webm',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      const { data: { publicUrl } } = supabase.storage
        .from('recorded-videos')
        .getPublicUrl(uploadData.path);

      setProgress({
        stage: 'uploading',
        progress: 100,
        message: 'Upload completed'
      });

      setProgress({
        stage: 'complete',
        progress: 100,
        message: 'Video processing completed successfully!'
      });

      return publicUrl;

    } catch (error) {
      console.error('Client-side video processing error:', error);
      throw error;
    } finally {
      if (ffmpeg) {
        try {
          ffmpeg.terminate();
        } catch (e) {
          console.warn('Error terminating FFmpeg:', e);
        }
      }
      setIsProcessing(false);
      setTimeout(() => setProgress(null), 3000);
    }
  };

  return {
    processVideo,
    isProcessing,
    progress
  };
};