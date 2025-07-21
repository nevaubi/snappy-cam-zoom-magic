import React from 'react';
import { cn } from '@/lib/utils';

interface ZoomPresetsProps {
  title: string;
  options: { value: number; label: string }[];
  selectedValue: number;
  onSelect: (value: number) => void;
}

export const ZoomPresets: React.FC<ZoomPresetsProps> = ({
  title,
  options,
  selectedValue,
  onSelect
}) => {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-foreground">{title}</h4>
      <div className="flex gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onSelect(option.value)}
            className={cn(
              "w-12 h-12 rounded-full border-2 transition-all duration-200 text-xs font-medium",
              "hover:scale-105 active:scale-95",
              selectedValue === option.value
                ? "border-yellow-500 bg-yellow-500/20 text-yellow-700 shadow-md"
                : "border-border bg-background text-muted-foreground hover:border-yellow-300 hover:bg-yellow-50"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
};