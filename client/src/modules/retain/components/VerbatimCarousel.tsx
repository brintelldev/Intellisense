import { useState, useEffect, useRef, useCallback } from "react";

interface Verbatim {
  name: string;
  text: string;
  satisfaction: number | null;
}

interface Props {
  verbatims: Verbatim[];
}

const INTERVAL_MS = 5500;

function satBadge(sat: number | null): { label: string; cls: string } | null {
  if (sat == null) return null;
  if (sat < 25) return { label: `${Math.round(sat / 10)} / 10`, cls: "bg-red-100 text-red-600" };
  if (sat < 50) return { label: `${Math.round(sat / 10)} / 10`, cls: "bg-orange-100 text-orange-600" };
  if (sat < 70) return { label: `${Math.round(sat / 10)} / 10`, cls: "bg-amber-100 text-amber-700" };
  return { label: `${Math.round(sat / 10)} / 10`, cls: "bg-green-100 text-green-700" };
}

export function VerbatimCarousel({ verbatims }: Props) {
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goTo = useCallback((index: number) => {
    setVisible(false);
    setTimeout(() => {
      setCurrent((index + verbatims.length) % verbatims.length);
      setVisible(true);
    }, 220);
  }, [verbatims.length]);

  const advance = useCallback((dir: 1 | -1) => {
    goTo(current + dir);
  }, [current, goTo]);

  // Auto-advance
  useEffect(() => {
    if (paused || verbatims.length <= 1) return;
    timerRef.current = setTimeout(() => advance(1), INTERVAL_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [current, paused, advance, verbatims.length]);

  if (!verbatims.length) return null;

  const v = verbatims[current];
  const badge = satBadge(v.satisfaction);
  const initial = v.name.charAt(0).toUpperCase();

  return (
    <div
      className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#293b83]/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-[#293b83]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
            </svg>
          </div>
          <h3 className="font-semibold text-slate-800">Voz real dos clientes</h3>
        </div>
        <span className="text-xs text-slate-400 tabular-nums">{current + 1} / {verbatims.length}</span>
      </div>

      {/* Quote body */}
      <div className="flex-1 px-6 py-5 relative min-h-[130px]">
        {/* Background quote mark */}
        <span
          className="absolute top-2 left-3 text-7xl font-serif leading-none select-none pointer-events-none"
          style={{ color: "#293b83", opacity: 0.06 }}
        >
          "
        </span>

        <div
          className="transition-opacity duration-200"
          style={{ opacity: visible ? 1 : 0 }}
        >
          <p className="text-slate-700 italic text-[15px] leading-relaxed">
            "{v.text}"
          </p>

          {/* Author row */}
          <div className="flex items-center gap-2.5 mt-4">
            <div className="w-7 h-7 rounded-full bg-[#293b83]/10 flex items-center justify-center flex-shrink-0">
              <span className="text-[11px] font-bold text-[#293b83]">{initial}</span>
            </div>
            <span className="text-sm font-semibold text-slate-700 truncate">{v.name}</span>
            {badge && (
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${badge.cls}`}>
                {badge.label}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Navigation footer */}
      {verbatims.length > 1 && (
        <div className="px-5 py-3 border-t border-slate-50 flex items-center justify-between">
          {/* Prev */}
          <button
            onClick={() => advance(-1)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Anterior"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Dots */}
          <div className="flex items-center gap-1.5">
            {verbatims.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Ir para citação ${i + 1}`}
                className="transition-all duration-300 rounded-full"
                style={{
                  width: i === current ? "16px" : "8px",
                  height: "8px",
                  backgroundColor: i === current ? "#293b83" : "#e2e8f0",
                }}
              />
            ))}
          </div>

          {/* Next */}
          <button
            onClick={() => advance(1)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Próximo"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
