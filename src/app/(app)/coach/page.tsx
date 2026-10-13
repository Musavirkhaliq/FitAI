"use client";
import { Send, Sparkles, Trash2, Volume2, VolumeX } from "lucide-react";
import { useId, useState } from "react";
import { useCoach } from "@/components/coach/CoachProvider";
import { MessageList, SafetyFooter } from "@/components/coach/Messages";
import { VoiceOrb } from "@/components/coach/VoiceOrb";
import { VoicePanel } from "@/components/coach/VoicePanel";
import { PageHeader, haptic } from "@/components/ui";

const EXAMPLES = [
  "I weighed 84.5 this morning",
  "I had five egg whites and half a yolk for breakfast",
  "Can I eat biryani tonight?",
  "How am I doing this week?",
  "Why did my weight go up?",
  "Give me tomorrow's workout",
];

/** First-run state: one calm orb, one line, and things worth saying (tap to send). */
function EmptyChat({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="rise flex flex-col items-center gap-5 px-1 py-8 text-center">
      <span aria-hidden className="grad-brand relative flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full text-brand-fg motion-safe:animate-breathe" style={{ boxShadow: "var(--shadow-float), 0 0 40px -6px rgb(var(--brand-a) / 0.5)" }}>
        <span className="pointer-events-none absolute inset-0 rounded-full" style={{ background: "radial-gradient(120% 90% at 30% 15%, rgb(255 255 255 / 0.55), transparent 55%)" }} />
        <Sparkles className="relative h-8 w-8" />
      </span>
      <div>
        <p className="display text-xl font-extrabold">Your coach is ready</p>
        <p className="mt-1 text-sm text-muted">Try saying…</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {EXAMPLES.map((e) => (
          <button key={e} type="button" className="chip !h-auto !min-h-[44px] !whitespace-normal py-2 text-left" onClick={() => { haptic(); onPick(e); }}>{e}</button>
        ))}
      </div>
    </div>
  );
}

/**
 * Bottom-docked composer. Idle: a slim pill with the text box and the mic. While the mic is live (listening, transcribing,
 * or checking what was heard) it opens the full voice panel so nothing about the voice flow is hidden or changed.
 */
function Composer() {
  const c = useCoach();
  const [text, setText] = useState("");
  const id = useId();
  const listening = c.voiceState === "listening";
  const full = listening || c.voiceState === "transcribing" || c.voiceState === "preview";

  const onMic = () => {
    if (listening) void c.stopListening();
    else if (c.voiceState === "speaking" || c.voiceState === "processing") c.interrupt();
    else void c.listen();
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText("");
    void c.send(t, "TEXT");
  };

  if (full) {
    return (
      <div className="pop glass max-h-[75dvh] overflow-y-auto rounded-[1.75rem] border border-border p-4 shadow-float">
        <VoicePanel variant="compact" autoFocusText={false} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {c.voiceError && (
        <p role="alert" className="pop rounded-2xl border border-warn/40 bg-warn/10 px-4 py-2.5 text-center text-sm backdrop-blur">{c.voiceError}</p>
      )}
      <form onSubmit={submit} className="glass flex items-center gap-1.5 rounded-[1.75rem] border border-border p-1.5 pl-4 shadow-float transition-colors focus-within:border-brand">
        <label htmlFor={id} className="sr-only">Type a message to your coach</label>
        <input
          id={id}
          className="min-h-[48px] min-w-0 flex-1 bg-transparent text-base text-fg placeholder:text-muted focus:outline-none focus-visible:outline-none"
          placeholder="Type what you ate, lifted or weighed…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          enterKeyHint="send"
          maxLength={2000}
        />
        {text.trim() ? (
          <button type="submit" aria-label="Send message" className="press pop flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-brand-fg" style={{ background: "var(--btn-bg)", boxShadow: "var(--glow)" }}>
            <Send className="h-5 w-5" aria-hidden />
          </button>
        ) : (
          <div className="-m-[11px] shrink-0">
            <VoiceOrb
              state={c.voiceState}
              size={44}
              hasError={!!c.voiceError}
              onClick={onMic}
              label={c.voiceState === "speaking" ? "Interrupt and talk to your coach" : "Talk to your coach"}
            />
          </div>
        )}
      </form>
    </div>
  );
}

export default function CoachPage() {
  const c = useCoach();
  return (
    // The negative bottom margin cancels the shell's bottom padding, so the sticky composer settles exactly where it floats.
    <div className="mx-auto -mb-[4.5rem] flex min-h-[calc(100dvh-5rem)] max-w-3xl flex-col gap-4 md:-mb-24">
      <PageHeader
        title="AI Coach"
        subtitle="Talk or type. I log it, estimate honestly, and say what's a fact, an estimate, an assumption or a recommendation."
        actions={
          <>
            <button className="chip" onClick={() => c.setTtsOn(!c.ttsOn)} aria-pressed={c.ttsOn}>
              {c.ttsOn ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}
              Spoken replies {c.ttsOn ? "on" : "off"}
            </button>
            {c.messages.length > 0 && (
              <button className="chip" onClick={() => void c.clearChat()}><Trash2 className="h-4 w-4" aria-hidden /> Clear chat</button>
            )}
          </>
        }
      />

      <div className="flex-1">
        <MessageList
          messages={c.messages}
          endClassName="scroll-mb-44"
          empty={<EmptyChat onPick={(t) => void c.send(t, "TEXT")} />}
        />
      </div>

      <SafetyFooter className="px-2 text-center" />

      <div className="sticky bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4.75rem)] z-20 md:bottom-4">
        <Composer />
      </div>
    </div>
  );
}
