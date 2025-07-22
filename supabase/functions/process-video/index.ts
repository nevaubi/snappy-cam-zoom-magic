import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Define types for the video processing settings
interface ExportSettings {
  videoUrl: string;
  trimStart: number;
  trimEnd: number;
  cropSettings: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  backgroundSettings: {
    type: 'color' | 'image';
    color: string;
    image: string | null;
    imageFit: 'cover' | 'contain' | 'fill';
  };
  displaySettings: {
    padding: number;
    cornerRadius: number;
  };
  zoomEffects: any[] | null;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Helper function to download video from URL
async function downloadVideo(url: string): Promise<Uint8Array> {
  console.log('Downloading video from:', url);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

// Helper function to process video with FFmpeg
async function processVideoWithFFmpeg(
  videoData: Uint8Array,
  trimStart: number,
  trimEnd: number
): Promise<Uint8Array> {
  console.log('Edge function received video processing request - trim from', trimStart, 'to', trimEnd);
  console.log('Note: Processing will be done client-side, returning original video data');
  
  // Edge function now just validates parameters and passes through the video data
  // Actual processing happens client-side with FFmpeg WASM
  if (trimStart >= trimEnd) {
    throw new Error('Invalid trim parameters: start time must be less than end time');
  }
  
  if (trimStart < 0) {
    throw new Error('Invalid trim parameters: start time cannot be negative');
  }
  
  // Return original video data - processing happens client-side
  return videoData;
}

// Helper function to upload processed video to Supabase Storage
async function uploadProcessedVideo(videoData: Uint8Array, originalFilename: string): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `processed-${timestamp}-${originalFilename}`;
  
  console.log('Uploading processed video:', filename);
  
  const { data, error } = await supabase.storage
    .from('recorded-videos')
    .upload(filename, videoData, {
      contentType: 'video/webm',
      upsert: false
    });
  
  if (error) {
    console.error('Upload error:', error);
    throw new Error(`Failed to upload processed video: ${error.message}`);
  }
  
  // Get the public URL
  const { data: { publicUrl } } = supabase.storage
    .from('recorded-videos')
    .getPublicUrl(filename);
  
  console.log('Video uploaded successfully:', publicUrl);
  return publicUrl;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoUrl, trimStart, trimEnd, cropSettings, backgroundSettings, displaySettings, zoomEffects }: ExportSettings = await req.json();

    console.log('Processing video export request:', {
      videoUrl,
      trimStart,
      trimEnd,
      cropSettings,
      backgroundSettings,
      displaySettings,
      zoomEffects: zoomEffects?.length || 0
    });

    // Phase 2: Implement video processing pipeline
    
    // Step 1: Download the source video
    const videoData = await downloadVideo(videoUrl);
    console.log('Video downloaded, size:', videoData.length, 'bytes');
    
    // Step 2: Process video with trim settings
    const processedVideoData = await processVideoWithFFmpeg(videoData, trimStart, trimEnd);
    
    // Step 3: Extract filename from original URL
    const urlParts = videoUrl.split('/');
    const originalFilename = urlParts[urlParts.length - 1] || 'video.webm';
    
    // Step 4: Upload processed video to Supabase Storage
    const processedVideoUrl = await uploadProcessedVideo(processedVideoData, originalFilename);
    
    // Step 5: Return the processed video URL
    const response = {
      success: true,
      processedVideoUrl,
      message: 'Video processing completed successfully',
      settings: {
        trimStart,
        trimEnd,
        hasCrop: cropSettings.width !== 100 || cropSettings.height !== 100 || cropSettings.x !== 0 || cropSettings.y !== 0,
        hasBackground: backgroundSettings.type === 'image' || backgroundSettings.color !== '#000000',
        hasZoom: zoomEffects && zoomEffects.length > 0
      }
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Video processing error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to process video' 
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});