export const getDurationFromBlob = async (blob: Blob): Promise<number> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(blob);
    
    let resolved = false;
    
    const cleanup = () => {
      URL.revokeObjectURL(url);
      if (video.parentNode) {
        video.parentNode.removeChild(video);
      }
    };
    
    const resolveOnce = (duration: number) => {
      if (resolved) return;
      resolved = true;
      cleanup();
      
      // Validate duration
      if (isNaN(duration) || !isFinite(duration) || duration <= 0) {
        reject(new Error('Invalid video duration'));
        return;
      }
      
      console.log('Video duration detected:', duration);
      resolve(duration);
    };
    
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        reject(new Error('Duration detection timeout'));
      }
    }, 10000);
    
    video.addEventListener('loadedmetadata', () => {
      clearTimeout(timeout);
      resolveOnce(video.duration);
    });
    
    video.addEventListener('error', () => {
      clearTimeout(timeout);
      if (!resolved) {
        resolved = true;
        cleanup();
        reject(new Error('Video load error'));
      }
    });
    
    // Set up video element
    video.preload = 'metadata';
    video.style.display = 'none';
    video.muted = true;
    
    // Add to DOM temporarily to ensure metadata loads
    document.body.appendChild(video);
    video.src = url;
  });
};