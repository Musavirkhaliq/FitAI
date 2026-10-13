"use client";
import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { clsx } from "@/components/ui";
import { speechRecognitionSupported, startDictation, type Dictation } from "@/lib/client/dictation";

interface Props {
  /** Called with the running transcript while the person speaks (replace the answer with it). */
  onText: (text: string) => void;
  /** Called just before listening starts, e.g. to remember the current answer. */
  onStart?: () => void;
}

/**
 * Optional voice input for an answer field. Hidden when the browser has no speech recognition. It only fills the field:
 * the person always reviews, edits and presses Next themselves.
 *
 * It renders as `display: contents` so the 48 px mic button sits in the same flex-wrap row as the input, and the status
 * and privacy lines wrap underneath it.
 */
export function DictateButton({ onText, onStart }: Props) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const session = useRef<Dictation | null>(null);
  const textRef = useRef(onText);
  const startRef = useRef(onStart);
  textRef.current = onText;
  startRef.current = onStart;

  // Feature-detect after mount so server and first client render match.
  useEffect(() => {
    setSupported(speechRecognitionSupported());
    return () => session.current?.abort();
  }, []);

  if (!supported) return null;

  const toggle = () => {
    if (listening) {
      session.current?.stop();
      return;
    }
    setError(null);
    setHeard(false);
    startRef.current?.();
    const s = startDictation({
      onText: (text) => {
        if (text) {
          setHeard(true);
          textRef.current(text);
        }
      },
      onEnd: () => { session.current = null; setListening(false); },
      onError: (message) => { session.current = null; setListening(false); setError(message); },
    });
    session.current = s;
    if (s) setListening(true);
    else setError((e) => e ?? "I couldn't start the microphone. Please type your answer instead.");
  };

  return (
    <div className="contents">
      <button
        type="button" onClick={toggle} aria-pressed={listening} aria-label={listening ? "Stop dictating" : "Dictate your answer"}
        className={clsx(
          "press relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition-colors",
          listening ? "border-transparent text-brand-fg" : "border-border bg-surface-2 text-fg hover:bg-surface-3",
        )}
        style={listening ? { background: "var(--btn-bg)", boxShadow: "var(--glow)" } : undefined}
      >
        {listening && <span aria-hidden className="absolute inset-0 rounded-2xl grad-brand opacity-30 motion-safe:animate-pulse-ring" />}
        {listening ? <Square className="relative h-4 w-4" fill="currentColor" aria-hidden /> : <Mic className="h-5 w-5" aria-hidden />}
      </button>
      <p role="status" aria-live="polite" className={clsx("basis-full text-sm", (listening || error || heard) && "mt-2", error ? "text-bad" : "text-muted")}>
        {listening && (
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-brand motion-reduce:animate-none" aria-hidden />
            Listening… speak now, then tap Stop.
          </span>
        )}
        {!listening && error}
        {!listening && !error && heard && "Here's what I heard. Check it, change it if you need to, then continue."}
      </p>
      <p className="mt-1.5 basis-full text-xs leading-snug text-muted">Voice is optional. Your browser&apos;s speech service processes the audio. Your answer isn&apos;t submitted until you press the button to continue.</p>
    </div>
  );
}
