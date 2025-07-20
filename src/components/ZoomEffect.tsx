export interface ZoomEffect {
  id: string;
  startTime: number;
  endTime: number;
  zoomLevel: number;
  introDuration: number;
  outroDuration: number;
  blurEnabled: boolean;
  blurStrength: number;
  followCursor: boolean;
}

export const createZoomEffect = (startTime: number, endTime: number): ZoomEffect => ({
  id: Math.random().toString(36).substr(2, 9),
  startTime,
  endTime,
  zoomLevel: 2.74,
  introDuration: 2.0,
  outroDuration: 2.0,
  blurEnabled: true,
  blurStrength: 0.5,
  followCursor: false,
});