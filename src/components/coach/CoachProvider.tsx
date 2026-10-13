"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { notifyChanged } from "@/lib/client/api";
import { enqueue, flushQueue, onQueueChange, queueSize, cacheFrequentFoods } from "@/lib/client/queue";
import { speechRecognitionSupported, startDictation, type Dictation } from "@/lib/client/dictation";
import { SentenceSpeaker } from "./speech";
import { VoiceSession } from "./voiceEngine";

export type Label = "FACT" | "ESTIMATE" | "ASSUMPTION" | "RECOMMENDATION";
export interface CoachCard {
  kind: string;
  title: string;
  lines: { label: Label; text: string }[];
  entry?: { kind: string; id: string };
  confidence?: "HIGH" | "MEDIUM" | "LOW";
  range?: [number, number];
}
export interface CoachMsg {
  id: string;
  role: "user" | "assistant";
  text: string;
  cards: CoachCard[];
  links: { href: string; label: string }[];
  options?: string[];
  status: "streaming" | "done" | "queued" | "error";
  stage?: string;
  safety?: "YELLOW" | "RED";
  source?: "VOICE" | "TEXT";
  /** The user text that produced this assistant message, so "Retry" works. */
  retryText?: string;
}
export type VoiceState = "idle" | "listening" | "transcribing" | "preview" | "processing" | "speaking";
export interface LiveDay {
  date: string; calories: number; caloriesRange: [number, number]; protein: number; fiber: number; steps: number;
  sleepH: number | null; weightKg: number | null; water: number; trainingMin: number;
  targets: { calories: number; proteinG: number; fiberG: number; steps: number; sleepH: number; waterMl: number } | null;
  remaining: { calories: number; proteinG: number } | null;
}

interface Ctx {
  messages: CoachMsg[];
  busy: boolean;
  stage: string | null;
  voiceState: VoiceState;
  voiceError: string | null;
  prompt: string | null;
  transcript: string;
  setTranscript: (t: string) => void;
  confidence: number | null;
  alternative: string | null;
  ttsOn: boolean;
  setTtsOn: (v: boolean) => void;
  liveDay: LiveDay | null;
  queued: number;
  online: boolean;
  sheetOpen: boolean;
  /** "browser" = the browser's own speech recognition is in use (no server transcription key). */
  sttMode: "server" | "browser";
  openSheet: () => void;
  closeSheet: () => void;
  send: (text: string, source?: "VOICE" | "TEXT") => Promise<void>;
  retryMsg: (id: string) => void;
  listen: () => Promise<void>;
  stopListening: () => Promise<void>;
  cancelVoice: () => void;
  sendTranscript: () => void;
  interrupt: () => void;
  speak: (text: string) => void;
  clearChat: () => Promise<void>;
}

const CoachContext = createContext<Ctx | null>(null);
export const useCoach = () => {
  const c = useContext(CoachContext);
  if (!c) throw new Error("useCoach must be used inside <CoachProvider>");
  return c;
};

const ERR_UNDERSTAND = "I had trouble understanding that. Could you rephrase, or type it instead?";
const ERR_QUEUED = "I couldn't save that. Your entry is queued and will sync when you're back online.";
const ERR_DB = "Something went wrong saving. Your data is safe locally — retrying in 5 seconds.";

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()).slice(2));

async function* readSse(res: Response): AsyncGenerator<Record<string, unknown>> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i + 2);
      if (chunk.startsWith("data: ")) {
        try {
          yield JSON.parse(chunk.slice(6));
        } catch {
          /* ignore a malformed frame */
        }
      }
    }
  }
}

export function CoachProvider({ children, defaultTts = true }: { children: ReactNode; defaultTts?: boolean }) {
  const [messages, setMessages] = useState<CoachMsg[]>([]);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [voiceState, setVoiceStateRaw] = useState<VoiceState>("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [alternative, setAlternative] = useState<string | null>(null);
  const [ttsOn, setTtsOnState] = useState(defaultTts);
  const [liveDay, setLiveDay] = useState<LiveDay | null>(null);
  const [queued, setQueued] = useState(0);
  const [online, setOnline] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  // "server": record and send to /api/stt. "browser": the browser's own recognition (no server key needed).
  const [sttMode, setSttMode] = useState<"server" | "browser">("server");
  const sttModeRef = useRef<"server" | "browser">("server");
  const recogRef = useRef<Dictation | null>(null);
  const noSpeechTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stateRef = useRef<VoiceState>("idle");
  const setVoiceState = useCallback((s: VoiceState) => {
    stateRef.current = s;
    setVoiceStateRaw(s);
  }, []);
  const abortRef = useRef<AbortController | null>(null);
  const busyRef = useRef(false);
  const ttsRef = useRef(defaultTts);
  const speakerRef = useRef<SentenceSpeaker | null>(null);
  const sessionRef = useRef<VoiceSession | null>(null);
  const actions = useRef<{ stop: () => Promise<void>; cancel: () => void; interrupt: () => void }>({ stop: async () => {}, cancel: () => {}, interrupt: () => {} });

  // ─── lifecycle ───────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem("fittrack-tts");
      if (saved != null) {
        ttsRef.current = saved === "1";
        setTtsOnState(saved === "1");
      }
    } catch {
      /* private mode */
    }
    setOnline(navigator.onLine);
    const on = () => {
      setOnline(true);
      void flushQueue();
    };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    // Pick the transcription path: the server when it has a provider, otherwise the browser's own recognition.
    void fetch("/api/capabilities")
      .then((r) => (r.ok ? r.json() : null))
      .then((c: { stt?: boolean } | null) => {
        const mode = c && c.stt === false && speechRecognitionSupported() ? "browser" : "server";
        sttModeRef.current = mode;
        setSttMode(mode);
      })
      .catch(() => null);
    void queueSize().then(setQueued);
    const unsub = onQueueChange(setQueued);
    void flushQueue();
    void cacheFrequentFoods();

    const speaker = new SentenceSpeaker();
    speakerRef.current = speaker;
    speaker.onChange = (speaking) => {
      const s = sessionRef.current;
      if (speaking) {
        setVoiceState("speaking");
        s?.active && s.watchForInterrupt(() => actions.current.interrupt());
      } else {
        s?.stopWatching();
        if (stateRef.current === "speaking") setVoiceState(busyRef.current ? "processing" : "idle");
        if (!busyRef.current && stateRef.current === "idle") setTimeout(() => stateRef.current === "idle" && sessionRef.current?.close(), 600);
      }
    };

    sessionRef.current = new VoiceSession({
      onAutoStop: () => void actions.current.stop(),
      onNoInput: () => {
        setPrompt("Are you still there?");
        speakerRef.current?.say("Are you still there?");
      },
      onTimeout: () => actions.current.cancel(),
    });

    // Restore recent conversation so the Coach page isn't empty after a reload.
    void fetch("/api/conversations?limit=30")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { messages: { id: string; role: string; content: string; cards: CoachCard[] }[] } | null) => {
        if (!j) return;
        setMessages((prev) =>
          prev.length ? prev : j.messages.map((m) => ({ id: m.id, role: m.role === "assistant" ? "assistant" : "user", text: m.content, cards: m.cards ?? [], links: [], status: "done" as const })),
        );
      })
      .catch(() => null);

    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      unsub();
      speaker.cancel();
      sessionRef.current?.close();
    };
  }, [setVoiceState]);

  const setTtsOn = useCallback((v: boolean) => {
    ttsRef.current = v;
    setTtsOnState(v);
    try {
      localStorage.setItem("fittrack-tts", v ? "1" : "0");
    } catch {
      /* ignore */
    }
    if (!v) speakerRef.current?.cancel();
  }, []);

  const finishVoiceIfIdle = useCallback(() => {
    if (!busyRef.current && !speakerRef.current?.speaking) {
      setVoiceState("idle");
      setTimeout(() => stateRef.current === "idle" && sessionRef.current?.close(), 600);
    }
  }, [setVoiceState]);

  // ─── chat ────────────────────────────────────────────────────────────────────────────────────
  const patchMsg = useCallback((id: string, fn: (m: CoachMsg) => CoachMsg) => setMessages((ms) => ms.map((m) => (m.id === id ? fn(m) : m))), []);

  const send = useCallback(
    async (rawText: string, source: "VOICE" | "TEXT" = "TEXT") => {
      const text = rawText.trim();
      if (!text) return;
      abortRef.current?.abort();
      speakerRef.current?.cancel();
      const ac = new AbortController();
      abortRef.current = ac;

      const aId = uid();
      setMessages((ms) => [
        ...ms,
        { id: uid(), role: "user", text, cards: [], links: [], status: "done", source },
        { id: aId, role: "assistant", text: "", cards: [], links: [], status: "streaming", stage: "Understanding…", retryText: text },
      ]);
      busyRef.current = true;
      setBusy(true);
      setStage("Understanding…");
      if (stateRef.current !== "listening") setVoiceState("processing");
      const speakIt = ttsRef.current && source === "VOICE";
      let gotDone = false;
      let streamed = "";

      try {
        const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, source }), signal: ac.signal });
        if (!res.ok || !res.body) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          if (res.status >= 500) {
            patchMsg(aId, (m) => ({ ...m, status: "error", text: ERR_DB }));
            setTimeout(async () => {
              await enqueue({ kind: "chat", url: "/api/chat", body: { text, source } });
              void flushQueue();
            }, 5000);
          } else patchMsg(aId, (m) => ({ ...m, status: "error", text: j.error ?? ERR_UNDERSTAND }));
          return;
        }
        for await (const ev of readSse(res)) {
          switch (ev.type) {
            case "stage":
              setStage(String(ev.label));
              patchMsg(aId, (m) => ({ ...m, stage: String(ev.label) }));
              break;
            case "token":
              streamed += String(ev.text);
              patchMsg(aId, (m) => ({ ...m, text: m.text + String(ev.text) }));
              if (speakIt) speakerRef.current?.feed(String(ev.text));
              break;
            case "cards":
              patchMsg(aId, (m) => ({ ...m, cards: ev.cards as CoachCard[] }));
              break;
            case "clarify":
              patchMsg(aId, (m) => ({ ...m, options: (ev.options as string[] | undefined) ?? undefined, text: m.text || String(ev.question) }));
              // A bare clarifying question has no tokens, so speak it; when tokens already carried it, don't repeat.
              if (speakIt && !streamed) speakerRef.current?.feed(String(ev.question) + " ");
              break;
            case "safety":
              patchMsg(aId, (m) => ({ ...m, safety: ev.level as "YELLOW" | "RED" }));
              break;
            case "link":
              patchMsg(aId, (m) => ({ ...m, links: [...m.links, { href: String(ev.href), label: String(ev.label) }] }));
              break;
            case "workout_command":
              window.dispatchEvent(new CustomEvent("fittrack:workout-command", { detail: ev }));
              break;
            case "day":
              setLiveDay(ev.summary as LiveDay);
              break;
            case "error":
              patchMsg(aId, (m) => ({ ...m, status: "error", text: String(ev.message) }));
              gotDone = true;
              break;
            case "done":
              gotDone = true;
              patchMsg(aId, (m) => ({ ...m, status: "done", stage: undefined }));
              break;
          }
        }
        if (speakIt) speakerRef.current?.flush();
        if (!gotDone) patchMsg(aId, (m) => ({ ...m, status: m.text ? "done" : "error", text: m.text || ERR_UNDERSTAND }));
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          patchMsg(aId, (m) => ({ ...m, status: "done", stage: undefined }));
        } else {
          // Network failure: keep the entry, sync later.
          await enqueue({ kind: "chat", url: "/api/chat", body: { text, source } });
          patchMsg(aId, (m) => ({ ...m, status: "queued", text: ERR_QUEUED, stage: undefined }));
        }
      } finally {
        if (abortRef.current === ac) {
          busyRef.current = false;
          setBusy(false);
          setStage(null);
          abortRef.current = null;
          notifyChanged(); // quiet background refresh of data screens (no full reload)
          if (stateRef.current === "processing") finishVoiceIfIdle();
        }
      }
    },
    [finishVoiceIfIdle, patchMsg, setVoiceState],
  );

  const retryMsg = useCallback(
    (id: string) => {
      const m = messages.find((x) => x.id === id);
      if (m?.retryText) void send(m.retryText, "TEXT");
    },
    [messages, send],
  );

  // ─── voice ───────────────────────────────────────────────────────────────────────────────────
  const listen = useCallback(async () => {
    const s = sessionRef.current!;
    speakerRef.current?.cancel();
    setVoiceError(null);
    setPrompt(null);
    setTranscript("");
    setConfidence(null);
    setAlternative(null);
    try {
      if (!s.active) await s.open(); // also drives the waveform
      if (sttModeRef.current === "browser") {
        recogRef.current?.abort();
        const clearTimer = () => {
          if (noSpeechTimer.current) clearTimeout(noSpeechTimer.current);
          noSpeechTimer.current = null;
        };
        const d = startDictation({
          onText: (text) => {
            clearTimer();
            setTranscript(text);
          },
          onEnd: (finalText, conf) => {
            clearTimer();
            recogRef.current = null;
            if (!finalText) {
              setVoiceError("I couldn't make out any words. Try again a little closer to the mic.");
              setVoiceState("idle");
              s.close();
              return;
            }
            setTranscript(finalText);
            setConfidence(conf);
            setAlternative(null);
            setVoiceState("preview");
          },
          onError: (msg) => {
            clearTimer();
            recogRef.current = null;
            setVoiceError(msg);
            setVoiceState("idle");
            s.close();
          },
        });
        if (!d) throw new Error("I couldn't start speech recognition. Type instead.");
        recogRef.current = d;
        // Same 10-second "Are you still there?" nudge as the recording path.
        noSpeechTimer.current = setTimeout(() => {
          setPrompt("Are you still there?");
          speakerRef.current?.say("Are you still there?");
        }, 10_000);
      } else {
        s.startRecording();
      }
      setVoiceState("listening");
    } catch (e) {
      const msg = (e as Error).name === "NotAllowedError" ? "Microphone access was blocked. Allow it in your browser settings, or type instead." : (e as Error).message || "I couldn't start the microphone. Type instead.";
      setVoiceError(msg);
      s.close();
      setVoiceState("idle");
    }
  }, [setVoiceState]);

  const stopListening = useCallback(async () => {
    const s = sessionRef.current!;
    if (stateRef.current !== "listening") return;
    setPrompt(null);
    if (recogRef.current) {
      // Browser recognition delivers its result through onEnd, which moves us to the preview.
      setVoiceState("transcribing");
      recogRef.current.stop();
      return;
    }
    setVoiceState("transcribing");
    const blob = await s.stopRecording();
    if (!blob) {
      setVoiceError("I didn't catch anything. Tap the mic and try again.");
      setVoiceState("idle");
      s.close();
      return;
    }
    try {
      const fd = new FormData();
      fd.append("audio", blob, `speech.${blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm"}`);
      const res = await fetch("/api/stt", { method: "POST", body: fd });
      const j = (await res.json().catch(() => ({}))) as { text?: string; confidence?: number; alternative?: string | null; error?: string };
      if (!res.ok) throw new Error(j.error ?? "Transcription failed.");
      if (!j.text?.trim()) {
        setVoiceError("I couldn't make out any words. Try again a little closer to the mic.");
        setVoiceState("idle");
        s.close();
        return;
      }
      setTranscript(j.text.trim());
      setConfidence(j.confidence ?? null);
      setAlternative(j.alternative ?? null);
      setVoiceState("preview");
    } catch (e) {
      const offline = e instanceof TypeError;
      setVoiceError(offline ? "I couldn't reach the server to transcribe that. Type it instead and I'll queue it." : (e as Error).message);
      setVoiceState("idle");
      s.close();
    }
  }, [setVoiceState]);

  const cancelVoice = useCallback(() => {
    speakerRef.current?.cancel();
    recogRef.current?.abort();
    recogRef.current = null;
    if (noSpeechTimer.current) clearTimeout(noSpeechTimer.current);
    sessionRef.current?.close();
    setPrompt(null);
    setTranscript("");
    setVoiceState(busyRef.current ? "processing" : "idle");
  }, [setVoiceState]);

  const interrupt = useCallback(() => {
    speakerRef.current?.cancel();
    abortRef.current?.abort();
    void listen();
  }, [listen]);

  useEffect(() => {
    actions.current = { stop: stopListening, cancel: cancelVoice, interrupt };
  }, [stopListening, cancelVoice, interrupt]);

  const sendTranscript = useCallback(() => {
    const t = transcript.trim();
    if (!t) return;
    setTranscript("");
    setConfidence(null);
    setAlternative(null);
    void send(t, "VOICE");
  }, [send, transcript]);

  const speak = useCallback((text: string) => {
    speakerRef.current?.cancel();
    speakerRef.current?.say(text);
  }, []);

  const clearChat = useCallback(async () => {
    await fetch("/api/conversations", { method: "DELETE" }).catch(() => null);
    setMessages([]);
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      messages, busy, stage, voiceState, voiceError, prompt, transcript, setTranscript, confidence, alternative, ttsOn, setTtsOn, liveDay, queued, online, sheetOpen, sttMode,
      openSheet: () => setSheetOpen(true), closeSheet: () => setSheetOpen(false), send, retryMsg, listen, stopListening, cancelVoice, sendTranscript, interrupt, speak, clearChat,
    }),
    [messages, busy, stage, voiceState, voiceError, prompt, transcript, confidence, alternative, ttsOn, setTtsOn, liveDay, queued, online, sheetOpen, sttMode, send, retryMsg, listen, stopListening, cancelVoice, sendTranscript, interrupt, speak, clearChat],
  );

  return <CoachContext.Provider value={value}>{children}</CoachContext.Provider>;
}
