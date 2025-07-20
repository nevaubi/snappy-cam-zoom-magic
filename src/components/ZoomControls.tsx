import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ZoomIn, MousePointer } from 'lucide-react';
import { ZoomEffect } from './ZoomEffect';

interface ZoomControlsProps {
  selectedZoomEffect: ZoomEffect | null;
  onZoomEffectUpdate: (effect: ZoomEffect) => void;
}

export const ZoomControls = ({ selectedZoomEffect, onZoomEffectUpdate }: ZoomControlsProps) => {
  if (!selectedZoomEffect) {
    return (
      <Card className="bg-controls border-accent-glow/20 p-6">
        <div className="text-center text-controls-foreground/60">
          <ZoomIn className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>Select a zoom effect to edit its settings</p>
        </div>
      </Card>
    );
  }

  const updateEffect = (updates: Partial<ZoomEffect>) => {
    onZoomEffectUpdate({ ...selectedZoomEffect, ...updates });
  };

  return (
    <Card className="bg-controls border-accent-glow/20 p-6 space-y-6">
      <div className="flex items-center gap-2 pb-4 border-b border-accent-glow/20">
        <ZoomIn className="w-5 h-5 text-accent-glow" />
        <h3 className="text-lg font-semibold text-controls-foreground">Zoom Settings</h3>
      </div>

      {/* Zoom Level */}
      <div className="space-y-3">
        <Label className="text-controls-foreground flex items-center justify-between">
          Zoom Level
          <span className="text-accent-glow font-mono">{selectedZoomEffect.zoomLevel.toFixed(2)}x</span>
        </Label>
        <Slider
          value={[selectedZoomEffect.zoomLevel]}
          onValueChange={([value]) => updateEffect({ zoomLevel: value })}
          min={1}
          max={5}
          step={0.01}
          className="w-full"
        />
      </div>

      {/* Follow Cursor Toggle */}
      <div className="flex items-center justify-between">
        <Label className="text-controls-foreground flex items-center gap-2">
          <MousePointer className="w-4 h-4" />
          Follow Cursor
        </Label>
        <Switch
          checked={selectedZoomEffect.followCursor}
          onCheckedChange={(checked) => updateEffect({ followCursor: checked })}
        />
      </div>

      {/* Intro Duration */}
      <div className="space-y-3">
        <Label className="text-controls-foreground flex items-center justify-between">
          Intro Duration
          <span className="text-accent-glow font-mono">{selectedZoomEffect.introDuration.toFixed(2)}s</span>
        </Label>
        <Slider
          value={[selectedZoomEffect.introDuration]}
          onValueChange={([value]) => updateEffect({ introDuration: value })}
          min={0}
          max={5}
          step={0.1}
          className="w-full"
        />
      </div>

      {/* Outro Duration */}
      <div className="space-y-3">
        <Label className="text-controls-foreground flex items-center justify-between">
          Outro Duration
          <span className="text-accent-glow font-mono">{selectedZoomEffect.outroDuration.toFixed(2)}s</span>
        </Label>
        <Slider
          value={[selectedZoomEffect.outroDuration]}
          onValueChange={([value]) => updateEffect({ outroDuration: value })}
          min={0}
          max={5}
          step={0.1}
          className="w-full"
        />
      </div>

      {/* Blur Effect */}
      <div className="space-y-4 pt-4 border-t border-accent-glow/20">
        <div className="flex items-center justify-between">
          <Label className="text-controls-foreground">Blur Effect</Label>
          <Switch
            checked={selectedZoomEffect.blurEnabled}
            onCheckedChange={(checked) => updateEffect({ blurEnabled: checked })}
          />
        </div>

        {selectedZoomEffect.blurEnabled && (
          <div className="space-y-3">
            <Label className="text-controls-foreground flex items-center justify-between">
              Blur Strength
              <span className="text-accent-glow font-mono">{selectedZoomEffect.blurStrength.toFixed(2)}</span>
            </Label>
            <Slider
              value={[selectedZoomEffect.blurStrength]}
              onValueChange={([value]) => updateEffect({ blurStrength: value })}
              min={0}
              max={1}
              step={0.01}
              className="w-full"
            />
          </div>
        )}
      </div>
    </Card>
  );
};