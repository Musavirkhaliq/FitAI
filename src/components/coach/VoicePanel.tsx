"use client";
import { RotateCcw, Send, Volume2, VolumeX, WifiOff, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { clsx } from "@/components/ui";
import { useCoach } from "./CoachProvider";
import { VoiceOrb } from "./VoiceOrb";
import { Waveform } from "./Waveform";

const STATUS: Record<string, string> = {
  idle: "Tap and just talk",
  listening: "Listening…",
  transcribing: "Transcribing…",
  preview: "Check what I heard",
  processing: "Understanding…",
  speaking: "Speaking · talk to interrupt",
};

/** Things people actually say. Tapping one fills the box so they can edit it, which also teaches what the coach understands. */
const SUGGESTIONS = ["I weighed 84.5 this morning", "Had 2 eggs and toast for breakfast", "Walked 8,000 steps", "Can I eat biryani tonight?", "How am I doing this week?"];

/**
 * The voice-first control surface: audio-reactive orb, live waveform, editable transcript preview, retry, misrecognition
 * recovery and a persistent text fallback. Used inline on Today/Coach and inside the global voice sheet.
 */
export function VoicePanel({ variant = "hero", autoFocusText = false }: { variant?: "hero" | "compact"; autoFocusText?: boolean }) {
  const c = useCoach();
  const [text, setText] = useState("");
  const textId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listening = c.voiceState === "listening";
  const big = variant === "hero";

  const onMic = () => {
    if (listening) void c.stopListening();
    else if (c.voiceState === "speaking" || c.voiceState === "processing") c.interrupt();
    else void c.listen();
  };

  const status = c.voiceState === "processing" && c.stage ? c.stage : STATUS[c.voiceState];
  const lowConf = c.voiceState === "preview" && c.confidence != null && c.confidence < 0.7;

  const submitText = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText("");
    void c.send(t, "TEXT");
  };

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <VoiceOrb
        state={c.voiceState}
        size={big ? 104 : 80}
        hasError={!!c.voiceError}
        onClick={onMic}
        disabled={c.voiceState === "transcribing"}
        label={listening ? "Stop listening and transcribe" : c.voiceState === "speaking" ? "Interrupt and talk to your coach" : "Talk to your coach"}
      />

      <div className="-mt-3 text-center">
        {big && <p className="display text-xl font-extrabold">Talk to your coach</p>}
        <p role="status" aria-live="polite" className="min-h-[1.5rem] text-sm text-muted">{c.prompt ?? status}</p>
      </div>

      <div className={clsx("flex h-10 w-full max-w-xs items-center justify-center text-brand transition-opacity duration-300", listening ? "opacity-100" : "opacity-0")} aria-hidden>
        <Waveform active={listening} className="h-10 w-full" />
      </div>

      {c.sttMode === "browser" && listening && c.transcript && (
        <p className="pop w-full max-w-md rounded-2xl bg-surface-2 px-4 py-2.5 text-center text-base" aria-live="polite">“{c.transcript}”</p>
      )}

      {c.voiceError && (
        <p role="alert" className="pop w-full max-w-md rounded-2xl border border-warn/40 bg-warn/10 px-4 py-2.5 text-center text-sm">{c.voiceError}</p>
      )}

      {c.voiceState === "preview" && (
        <div className="pop glass w-full max-w-md space-y-3 rounded-[1.5rem] border border-border p-4 shadow-tile">
          {lowConf && (
            <div role="group" aria-label="Did you mean" className="space-y-2 text-sm">
              <p className="font-semibold">{c.alternative ? "I'm not sure I heard that right. Did you mean…" : "I'm not sure I heard that right. Edit it below if needed."}</p>
              {c.alternative && (
                <div className="flex flex-col gap-2">
                  <button className="btn justify-start text-left" onClick={() => c.setTranscript(c.transcript)}>“{c.transcript}”</button>
                  <button className="btn justify-start text-left" onClick={() => c.setTranscript(c.alternative!)}>or “{c.alternative}”</button>
                </div>
              )}
            </div>
          )}
          <label htmlFor={`${textId}-preview`} className="eyebrow block">What I heard · edit if needed</label>
          <textarea
            id={`${textId}-preview`}
            className="input min-h-[88px] py-3"
            value={c.transcript}
            onChange={(e) => c.setTranscript(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                c.sendTranscript();
              }
            }}
            autoFocus
          />
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1" onClick={c.sendTranscript} disabled={!c.transcript.trim()}><Send className="h-4 w-4" aria-hidden /> Send</button>
            <button className="btn" onClick={() => void c.listen()}><RotateCcw className="h-4 w-4" aria-hidden /> Retry</button>
            <button className="btn btn-ghost !px-3" onClick={c.cancelVoice} aria-label="Discard recording"><X className="h-4 w-4" aria-hidden /></button>
          </div>
        </div>
      )}

      {/* Persistent text input: always available as an alternative to voice. */}
      <form onSubmit={submitText} className="relative w-full max-w-md">
        <label htmlFor={`${textId}-text`} className="sr-only">Type a message to your coach</label>
        <input
          id={`${textId}-text`}
          ref={inputRef}
          className="input !rounded-full !pr-14"
          placeholder="Or type what you ate, lifted or weighed…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus={autoFocusText}
          enterKeyHint="send"
          maxLength={2000}
        />
        <button type="submit" disabled={!text.trim()} aria-label="Send message"
          className="press absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-brand-fg disabled:opacity-40" style={{ background: "var(--btn-bg)" }}>
          <Send className="h-4 w-4" aria-hidden />
        </button>
      </form>

      {big && c.voiceState === "idle" && !text && (
        <div className="-mx-4 w-[calc(100%+2rem)] max-w-xl overflow-x-auto px-4 scrollbar-none" aria-label="Examples">
          <div className="flex w-max gap-2 pb-1">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" className="chip whitespace-nowrap" onClick={() => { setText(s); inputRef.current?.focus(); }}>{s}</button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted">
        <button className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg px-2 hover:bg-surface-2" onClick={() => c.setTtsOn(!c.ttsOn)} aria-pressed={c.ttsOn}>
          {c.ttsOn ? <Volume2 className="h-3.5 w-3.5" aria-hidden /> : <VolumeX className="h-3.5 w-3.5" aria-hidden />}
          Spoken replies {c.ttsOn ? "on" : "off"}
        </button>
        {(!c.online || c.queued > 0) && (
          <span className="inline-flex items-center gap-1 text-warn" role="status">
            <WifiOff className="h-3.5 w-3.5" aria-hidden />
            {c.online ? `${c.queued} waiting to sync` : `Offline${c.queued ? ` · ${c.queued} queued` : ""}`}
          </span>
        )}
      </div>
      {c.sttMode === "browser" && (
        <p className="max-w-sm text-center text-xs text-muted">Using your browser&apos;s built-in speech recognition (best in Chrome or Edge). Your browser&apos;s provider processes the audio.</p>
      )}
    </div>
  );
}
