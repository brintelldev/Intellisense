import * as React from "react";
import { cn } from "../../lib/utils";

interface SliderProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  className?: string;
  color?: string;
}

export function Slider({ min, max, step = 1, value, onChange, className, color = "#293b83" }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className={cn("group relative flex items-center h-6", className)}>
      <div className="relative w-full h-2 bg-slate-200 rounded-full">
        <div
          className="absolute left-0 top-0 h-2 rounded-full transition-all duration-150"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
        {/* Thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[18px] h-[18px] rounded-full bg-white border-2 shadow-md transition-transform duration-150 group-hover:scale-110 group-active:scale-125 pointer-events-none"
          style={{ left: `${pct}%`, borderColor: color }}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
      />
    </div>
  );
}
