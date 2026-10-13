"use client";
import { AudioLines, Loader2, Mic, Square } from "lucide-react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { clsx } from "@/components/ui";
import type { VoiceState } from "./CoachProvider";
import { levelStore } from "./voiceEngine";

const EMPTY = Array(40).fill(0) as number[];

/**
 * The voice orb. Every visual state is driven by the real voice state machine, and while listening its size follows the
 * real microphone level, so it never claims to hear you when it doesn't (docs/DESIGN.md §1).
 *   idle        slow breathing glow
 *   listening   audio-reactive scale + ripples
 *   thinking    rotating arc (transcribing / understanding)
 *   speaking    soft ripples + equalizer glyph (tap to interrupt)
 *   error       amber ring
 */
export function VoiceOrb({ state, size = 96, hasError = false, onClick, disabled, label }: {
  state: VoiceState; size?: number; hasError?: boolean; onClick?: () => void; disabled?: boolean; label: string;
}) {
  const bars = useSyncExternalStore(levelStore.subscribe, levelStore.getSnapshot, () => EMPTY);
  const listening = state === "listening";
  const thinking = state === "transcribing" || state === "processing";
  const speaking = state === "speaking";
  const core = useRef<HTMLDivElement>(null);

  // Reactive scale: smooth the last few samples. Skipped under reduced motion (state is still shown by the icon/ring).
  const level = listening ? bars.slice(-5).reduce((s, v) => s + v, 0) / 5 : 0;
  useEffect(() => {
    if (!core.current) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    core.current.style.transform = listening && !reduce ? `scale(${1 + Math.min(1, level) * 0.22})` : "scale(1)";
  }, [level, listening]);

  const ring = hasError && state === "idle" ? "ring-2 ring-warn" : "";
  return (
    <div className="pointer-events-none relative flex items-center justify-center" style={{ width: size * 1.6, height: size * 1.6 }}>
      {/* ripples: real listening / speaking only */}
      {(listening || speaking) && (
        <>
          <span aria-hidden className="absolute rounded-full grad-brand opacity-30 motion-safe:animate-ripple" style={{ width: size, height: size }} />
          <span aria-hidden className="absolute rounded-full grad-brand opacity-20 motion-safe:animate-ripple [animation-delay:700ms]" style={{ width: size, height: size }} />
        </>
      )}
      {/* thinking arc */}
      {thinking && (
        <span aria-hidden className="absolute rounded-full motion-safe:animate-spin-slow" style={{ width: size * 1.28, height: size * 1.28, background: "conic-gradient(from 0deg, transparent 0 55%, rgb(var(--brand-b)) 100%)", mask: "radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px))", WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 3px))" }} />
      )}
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-pressed={listening}
        className={clsx("press pointer-events-auto relative z-10 rounded-full outline-offset-4 transition-shadow disabled:opacity-60", ring)}
        style={{ width: size, height: size }}
      >
        <div
          ref={core}
          className={clsx("grad-brand relative flex h-full w-full items-center justify-center rounded-full text-brand-fg shadow-float transition-transform duration-100 ease-out", !listening && !thinking && !speaking && "motion-safe:animate-breathe")}
          style={{ boxShadow: "var(--shadow-float), var(--glow)" }}
        >
          {/* glossy highlight */}
          <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full" style={{ background: "radial-gradient(120% 90% at 30% 15%, rgb(255 255 255 / 0.55), transparent 55%)" }} />
          <span className="relative">
            {listening ? <Square className="h-[34%] w-[34%]" style={{ width: size * 0.3, height: size * 0.3 }} fill="currentColor" aria-hidden />
              : thinking ? <Loader2 style={{ width: size * 0.34, height: size * 0.34 }} className="motion-safe:animate-spin" aria-hidden />
              : speaking ? <AudioLines style={{ width: size * 0.38, height: size * 0.38 }} aria-hidden />
              : <Mic style={{ width: size * 0.38, height: size * 0.38 }} aria-hidden />}
          </span>
        </div>
      </button>
    </div>
  );
}
