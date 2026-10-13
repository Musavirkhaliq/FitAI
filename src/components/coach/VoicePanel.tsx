"use client";
import { Mic, RotateCcw, Send, Square, Volume2, VolumeX, WifiOff, X } from "lucide-react";
import { useId, useState } from "react";
import { clsx } from "@/components/ui";
import { useCoach } from "./CoachProvider";
import { Waveform } from "./Waveform";

const STATUS: Record<string, string> = {
  idle: "Tap the mic and just talk",
  listening: "Listening…",
  transcribing: "Transcribing…",
  preview: "Check what I heard",
  processing: "Understanding…",
  speaking: "Speaking — talk to interrupt",
};

/**
 * The voice-first control surface: big mic, live waveform, editable transcript preview, retry, misrecognition
 * recovery and a persistent text fallback. Used inline on Today and inside the global voice sheet.
 */
export function VoicePanel({ variant = "hero", autoFocusText = false }: { variant?: "hero" | "compact"; autoFocusText?: boolean }) {
  const c = useCoach();
  const [text, setText] = useState("");
  const textId = useId();
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
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex items-center justify-center">
        {listening && (
          <>
            <span aria-hidden className={clsx("absolute rounded-full bg-brand/30 motion-safe:animate-pulse-ring", big ? "h-24 w-24" : "h-16 w-16")} />
            <span aria-hidden className={clsx("absolute rounded-full bg-brand/20 motion-safe:animate-pulse-ring [animation-delay:600ms]", big ? "h-24 w-24" : "h-16 w-16")} />
          </>
        )}
        <button
          onClick={onMic}
          aria-label={listening ? "Stop listening and transcribe" : c.voiceState === "speaking" ? "Interrupt and talk to your coach" : "Talk to your coach"}
          aria-pressed={listening}
          disabled={c.voiceState === "transcribing"}
          className={clsx(
            "relative z-10 flex items-center justify-center rounded-full bg-brand text-brand-fg shadow-lg shadow-brand/30 transition-transform hover:scale-105 active:scale-95 disabled:opacity-60",
            big ? "h-24 w-24" : "h-16 w-16",
          )}
        >
          {listening ? <Square className={big ? "h-8 w-8" : "h-6 w-6"} fill="currentColor" aria-hidden /> : <Mic className={big ? "h-10 w-10" : "h-7 w-7"} aria-hidden />}
        </button>
      </div>

      {big && <p className="text-base font-semibold">Talk to your coach</p>}

      <div className="flex h-12 w-full max-w-sm items-center justify-center text-brand" aria-hidden={!listening}>
        <Waveform active={listening} className="h-12 w-full" />
      </div>

      <p role="status" aria-live="polite" className="min-h-[1.5rem] text-center text-sm text-muted">
        {c.prompt ?? status}
      </p>

      {c.sttMode === "browser" && listening && c.transcript && (
        <p className="w-full max-w-md rounded-xl bg-surface-2 px-3 py-2 text-center text-sm" aria-live="polite">“{c.transcript}”</p>
      )}
      {c.sttMode === "browser" && (
        <p className="max-w-sm text-center text-xs text-muted">Using your browser&apos;s built-in speech recognition (best in Chrome or Edge). Your browser&apos;s provider processes the audio.</p>
      )}

      {c.voiceError && (
        <p role="alert" className="w-full max-w-md rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-center text-sm">
          {c.voiceError}
        </p>
      )}

      {c.voiceState === "preview" && (
        <div className="w-full max-w-md space-y-2 rounded-xl2 border border-border bg-surface p-3">
          {lowConf && (
            <div role="group" aria-label="Did you mean" className="space-y-1.5 text-sm">
              <p className="font-medium">{c.alternative ? "I'm not sure I heard that right. Did you mean…" : "I'm not sure I heard that right. Edit it below if needed."}</p>
              {c.alternative && (
                <div className="flex flex-col gap-1.5">
                  <button className="btn justify-start text-left" onClick={() => c.setTranscript(c.transcript)}>“{c.transcript}”</button>
                  <button className="btn justify-start text-left" onClick={() => c.setTranscript(c.alternative!)}>or “{c.alternative}”</button>
                </div>
              )}
            </div>
          )}
          <label htmlFor={`${textId}-preview`} className="label">What I heard (you can edit)</label>
          <textarea
            id={`${textId}-preview`}
            className="input min-h-[84px] py-2"
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
            <button className="btn btn-ghost" onClick={c.cancelVoice} aria-label="Discard recording"><X className="h-4 w-4" aria-hidden /></button>
          </div>
        </div>
      )}

      {/* Persistent text input: always available as an alternative to voice. */}
      <form onSubmit={submitText} className="flex w-full max-w-md gap-2">
        <label htmlFor={`${textId}-text`} className="sr-only">Type a message to your coach</label>
        <input
          id={`${textId}-text`}
          className="input"
          placeholder="Or type: “had 2 eggs and toast for breakfast”"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus={autoFocusText}
          enterKeyHint="send"
          maxLength={2000}
        />
        <button type="submit" className="btn btn-primary shrink-0" disabled={!text.trim()} aria-label="Send message"><Send className="h-4 w-4" aria-hidden /></button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted">
        <button className="inline-flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-surface-2" onClick={() => c.setTtsOn(!c.ttsOn)} aria-pressed={c.ttsOn}>
          {c.ttsOn ? <Volume2 className="h-3.5 w-3.5" aria-hidden /> : <VolumeX className="h-3.5 w-3.5" aria-hidden />}
          Spoken replies: {c.ttsOn ? "on" : "off"}
        </button>
        {(!c.online || c.queued > 0) && (
          <span className="inline-flex items-center gap-1 text-warn" role="status">
            <WifiOff className="h-3.5 w-3.5" aria-hidden />
            {c.online ? `${c.queued} waiting to sync` : `Offline${c.queued ? ` · ${c.queued} queued` : ""}`}
          </span>
        )}
      </div>
    </div>
  );
}
