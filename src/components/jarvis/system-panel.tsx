"use client";

import { useEffect, useState } from "react";

type Metric = {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
};

function randomize(m: Metric): Metric {
  const drift = (Math.random() - 0.5) * 14;
  const value = Math.min(m.max, Math.max(m.min, m.value + drift));
  return { ...m, value: Math.round(value * 10) / 10 };
}

export function SystemPanel() {
  const [metrics, setMetrics] = useState<Metric[]>([
    { label: "ARC REACTOR OUTPUT", value: 3.8, unit: "GJ/s", min: 3.2, max: 4.4 },
    { label: "CPU LOAD", value: 42, unit: "%", min: 18, max: 78 },
    { label: "MEMORY USAGE", value: 61, unit: "%", min: 40, max: 82 },
    { label: "NETWORK LATENCY", value: 12, unit: "ms", min: 6, max: 34 },
    { label: "SUIT INTEGRITY", value: 97, unit: "%", min: 96, max: 100 },
  ]);

  useEffect(() => {
    const id = setInterval(() => {
      setMetrics((prev) => prev.map(randomize));
    }, 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative overflow-hidden rounded-lg border border-cyan-500/20 bg-black/40 p-4">
      <div className="hud-scan pointer-events-none absolute left-0 h-px w-full bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
      <h2 className="mb-3 font-mono text-xs tracking-[0.25em] text-cyan-300/80">SYSTEM STATUS</h2>
      <div className="space-y-3">
        {metrics.map((m) => {
          const pct = ((m.value - m.min) / (m.max - m.min)) * 100;
          return (
            <div key={m.label}>
              <div className="mb-1 flex items-center justify-between font-mono text-[10px] tracking-wider text-cyan-100/70">
                <span>{m.label}</span>
                <span className="text-cyan-300">
                  {m.value.toFixed(1)} {m.unit}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-cyan-950/80">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-cyan-300 transition-all duration-700 ease-out"
                  style={{ width: `${Math.min(100, Math.max(4, pct))}%`, boxShadow: "0 0 6px rgba(6,182,212,0.6)" }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-2 border-t border-cyan-500/10 pt-3 font-mono text-[10px] tracking-wider text-cyan-100/60">
        <span className="hud-blink h-1.5 w-1.5 rounded-full bg-emerald-400" />
        ALL SYSTEMS NOMINAL
      </div>
    </div>
  );
}
