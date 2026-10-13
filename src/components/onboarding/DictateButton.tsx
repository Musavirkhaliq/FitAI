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
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button" onClick={toggle} aria-pressed={listening} aria-label={listening ? "Stop dictating" : "Dictate your answer"}
          className={clsx("btn", listening && "border-brand bg-brand/10 font-semibold")}
        >
          {listening ? <Square className="h-4 w-4" aria-hidden /> : <Mic className="h-4 w-4" aria-hidden />}
          <span aria-hidden>{listening ? "Stop" : "Speak"}</span>
        </button>
        <p role="status" aria-live="polite" className={clsx("text-sm", error ? "text-bad" : "text-muted")}>
          {listening && (
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-brand motion-reduce:animate-none" aria-hidden />
              Listening… speak now, then tap Stop.
            </span>
          )}
          {!listening && error}
          {!listening && !error && heard && "Here's what I heard. Check it, change it if you need to, then continue."}
        </p>
      </div>
      <p className="mt-1 text-xs text-muted">Voice is optional. Your browser&apos;s speech service processes the audio. Your answer isn&apos;t submitted until you press the button to continue.</p>
    </div>
  );
}
