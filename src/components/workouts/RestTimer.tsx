"use client";
import { SkipForward, Timer, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ProgressBar } from "@/components/ui";

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

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function RestTimerCard({ timer, muted, onMuted }: { timer: RestTimer; muted: boolean; onMuted: (v: boolean) => void }) {
  const show = timer.running || timer.finished;
  return (
    <>
      {/* Always mounted so the announcement is read when it changes; updates only at start and end. */}
      <div className="sr-only" role="status" aria-live="polite">{timer.announcement}</div>
      {show && (
        <section className="card space-y-3 border-brand/40 bg-brand/5 text-center" aria-label="Rest timer">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold"><Timer className="h-4 w-4 text-brand" aria-hidden /> {timer.finished ? "Rest over" : "Rest"}</p>
            <button className="btn btn-ghost !min-h-[44px]" onClick={() => onMuted(!muted)} aria-pressed={muted}>
              {muted ? <VolumeX className="h-4 w-4" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />} Sound {muted ? "off" : "on"}
            </button>
          </div>
          {timer.finished ? (
            <p className="py-2 text-3xl font-semibold">Ready when you are</p>
          ) : (
            <p role="timer" aria-live="off" aria-label={`${timer.remaining} seconds of rest left`} className="text-6xl font-semibold tabular-nums">{mmss(timer.remaining)}</p>
          )}
          {!timer.finished && <ProgressBar value={timer.total - timer.remaining} max={timer.total} label="Rest elapsed" />}
          <div className="grid grid-cols-3 gap-2">
            <button className="btn !min-h-[52px]" onClick={() => timer.adjust(-15)} disabled={timer.finished}>−15s</button>
            <button className="btn !min-h-[52px]" onClick={() => timer.adjust(15)} disabled={timer.finished}>+15s</button>
            <button className="btn btn-primary !min-h-[52px]" onClick={timer.skip}><SkipForward className="h-4 w-4" aria-hidden /> {timer.finished ? "Dismiss" : "Skip"}</button>
          </div>
        </section>
      )}
    </>
  );
}
