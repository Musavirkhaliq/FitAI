"use client";
import { useSyncExternalStore } from "react";
import { levelStore } from "./voiceEngine";

const EMPTY = Array(40).fill(0) as number[];

/** Real-time amplitude waveform driven by the microphone analyser (decorative: the status text carries meaning). */
export function Waveform({ active, className }: { active: boolean; className?: string }) {
  const bars = useSyncExternalStore(levelStore.subscribe, levelStore.getSnapshot, () => EMPTY);
  return (
    <svg viewBox="0 0 160 48" className={className} aria-hidden preserveAspectRatio="none">
      {bars.map((v, i) => {
        const h = active ? Math.max(3, v * 44) : 3;
        return <rect key={i} x={i * 4 + 0.5} y={24 - h / 2} width="2.6" height={h} rx="1.3" fill="currentColor" opacity={active ? 0.35 + v * 0.65 : 0.25} />;
      })}
    </svg>
  );
}
