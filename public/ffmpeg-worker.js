// FFmpeg WebAssembly worker setup
// This file helps with proper WASM loading and SharedArrayBuffer support

self.addEventListener('message', async (event) => {
  const { type, data } = event.data;
  
  if (type === 'LOAD_FFMPEG') {
    try {
      // Import FFmpeg core from local node_modules
      const { createFFmpegCore } = await import('/node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js');
      
      const core = await createFFmpegCore({
        wasmURL: '/node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm'
      });
      
      self.postMessage({ type: 'FFMPEG_LOADED', success: true });
    } catch (error) {
      console.error('Worker failed to load FFmpeg:', error);
      self.postMessage({ type: 'FFMPEG_LOADED', success: false, error: error.message });
    }
  }
});