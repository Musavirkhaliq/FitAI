"use client";
import { Check, Minus, Plus, SkipForward, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Ring, haptic } from "@/components/ui";
import { mmss } from "./util";

const MUTE_KEY = "fittrack-rest-muted";

export function useRestMuted(): [boolean, (v: boolean) => void] {
  const [muted, setMutedState] = useState(false);
  useEffect(() => {
    try {
      setMutedState(localStorage.getItem(MUTE_KEY) === "1");
    } catch {
      /* private mode */
    }
  }, []);
  const setMuted = useCallback((v: boolean) => {
    setMutedState(v);
    try {
      localStorage.setItem(MUTE_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);
  return [muted, setMuted];
}

type AudioCtor = typeof AudioContext;

export interface RestTimer {
  /** Counting down right now. */
  running: boolean;
  /** Reached zero and hasn't been dismissed. */
  finished: boolean;
  remaining: number;
  total: number;
  /** Text for the polite live region: set at start and end only. */
  announcement: string;
  start: (seconds: number) => void;
  adjust: (deltaSec: number) => void;
  skip: () => void;
}

/**
 * Rest countdown computed from a target timestamp, so re-renders and throttled background tabs can't make it drift.
 * The tick only refreshes the display; the end is detected by comparing against the clock.
 */
export function useRestTimer(muted: boolean): RestTimer {
  const [endAt, setEndAt] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [finished, setFinished] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const ctxRef = useRef<AudioContext | null>(null);
  const mutedRef = useRef(muted);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  // Create/resume the audio context inside a user gesture (start is called from a tap) so the end beep is allowed to play.
  const unlockAudio = useCallback(() => {
    try {
      const Ctor: AudioCtor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
      if (!Ctor) return;
      ctxRef.current ??= new Ctor();
      void ctxRef.current.resume();
    } catch {
      /* audio unavailable */
    }
  }, []);

  const beep = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx || mutedRef.current) return;
    try {
      [0, 0.28].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        const t = ctx.currentTime + offset;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.12, t + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.25);
      });
    } catch {
      /* ignore */
    }
  }, []);

  const finish = useCallback(() => {
    setEndAt(null);
    setFinished(true);
    setAnnouncement("Rest over. Ready for your next set.");
    haptic("success");
    beep();
  }, [beep]);

  const running = endAt != null;
  useEffect(() => {
    if (endAt == null) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t >= endAt) finish();
    };
    tick();
    const id = window.setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [endAt, finish]);

  const start = useCallback((seconds: number) => {
    const s = Math.max(5, Math.round(seconds));
    unlockAudio();
    setFinished(false);
    setTotal(s);
    setNow(Date.now());
    setEndAt(Date.now() + s * 1000);
    setAnnouncement(`Rest started: ${s >= 60 ? `${Math.floor(s / 60)} minute${s >= 120 ? "s" : ""}${s % 60 ? ` ${s % 60} seconds` : ""}` : `${s} seconds`}.`);
  }, [unlockAudio]);

  const adjust = useCallback((delta: number) => {
    setEndAt((e) => (e == null ? e : Math.max(Date.now() + 1000, e + delta * 1000)));
    setTotal((t) => Math.max(5, t + delta));
  }, []);

  const skip = useCallback(() => {
    setEndAt(null);
    setFinished(false);
    setAnnouncement("");
  }, []);

  const remaining = endAt == null ? 0 : Math.max(0, Math.ceil((endAt - now) / 1000));
  return { running, finished, remaining, total, announcement, start, adjust, skip };
}

/** Always mounted so the announcement is read when it changes; updates only at start and end. */
export function RestAnnouncer({ timer }: { timer: RestTimer }) {
  return <div className="sr-only" role="status" aria-live="polite">{timer.announcement}</div>;
}

/** Short viewports get a slightly smaller ring so the controls never fall off the screen. */
function useRingSize() {
  const [size, setSize] = useState(272);
  useEffect(() => {
    const f = () => setSize(window.innerHeight < 700 ? 216 : 272);
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return size;
}

/**
 * Rest mode: a big draining ring, the time in display type and the controls in the bottom thumb zone. It opens by itself
 * after a set. "Back to set" hides it without stopping the clock (the dock then shows a RestPill); Skip ends the rest.
 */
export function RestOverlay({ timer, open, onHide, muted, onMuted, nextUp, banner }: {
  timer: RestTimer; open: boolean; onHide: () => void; muted: boolean; onMuted: (v: boolean) => void; nextUp?: string; banner?: ReactNode;
}) {
  const show = open && (timer.running || timer.finished);
  const primary = useRef<HTMLButtonElement>(null);
  const size = useRingSize();

  useEffect(() => {
    if (!show) return;
    primary.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onHide();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [show, onHide]);

  if (!show) return null;
  const ratio = timer.finished ? 1 : timer.total > 0 ? timer.remaining / timer.total : 0;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Rest timer"
      className="pop fixed inset-0 z-[45] flex flex-col overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl"
      style={{ background: "radial-gradient(520px 420px at 50% 28%, rgb(var(--brand-a) / 0.16), transparent 70%), rgb(var(--bg) / 0.96)" }}
    >
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="flex items-center justify-between">
          <p className="eyebrow">{timer.finished ? "Rest over" : "Rest"}</p>
          <button type="button" className="btn btn-ghost !min-h-[48px]" onClick={() => onMuted(!muted)} aria-pressed={muted}>
            {muted ? <VolumeX className="h-5 w-5" aria-hidden /> : <Volume2 className="h-5 w-5" aria-hidden />} Sound {muted ? "off" : "on"}
          </button>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-5 py-3">
          {banner}
          <Ring ratio={ratio} size={size} stroke={size > 240 ? 16 : 14} color="brand">
            {timer.finished ? (
              <div className="flex flex-col items-center gap-1 text-center">
                <Check className="h-10 w-10 text-brand" aria-hidden />
                <p className="display text-2xl font-extrabold leading-tight">Ready when<br />you are</p>
              </div>
            ) : (
              <div className="text-center">
                <p role="timer" aria-live="off" aria-label={`${timer.remaining} seconds of rest left`} className="num text-[4rem] tabular-nums">{mmss(timer.remaining)}</p>
                <p className="mt-1 text-xs text-muted">of {mmss(timer.total)}</p>
              </div>
            )}
          </Ring>
          {nextUp && (
            <div className="text-center">
              <p className="eyebrow">Up next</p>
              <p className="mt-1 text-base font-semibold">{nextUp}</p>
            </div>
          )}
        </div>

        <div className="space-y-2.5">
          {!timer.finished && (
            <div className="grid grid-cols-2 gap-2.5">
              <button type="button" className="btn !min-h-[60px] text-base" onClick={() => timer.adjust(-15)} aria-label="Shorten rest by 15 seconds"><Minus className="h-5 w-5" aria-hidden /> 15s</button>
              <button type="button" className="btn !min-h-[60px] text-base" onClick={() => timer.adjust(15)} aria-label="Add 15 seconds to rest"><Plus className="h-5 w-5" aria-hidden /> 15s</button>
            </div>
          )}
          <button ref={primary} type="button" className="btn btn-primary !min-h-[72px] w-full !rounded-3xl text-xl" onClick={timer.skip}>
            <SkipForward className="h-6 w-6" aria-hidden /> {timer.finished ? "Next set" : "Skip rest"}
          </button>
          {!timer.finished && <button type="button" className="btn btn-ghost !min-h-[52px] w-full" onClick={onHide}>Back to set, keep the timer running</button>}
        </div>
      </div>
    </div>
  );
}

/** Shown in the dock while the rest overlay is hidden: a tiny ring and the time left; tap to bring the big view back. */
export function RestPill({ timer, onOpen }: { timer: RestTimer; onOpen: () => void }) {
  if (!timer.running && !timer.finished) return null;
  const ratio = timer.finished ? 1 : timer.total > 0 ? timer.remaining / timer.total : 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="press glass pop flex min-h-[60px] w-full items-center gap-3 rounded-2xl border border-brand/40 px-3.5 text-left shadow-float"
      aria-label={timer.finished ? "Rest over. Open rest timer" : `Rest, ${timer.remaining} seconds left. Open rest timer`}
    >
      <Ring ratio={ratio} size={40} stroke={5} color="brand" />
      <span className="min-w-0 flex-1">
        <span className="num block text-xl tabular-nums">{timer.finished ? "Rest over" : mmss(timer.remaining)}</span>
        <span className="block text-xs text-muted">{timer.finished ? "Ready for your next set" : "Resting · tap to open"}</span>
      </span>
    </button>
  );
}
