import React, { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ZoomGridSelectorProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  selectedX: number;
  selectedY: number;
  onGridSelect: (x: number, y: number) => void;
}

export const ZoomGridSelector: React.FC<ZoomGridSelectorProps> = ({
  videoRef,
  selectedX,
  selectedY,
  onGridSelect
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    const captureFrame = () => {
      if (video.videoWidth === 0 || video.videoHeight === 0) return;
      
      try {
        // Set canvas size to match video aspect ratio but smaller
        const aspectRatio = video.videoWidth / video.videoHeight;
        const maxSize = 160;
        
        if (aspectRatio > 1) {
          canvas.width = maxSize;
          canvas.height = maxSize / aspectRatio;
        } else {
          canvas.width = maxSize * aspectRatio;
          canvas.height = maxSize;
        }
        
        // Draw current video frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert to data URL for display
        setThumbnail(canvas.toDataURL());
      } catch (error) {
        console.warn('Canvas operation failed, using fallback grid:', error);
        setThumbnail(null);
      }
    };

    // Capture frame when video metadata is loaded or time updates
    const handleUpdate = () => {
      if (video.readyState >= 2) { // HAVE_CURRENT_DATA
        captureFrame();
      }
    };

    video.addEventListener('loadeddata', handleUpdate);
    video.addEventListener('timeupdate', handleUpdate);
    
    // Initial capture
    if (video.readyState >= 2) {
      captureFrame();
    }

    return () => {
      video.removeEventListener('loadeddata', handleUpdate);
      video.removeEventListener('timeupdate', handleUpdate);
    };
  }, [videoRef]);

  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const gridX = Math.floor((x / rect.width) * 8);
    const gridY = Math.floor((y / rect.height) * 8);
    
    onGridSelect(Math.min(7, Math.max(0, gridX)), Math.min(7, Math.max(0, gridY)));
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-foreground">Zoom Target</h4>
      <div className="relative w-40 h-auto mx-auto">
        {/* Video thumbnail background or fallback */}
        {thumbnail ? (
          <img 
            src={thumbnail} 
            alt="Video thumbnail"
            className="w-full h-auto rounded border"
          />
        ) : (
          <div className="w-full aspect-video bg-muted rounded border flex items-center justify-center">
            <span className="text-muted-foreground text-xs">Grid Selector</span>
          </div>
        )}
        
        {/* Grid overlay */}
        <div 
          className="absolute inset-0 cursor-pointer"
          onClick={handleGridClick}
        >
          {/* Grid lines */}
          <div className="absolute inset-0 grid grid-cols-8 grid-rows-8 pointer-events-none">
            {Array.from({ length: 64 }, (_, i) => {
              const x = i % 8;
              const y = Math.floor(i / 8);
              const isSelected = x === selectedX && y === selectedY;
              
              return (
                <div
                  key={i}
                  className={cn(
                    "border border-white/30 transition-all duration-200",
                    isSelected && "bg-yellow-500/50 border-yellow-400 shadow-inset"
                  )}
                />
              );
            })}
          </div>
        </div>
        
        {/* Selection indicator */}
        <div 
          className="absolute w-1/8 h-1/8 border-2 border-yellow-500 bg-yellow-500/30 pointer-events-none transition-all duration-200"
          style={{
            left: `${(selectedX / 8) * 100}%`,
            top: `${(selectedY / 8) * 100}%`,
            width: '12.5%',
            height: '12.5%',
          }}
        />
      </div>
      
      <canvas 
        ref={canvasRef} 
        className="hidden" 
        aria-hidden="true"
      />
    </div>
  );
};