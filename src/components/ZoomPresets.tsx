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
              "hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl",
              selectedValue === option.value
                ? "border-primary bg-primary/20 text-primary shadow-lg shadow-primary/25"
                : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-primary/10 hover:shadow-primary/20"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
};