// FFmpeg utility functions for video export

/**
 * Validates and sanitizes hex color for FFmpeg
 */
export function sanitizeHexColor(color: string): string {
  // Remove # if present and ensure it's a valid hex color
  const hex = color.replace('#', '');
  if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
    console.warn(`Invalid hex color: ${color}, defaulting to black`);
    return '000000';
  }
  return hex;
}

/**
 * Converts grid position (0-7) to percentage position (0-100)
 */
export function gridToPercentage(gridPos: number, gridSize: number = 8): number {
  return (gridPos / (gridSize - 1)) * 100;
}

/**
 * Calculates frame number from time in seconds
 */
export function timeToFrame(timeSeconds: number, fps: number = 25): number {
  return Math.round(timeSeconds * fps);
}

/**
 * Generates FFmpeg expression for smooth zoom transition
 */
export function generateZoomExpression(
  startFrame: number,
  endFrame: number,
  startZoom: number,
  endZoom: number,
  fps: number = 25
): string {
  const duration = endFrame - startFrame;
  const zoomChange = endZoom - startZoom;
  const zoomPerFrame = zoomChange / duration;
  
  return `if(between(on,${startFrame},${endFrame}),${startZoom}+(on-${startFrame})*${zoomPerFrame},0)`;
}

/**
 * Creates a complex zoom expression for multiple effects
 */
export function buildMultiZoomExpression(
  zoomEffects: Array<{
    startTime: number;
    endTime: number;
    zoomAmount: number;
    zoomSpeed: number;
  }>,
  fps: number = 25
): string {
  if (zoomEffects.length === 0) return '1';
  
  const expressions = zoomEffects.map(effect => {
    const startFrame = timeToFrame(effect.startTime, fps);
    const endFrame = timeToFrame(effect.endTime, fps);
    const zoomFrames = timeToFrame(effect.zoomSpeed, fps);
    
    // Smooth zoom in
    let expr = `if(between(on,${startFrame},${startFrame + zoomFrames}),`;
    expr += `1+(${effect.zoomAmount}-1)*min(1,(on-${startFrame})/${zoomFrames}),`;
    
    // Hold zoom
    expr += `if(between(on,${startFrame + zoomFrames},${endFrame - zoomFrames}),`;
    expr += `${effect.zoomAmount},`;
    
    // Smooth zoom out
    expr += `if(between(on,${endFrame - zoomFrames},${endFrame}),`;
    expr += `${effect.zoomAmount}-(${effect.zoomAmount}-1)*min(1,(on-${endFrame - zoomFrames})/${zoomFrames}),0)))`;
    
    return expr;
  });
  
  // Combine all expressions with addition, then check if any are active
  const combined = expressions.join('+');
  return `if(${combined},${combined},1)`;
}

/**
 * Validates video editing state before export
 */
export function validateEditingState(state: any): string[] {
  const errors: string[] = [];
  
  // Validate required fields
  if (typeof state.trimStart !== 'number' || state.trimStart < 0) {
    errors.push('Invalid trimStart value');
  }
  
  if (typeof state.trimEnd !== 'number' || state.trimEnd <= state.trimStart) {
    errors.push('Invalid trimEnd value');
  }
  
  if (typeof state.duration !== 'number' || state.duration <= 0) {
    errors.push('Invalid duration value');
  }
  
  // Validate crop settings
  const crop = state.cropSettings;
  if (!crop || 
      crop.x < 0 || crop.x > 100 ||
      crop.y < 0 || crop.y > 100 ||
      crop.width <= 0 || crop.width > 100 ||
      crop.height <= 0 || crop.height > 100 ||
      crop.x + crop.width > 100 ||
      crop.y + crop.height > 100) {
    errors.push('Invalid crop settings');
  }
  
  // Validate zoom effects
  if (state.zoomEffects && Array.isArray(state.zoomEffects)) {
    state.zoomEffects.forEach((zoom: any, index: number) => {
      if (zoom.startTime >= zoom.endTime) {
        errors.push(`Zoom effect ${index}: startTime must be less than endTime`);
      }
      if (zoom.zoomAmount < 1 || zoom.zoomAmount > 5) {
        errors.push(`Zoom effect ${index}: zoomAmount must be between 1 and 5`);
      }
      if (zoom.targetX < 0 || zoom.targetX > 7 || zoom.targetY < 0 || zoom.targetY > 7) {
        errors.push(`Zoom effect ${index}: target position out of bounds`);
      }
    });
  }
  
  return errors;
}

/**
 * Estimates export time based on video duration and complexity
 */
export function estimateExportTime(
  duration: number,
  hasZoomEffects: boolean,
  hasBackground: boolean,
  quality: 'high' | 'medium' | 'low'
): number {
  // Base time in seconds per second of video
  let baseTime = 1.5;
  
  // Adjust for quality
  switch (quality) {
    case 'high':
      baseTime *= 2;
      break;
    case 'medium':
      baseTime *= 1.5;
      break;
    case 'low':
      baseTime *= 1;
      break;
  }
  
  // Adjust for effects
  if (hasZoomEffects) baseTime *= 1.5;
  if (hasBackground) baseTime *= 1.2;
  
  return Math.ceil(duration * baseTime);
}

/**
 * Creates FFmpeg command for video preview (lower quality for speed)
 */
export function createPreviewCommand(
  inputPath: string,
  outputPath: string,
  startTime: number,
  duration: number = 5
): string[] {
  return [
    '-ss', startTime.toString(),
    '-i', inputPath,
    '-t', duration.toString(),
    '-vf', 'scale=640:-1',
    '-preset', 'ultrafast',
    '-crf', '28',
    outputPath
  ];
}

/**
 * Handles FFmpeg progress parsing
 */
export function parseFFmpegProgress(
  logLine: string,
  totalDuration: number
): number | null {
  // Parse time from FFmpeg output
  const timeMatch = logLine.match(/time=(\d{2}):(\d{2}):(\d{2})/);
  if (!timeMatch) return null;
  
  const hours = parseInt(timeMatch[1], 10);
  const minutes = parseInt(timeMatch[2], 10);
  const seconds = parseInt(timeMatch[3], 10);
  
  const currentTime = hours * 3600 + minutes * 60 + seconds;
  const progress = (currentTime / totalDuration) * 100;
  
  return Math.min(progress, 100);
}

/**
 * Memory-efficient blob chunking for large videos
 */
export async function* chunkBlob(
  blob: Blob,
  chunkSize: number = 1024 * 1024 * 10 // 10MB chunks
): AsyncGenerator<Uint8Array> {
  let offset = 0;
  
  while (offset < blob.size) {
    const chunk = blob.slice(offset, offset + chunkSize);
    const arrayBuffer = await chunk.arrayBuffer();
    yield new Uint8Array(arrayBuffer);
    offset += chunkSize;
  }
}

/**
 * Detects if browser can handle video export
 */
export function canExportVideo(): { supported: boolean; reason?: string } {
  // Check for required APIs
  if (!window.Worker) {
    return { supported: false, reason: 'Web Workers not supported' };
  }
  
  if (!window.Blob || !window.URL) {
    return { supported: false, reason: 'Blob/URL APIs not supported' };
  }
  
  // Check available memory (rough estimate)
  const memory = (performance as any).memory;
  if (memory && memory.jsHeapSizeLimit < 500 * 1024 * 1024) {
    return { supported: false, reason: 'Insufficient memory available' };
  }
  
  return { supported: true };
}

/**
 * Creates a safe filename for export
 */
export function generateExportFilename(
  prefix: string = 'edited-video',
  quality: string = 'high'
): string {
  const timestamp = new Date().toISOString()
    .replace(/:/g, '-')
    .replace(/\./g, '-')
    .slice(0, 19);
  
  return `${prefix}-${quality}-${timestamp}.mp4`;
}
