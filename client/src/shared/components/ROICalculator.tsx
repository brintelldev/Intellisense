import { useState } from "react";
import { Slider } from "./ui/slider";
import { cn } from "../lib/utils";

export interface SliderConfig {
  key: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  default: number;
  format: (v: number) => string;
}

interface Scenario {
  label: string;
  improvement: number;
  highlighted?: boolean;
  badge?: string;
}

interface ROICalculatorProps {
  sliders: SliderConfig[];
  scenarios: Scenario[];
  calculateScenario: (sliderValues: Record<string, number>, improvement: number) => Record<string, { label: string; value: string }>;
  highlightText?: (sliderValues: Record<string, number>, bestImprovement: number) => string;
  variant?: "retain" | "obtain";
  className?: string;
}

export function ROICalculator({ sliders, scenarios, calculateScenario, highlightText, variant = "retain", className }: ROICalculatorProps) {
  const initialValues = Object.fromEntries(sliders.map(s => [s.key, s.default]));
  const [values, setValues] = useState<Record<string, number>>(initialValues);

  const accentColor = variant === "retain" ? "#293b83" : "#10B981";
  const best = scenarios.find(s => s.highlighted) ?? scenarios[1] ?? scenarios[0];

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-6", className)}>
      {/* Left: Inputs */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100">
        <h3 className="font-semibold text-slate-800 mb-5">Configure sua simulação</h3>
        <div className="space-y-6">
          {sliders.map((slider) => (
            <div key={slider.key}>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm text-slate-600">{slider.label}</label>
                <span className="text-sm font-semibold tabular-nums" style={{ color: accentColor }}>
                  {slider.format(values[slider.key])}
                </span>
              </div>
              <Slider
                min={slider.min}
                max={slider.max}
                step={slider.step ?? 1}
                value={values[slider.key]}
                onChange={(v) => setValues(prev => ({ ...prev, [slider.key]: v }))}
                color={accentColor}
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>{slider.format(slider.min)}</span>
                <span>{slider.format(slider.max)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Scenarios */}
      <div className="space-y-4">
        {scenarios.map((scenario) => {
          const results = calculateScenario(values, scenario.improvement);
          return (
            <div
              key={scenario.label}
              className={cn(
                "bg-white rounded-xl p-5 shadow-sm border-2 transition-all",
                scenario.highlighted ? "shadow-md" : "border-slate-100"
              )}
              style={scenario.highlighted ? { borderColor: accentColor } : undefined}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-slate-700">{scenario.label}</span>
                {scenario.badge && (
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full text-white"
                    style={{ backgroundColor: accentColor }}
                  >
                    {scenario.badge}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {Object.values(results).map((result) => (
                  <div key={result.label}>
                    <p className="text-xs text-slate-500">{result.label}</p>
                    <p className={cn("text-sm font-bold tabular-nums", scenario.highlighted ? "text-slate-900 text-base" : "text-slate-700")}>
                      {result.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Highlight text */}
        {highlightText && (
          <div
            className="rounded-xl p-5 text-white"
            style={{ background: `linear-gradient(135deg, ${accentColor}, #67b4b0)` }}
          >
            <p className="text-base font-semibold leading-snug">
              {highlightText(values, best.improvement)}
            </p>
            <button className="mt-3 bg-white/20 hover:bg-white/30 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              Solicitar demonstração personalizada
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
