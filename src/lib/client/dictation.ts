"use client";

/**
 * Thin wrapper over the browser's built-in speech recognition (Chrome/Edge/Safari expose it as SpeechRecognition or
 * webkitSpeechRecognition). It needs no API key, so it's the fallback when the server has no transcription provider.
 * Note: in Chrome the audio is processed by the browser vendor's service, so the UI tells people when it's in use.
 */
interface RecognitionResult { isFinal: boolean; 0: { transcript: string; confidence: number } }
interface RecognitionEvent { resultIndex: number; results: ArrayLike<RecognitionResult> }
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

const ctor = (): RecognitionCtor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export const speechRecognitionSupported = () => ctor() !== null;

export interface Dictation {
  /** Finish and deliver what was heard. */
  stop: () => void;
  /** Discard everything. */
  abort: () => void;
}

export interface DictationHandlers {
  lang?: string;
  /** Called with the best running transcript (final + interim) as the user speaks. */
  onText: (text: string, isFinal: boolean) => void;
  /** Called once when recognition ends, with the final text and its confidence (0–1, or null if unknown). */
  onEnd: (finalText: string, confidence: number | null) => void;
  onError: (message: string) => void;
}

const MESSAGES: Record<string, string> = {
  "no-speech": "I didn't hear anything. Tap the mic and try again.",
  "audio-capture": "I couldn't find a microphone.",
  "not-allowed": "Microphone access was blocked. Allow it in your browser settings, or type instead.",
  "service-not-allowed": "Microphone access was blocked. Allow it in your browser settings, or type instead.",
  network: "Your browser's speech service couldn't be reached. Type instead, or try again.",
};

export function startDictation(h: DictationHandlers): Dictation | null {
  const C = ctor();
  if (!C) return null;
  const rec = new C();
  rec.lang = h.lang ?? (typeof navigator !== "undefined" ? navigator.language : "en-US");
  rec.continuous = false; // the browser ends the session itself after a natural pause
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  let finalText = "";
  let confSum = 0;
  let confN = 0;
  let aborted = false;
  let errored = false;

  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) {
        finalText += r[0].transcript;
        if (Number.isFinite(r[0].confidence) && r[0].confidence > 0) {
          confSum += r[0].confidence;
          confN++;
        }
      } else interim += r[0].transcript;
    }
    h.onText((finalText + interim).trim(), !interim);
  };
  rec.onerror = (e) => {
    if (e.error === "aborted") return;
    errored = true;
    h.onError(MESSAGES[e.error] ?? "Speech recognition had a problem. Please try again or type instead.");
  };
  rec.onend = () => {
    if (aborted || errored) return;
    h.onEnd(finalText.trim(), confN ? confSum / confN : null);
  };
  try {
    rec.start();
  } catch {
    h.onError("I couldn't start speech recognition. Type instead.");
    return null;
  }
  return {
    stop: () => rec.stop(),
    abort: () => {
      aborted = true;
      rec.abort();
    },
  };
}
