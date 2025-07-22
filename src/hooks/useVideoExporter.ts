import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

import { useCallback } from 'react';

/**
 * Represents a single zoom effect applied to the video.  Each effect is
 * defined by a start and end time (in seconds), the target zoom amount
 * (e.g. 2 for 2× zoom), the duration of the zoom transition (zoomSpeed)
 * and the target grid coordinates where the zoom should be centred.  The
 * grid coordinates are expressed on a 7×7 grid (0 to 6 on both axes) as
 * used in the editing UI.
 */
export interface ZoomEffect {
  id?: string;
  startTime: number;
  endTime: number;
  zoomAmount: number;
  zoomSpeed: number;
  targetX: number;
  targetY: number;
}

/**
 * Options required to faithfully reconstruct the edited video during
 * export.  All numeric values are in pixels unless noted otherwise.
 */
export interface ExportOptions {
  /**
   * Cropping rectangle expressed as percentages of the original video
   * dimensions.  The values correspond to the user‑selected crop in the
   * editing UI.
   */
  crop: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /**
   * Additional padding applied around the cropped video, expressed as a
   * percentage.  A value of 0 means no padding and 100 means the video is
   * fully scaled down to a point.  This corresponds to the “Video Scale”
   * slider in the editor.
   */
  padding: number;
  /**
   * Corner radius for the video frame in pixels.  This value is applied
   * after cropping and scaling so that rounded corners appear at the
   * appropriate size in the exported video.
   */
  cornerRadius: number;
  /**
   * Determines whether a solid colour or an uploaded image is used as the
   * background behind the video.
   */
  backgroundType: 'color' | 'image';
  /**
   * Hexadecimal RGB colour (e.g. "#000000") used for the background when
   * backgroundType is "color".
   */
  backgroundColor?: string;
  /**
   * Optional image used as the background when backgroundType is "image".
   * The caller must provide a Blob containing the image data (PNG or JPG).
   */
  backgroundImage?: Blob;
  /**
   * Determines how the background image should be fitted into the output
   * frame.  "cover" scales the image to fill the frame and crops any
   * overflow, "contain" scales the image to fit entirely within the frame
   * and pads any remaining space, and "fill" stretches the image to
   * exactly match the frame dimensions.
   */
  backgroundImageFit?: 'cover' | 'contain' | 'fill';
  /**
   * List of zoom effects specified by the user.  The exporter will
   * approximate dynamic zoom by using the maximum zoom amount found in
   * this array.  If no zoom effects are provided the video is exported
   * without additional zoom.
   */
  zoomEffects: ZoomEffect[];
  /**
   * Time (in seconds) at which to start the export.  Frames before this
   * point are discarded.
   */
  trimStart: number;
  /**
   * Time (in seconds) at which to end the export.  Frames after this
   * point are discarded.  The trimmed duration is trimEnd – trimStart.
   */
  trimEnd: number;
  /**
   * Controls the Constant Rate Factor used by libvpx/vp9.  Lower values
   * produce higher quality (and larger files).  The values match the
   * existing quality settings: "high" → CRF 18, "medium" → 23,
   * "low" → 28.
   */
  quality: 'high' | 'medium' | 'low';
  /**
   * Natural width of the source video in pixels.  This can be obtained
   * from the <video> element via video.videoWidth.
   */
  videoWidth: number;
  /**
   * Natural height of the source video in pixels.  This can be obtained
   * from the <video> element via video.videoHeight.
   */
  videoHeight: number;
}

// Shared FFmpeg instance across exports.  Loading the WASM binary is
// expensive, so reuse a single instance.
let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoaded = false;
let ffmpegLoadPromise: Promise<void> | null = null;

/**
 * Convert a rounded rectangle into a PNG mask.  The white region in the
 * returned image defines the visible area and the transparent region
 * defines the rounded corners.  The mask is sized to the provided
 * width/height so that it matches the scaled video frame exactly.
 *
 * @param width Pixel width of the mask.
 * @param height Pixel height of the mask.
 * @param radius Radius of the rounded corners in pixels.
 * @returns A Promise that resolves with a Blob containing a PNG image.
 */
async function createRoundedMaskPNG(width: number, height: number, radius: number): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create canvas context');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'white';
  ctx.beginPath();
  const r = Math.min(radius, canvas.width / 2, canvas.height / 2);
  // Draw a rounded rectangle
  ctx.moveTo(r, 0);
  ctx.lineTo(canvas.width - r, 0);
  ctx.quadraticCurveTo(canvas.width, 0, canvas.width, r);
  ctx.lineTo(canvas.width, canvas.height - r);
  ctx.quadraticCurveTo(canvas.width, canvas.height, canvas.width - r, canvas.height);
  ctx.lineTo(r, canvas.height);
  ctx.quadraticCurveTo(0, canvas.height, 0, canvas.height - r);
  ctx.lineTo(0, r);
  ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath();
  ctx.fill();
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        throw new Error('Failed to convert mask canvas to Blob');
      }
      resolve(blob);
    }, 'image/png');
  });
}

/**
 * Hook providing video export functionality using FFmpeg.  It exposes
 * a single function `exportVideo` which accepts a source video blob and
 * a set of export options describing all user‑applied edits.  The
 * resulting exported video preserves cropping, padding, background
 * colours/images and approximate zoom.  If progress reporting is
 * desired the caller can supply an onProgress callback.
 */
export const useVideoExporter = () => {
  /**
   * Load the FFmpeg WASM module if it hasn't already been loaded.  This
   * function ensures that multiple concurrent calls wait on the same
   * underlying promise.  Without this guard the module could be loaded
   * multiple times which is both slow and wasteful.
   */
  const loadFFmpeg = useCallback(async () => {
    if (ffmpegLoaded) return;
    if (ffmpegLoadPromise) {
      await ffmpegLoadPromise;
      return;
    }
    ffmpegLoadPromise = (async () => {
      const ffmpeg = new FFmpeg();
      ffmpegInstance = ffmpeg;
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      // Preload the core script and wasm
      const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
      const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');
      await ffmpeg.load({ coreURL, wasmURL });
      ffmpegLoaded = true;
    })();
    await ffmpegLoadPromise;
  }, []);

  /**
   * Perform an export of the given video using the supplied options.  The
   * implementation constructs a complex FFmpeg filter graph to crop,
   * scale, overlay backgrounds and apply a rounded mask.  A simplified
   * approximation of dynamic zoom is achieved by scaling the video by
   * the maximum zoom amount across all specified effects.  More
   * sophisticated animations could be implemented by splitting the
   * timeline and applying time‑varying expressions, but this export
   * function favours robustness and clarity.
   *
   * @param videoBlob The source video as a Blob.
   * @param options User editing parameters.
   * @param onProgress Optional callback receiving progress percentage (0–100).
   * @returns A Promise resolving with a new Blob containing the exported video.
   */
  const exportVideo = useCallback(async (
    videoBlob: Blob,
    options: ExportOptions,
    onProgress?: (progress: number) => void
  ): Promise<Blob> => {
    await loadFFmpeg();
    if (!ffmpegInstance) throw new Error('FFmpeg has not been initialised');
    const ffmpeg = ffmpegInstance;
    // Write the input video to the virtual FS
    await ffmpeg.writeFile('input.webm', await fetchFile(videoBlob));
    // Write background image if provided
    let bgImageIndex = -1;
    if (options.backgroundType === 'image' && options.backgroundImage) {
      await ffmpeg.writeFile('bg.png', await fetchFile(options.backgroundImage));
      bgImageIndex = 1; // second input when mask is also provided
    }
    // Compute derived values
    const {
      crop,
      padding,
      cornerRadius,
      backgroundType,
      backgroundColor = '#000000',
      backgroundImageFit = 'cover',
      zoomEffects,
      trimStart,
      trimEnd,
      quality,
      videoWidth,
      videoHeight,
    } = options;
    const cropWidthPx = videoWidth * (crop.width / 100);
    const cropHeightPx = videoHeight * (crop.height / 100);
    const cropXpx = videoWidth * (crop.x / 100);
    const cropYpx = videoHeight * (crop.y / 100);
    // Determine the maximum zoom amount; default to 1 if none
    const maxZoom = zoomEffects && zoomEffects.length > 0 ? Math.max(...zoomEffects.map((z) => z.zoomAmount || 1)) : 1;
    // Calculate the overall scale factor from padding and zoom
    const scaleFactor = (1 - padding / 100) * maxZoom;
    const scaledWidthPx = Math.max(1, Math.round(cropWidthPx * scaleFactor));
    const scaledHeightPx = Math.max(1, Math.round(cropHeightPx * scaleFactor));
    // Compute offsets to centre the cropped region within the original frame
    const offsetXpx = videoWidth / 2 - (cropXpx + cropWidthPx / 2);
    const offsetYpx = videoHeight / 2 - (cropYpx + cropHeightPx / 2);
    const overlayXpx = Math.round(videoWidth - scaledWidthPx / 2 - cropXpx - cropWidthPx / 2);
    const overlayYpx = Math.round(videoHeight - scaledHeightPx / 2 - cropYpx - cropHeightPx / 2);
    const trimmedDuration = Math.max(0, trimEnd - trimStart);
    // Generate the rounded mask PNG.  Scale the radius by the same factor as the video
    const scaledRadius = cornerRadius * scaleFactor;
    const maskBlob = await createRoundedMaskPNG(scaledWidthPx, scaledHeightPx, scaledRadius);
    await ffmpeg.writeFile('mask.png', await fetchFile(maskBlob));
    // Build filter_complex depending on whether a background image is provided
    // Input indices: 0 = video, 1 = bg image (optional), last = mask
    const inputCount = 1 + (bgImageIndex !== -1 ? 1 : 0) + 1; // video + optional bg + mask
    // Determine actual indices for background and mask based on whether a bg image exists
    const maskInputIndex = bgImageIndex === -1 ? 1 : 2;
    // Build segments
    let filterGraph = '';
    // Trim and crop the video, then scale and convert to RGBA
    filterGraph += `[0:v] trim=start=${trimStart}:end=${trimEnd}, setpts=PTS-STARTPTS, `;
    filterGraph += `crop=${Math.round(cropWidthPx)}:${Math.round(cropHeightPx)}:${Math.round(cropXpx)}:${Math.round(cropYpx)}, `;
    filterGraph += `scale=${scaledWidthPx}:${scaledHeightPx}, format=rgba [fg];`;
    // Load and optionally scale the mask (already created at correct size)
    filterGraph += `[${maskInputIndex}:v] format=gray [mask];`;
    // Apply the mask to the foreground
    filterGraph += `[fg][mask] alphamerge [fgmasked];`;
    // Prepare background
    if (backgroundType === 'image' && bgImageIndex !== -1) {
      // Index of the background image input
      const bgIdx = bgImageIndex;
      // Scale and pad the image according to the requested fit
      if (backgroundImageFit === 'fill') {
        // Stretch to fill the frame
        filterGraph += `[${bgIdx}:v] scale=${videoWidth}:${videoHeight}:flags=lanczos, format=rgba [bg];`;
      } else if (backgroundImageFit === 'contain') {
        filterGraph += `[${bgIdx}:v] scale=${videoWidth}:${videoHeight}:force_original_aspect_ratio=decrease, pad=${videoWidth}:${videoHeight}:(ow-iw)/2:(oh-ih)/2:color=0x00000000, format=rgba [bg];`;
      } else { // cover
        filterGraph += `[${bgIdx}:v] scale=${videoWidth}:${videoHeight}:force_original_aspect_ratio=increase, crop=${videoWidth}:${videoHeight} [bg];`;
      }
    } else {
      // Use a solid colour.  Convert hex to ffmpeg acceptable format.  Append ff (opaque alpha) to ensure the color source is RGBA.
      const col = backgroundColor.replace('#', '');
      filterGraph += `color=c=${col}:s=${videoWidth}x${videoHeight}:d=${trimmedDuration}, format=rgba [bg];`;
    }
    // Overlay the masked video onto the background
    filterGraph += `[bg][fgmasked] overlay=x=${overlayXpx}:y=${overlayYpx}:format=auto [out];`;
    // Assemble arguments
    const args: string[] = [];
    args.push('-y');
    // Input video
    args.push('-i', 'input.webm');
    if (backgroundType === 'image' && bgImageIndex !== -1) {
      // Loop the background image for the full duration
      args.push('-loop', '1');
      args.push('-i', 'bg.png');
    }
    // Mask image input
    args.push('-i', 'mask.png');
    args.push('-filter_complex', filterGraph);
    // Map the filtered video and the (optionally trimmed) audio
    args.push('-map', '[out]');
    // Trim audio separately using -ss/-to to ensure sync
    if (trimStart > 0) {
      args.push('-ss', trimStart.toString());
    }
    if (trimEnd > 0) {
      args.push('-to', trimEnd.toString());
    }
    args.push('-map', '0:a?');
    // Quality settings
    const crf = quality === 'high' ? 18 : quality === 'medium' ? 23 : 28;
    args.push('-c:v', 'libvpx-vp9');
    args.push('-crf', crf.toString());
    args.push('-b:v', '0');
    args.push('-pix_fmt', 'yuva420p');
    args.push('-c:a', 'libopus');
    args.push('output.webm');
    // Progress handler
    if (onProgress) {
      ffmpeg.on('progress', ({ progress }) => {
        onProgress(Math.min(100, Math.max(0, progress * 100)));
      });
    }
    // Execute FFmpeg
    await ffmpeg.exec(args);
    // Read the result
    const data = await ffmpeg.readFile('output.webm');
    // Clean up temporary files
    await ffmpeg.deleteFile('input.webm');
    if (backgroundType === 'image' && bgImageIndex !== -1) {
      await ffmpeg.deleteFile('bg.png');
    }
    await ffmpeg.deleteFile('mask.png');
    await ffmpeg.deleteFile('output.webm');
    // Detach progress listener
    if (onProgress) {
      ffmpeg.off('progress');
    }
    return new Blob([data], { type: 'video/webm' });
  }, [loadFFmpeg]);
  return { exportVideo, loadFFmpeg };
};
