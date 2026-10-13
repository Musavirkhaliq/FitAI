"use client";
import { AlertTriangle, ExternalLink, RotateCcw, Sparkles, Undo2, Volume2 } from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import { logTool } from "@/lib/client/api";
import { clsx } from "@/components/ui";
import { useCoach, type CoachCard, type CoachMsg, type Label } from "./CoachProvider";

const DISCLAIMER = "AI can make mistakes. Double-check important results.";
const MEDICAL = "For pain, symptoms, or a medical condition, the next step is a doctor or physiotherapist.";

/** Labels stay TEXT: colour only reinforces the word, it never replaces it. */
const LABEL_STYLE: Record<Label, string> = {
  FACT: "bg-surface-3 text-fg",
  ESTIMATE: "bg-warn/15 text-warn",
  ASSUMPTION: "border border-border text-muted",
  RECOMMENDATION: "bg-brand/15 text-brand",
};

export function LabelChip({ label }: { label: Label }) {
  return <span className={clsx("mr-2 inline-block rounded-full px-2 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wide", LABEL_STYLE[label])}>{label}</span>;
}

/** Calm, neutral confidence note: three dots and a word. Never alarm-coloured, because low confidence is information, not failure. */
function Confidence({ level }: { level: NonNullable<CoachCard["confidence"]> }) {
  const n = level === "HIGH" ? 3 : level === "MEDIUM" ? 2 : 1;
  const word = level.charAt(0) + level.slice(1).toLowerCase();
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-muted">
      <span aria-hidden className="flex gap-0.5">
        {[0, 1, 2].map((i) => <span key={i} className={clsx("h-1.5 w-1.5 rounded-full", i < n ? "bg-fg/60" : "bg-border")} />)}
      </span>
      {word} confidence
    </span>
  );
}

const ENTRY_TOOL: Record<string, string> = { food: "food", weight: "weight", activity: "activity", sleep: "sleep", set: "set", measurement: "measurement" };

function CardView({ card }: { card: CoachCard }) {
  const [removed, setRemoved] = useState(false);
  const [busy, setBusy] = useState(false);
  const undo = async () => {
    if (!card.entry) return;
    setBusy(true);
    try {
      await logTool("delete_entry", { kind: ENTRY_TOOL[card.entry.kind] ?? card.entry.kind, id: card.entry.id });
      setRemoved(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={clsx("rounded-2xl border border-border bg-surface p-3.5 text-sm shadow-tile transition-opacity", removed && "opacity-50")}>
      <div className="mb-2 flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
        <p className={clsx("display text-[0.95rem] font-bold leading-snug", removed && "line-through")}>{card.title}</p>
        <div className="flex shrink-0 items-center gap-1">
          {card.confidence && <Confidence level={card.confidence} />}
          {card.entry && !removed && (
            <button className="btn btn-ghost !min-h-[44px] !-my-2 !px-2.5 text-xs font-medium text-muted" onClick={undo} disabled={busy} aria-label={`Undo: remove ${card.title}`}>
              <Undo2 className="h-3.5 w-3.5" aria-hidden /> Undo
            </button>
          )}
        </div>
      </div>
      {removed ? (
        <p className="text-muted">Removed.</p>
      ) : (
        <ul className="space-y-1.5">
          {card.lines.map((l, i) => (
            <li key={i} className="leading-snug"><LabelChip label={l.label} />{l.text}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Three bouncing dots. Static under reduced motion (the global reduced-motion rule and `motion-safe`). */
function Dots() {
  return (
    <span aria-hidden className="flex items-center gap-1">
      {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 rounded-full bg-muted/70 motion-safe:animate-bounce" style={{ animationDelay: `${i * 140}ms` }} />)}
    </span>
  );
}

function Avatar() {
  return (
    <span aria-hidden className="grad-brand relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-brand-fg" style={{ boxShadow: "var(--shadow-tile)" }}>
      <span className="pointer-events-none absolute inset-0 rounded-full" style={{ background: "radial-gradient(120% 90% at 30% 15%, rgb(255 255 255 / 0.5), transparent 55%)" }} />
      <Sparkles className="relative h-3.5 w-3.5" />
    </span>
  );
}

function Bubble({ m, compact, avatar }: { m: CoachMsg; compact?: boolean; avatar?: boolean }) {
  const { speak, send, retryMsg, busy } = useCoach();
  const mine = m.role === "user";
  if (mine) {
    return (
      <div className="rise flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-[1.4rem] rounded-br-md px-4 py-2.5 leading-snug text-brand-fg" style={{ background: "var(--btn-bg)", boxShadow: "var(--glow)" }}>{m.text}</p>
      </div>
    );
  }
  return (
    <div className="rise flex items-end gap-2">
      {!compact && (avatar ? <Avatar /> : <span aria-hidden className="w-7 shrink-0" />)}
      <div className={clsx("min-w-0 space-y-2", compact ? "max-w-full" : "max-w-[calc(100%-2.25rem)] sm:max-w-[85%]")}>
        {m.safety === "RED" && (
          <div role="alert" className="flex gap-3 rounded-2xl border-2 border-bad bg-bad/10 p-4 text-[0.95rem] font-semibold leading-snug">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bad text-white dark:text-bg"><AlertTriangle className="h-5 w-5" aria-hidden /></span>
            <span className="min-w-0 whitespace-pre-wrap break-words pt-1">{m.text}</span>
          </div>
        )}
        {m.safety !== "RED" && (m.text || m.status !== "streaming") && (
          <p className={clsx("whitespace-pre-wrap break-words rounded-[1.4rem] rounded-bl-md px-4 py-2.5 leading-snug", m.status === "error" ? "border border-bad/40 bg-bad/10" : m.status === "queued" ? "border border-warn/40 bg-warn/10" : "bg-surface-2")}>{m.text || "…"}</p>
        )}
        {m.status === "streaming" && !m.text && (
          <p role="status" className="inline-flex items-center gap-2.5 rounded-[1.4rem] rounded-bl-md bg-surface-2 px-4 py-3 text-sm text-muted">
            <Dots />
            <span>{m.stage ?? "Thinking…"}</span>
          </p>
        )}
        {m.cards.length > 0 && <div className="space-y-2">{m.cards.map((c, i) => <CardView key={i} card={c} />)}</div>}
        {m.links.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {m.links.map((l, i) => (
              <Link key={i} href={l.href} className="btn btn-primary !min-h-[44px] !rounded-full !px-5" {...(l.href.startsWith("/api/") ? { prefetch: false } : {})}>
                {l.label} <ExternalLink className="h-4 w-4" aria-hidden />
              </Link>
            ))}
          </div>
        )}
        {m.options && m.status === "done" && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Quick replies">
            {m.options.map((o) => (
              <button key={o} className="chip !min-h-[44px]" disabled={busy} onClick={() => void send(o, "TEXT")}>{o}</button>
            ))}
          </div>
        )}
        {((m.status === "error" && m.retryText) || (m.text && m.status === "done")) && (
          <div className="-ml-2 flex gap-0.5">
            {m.status === "error" && m.retryText && (
              <button className="btn btn-ghost !min-h-[44px] !px-2.5 text-xs font-medium text-muted" onClick={() => retryMsg(m.id)}><RotateCcw className="h-3.5 w-3.5" aria-hidden /> Retry</button>
            )}
            {m.text && m.status === "done" && (
              <button className="btn btn-ghost !min-h-[44px] !px-2.5 text-xs font-medium text-muted" onClick={() => speak(m.text)} aria-label="Read this reply aloud"><Volume2 className="h-3.5 w-3.5" aria-hidden /> Read aloud</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const GAP_MS = 30 * 60 * 1000;
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const timeOf = (d: Date) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
function dayLabel(d: Date, now: Date) {
  if (sameDay(d, now)) return "Today";
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  return sameDay(d, y) ? "Yesterday" : d.toLocaleDateString([], { weekday: "long", day: "numeric", month: "short" });
}

/** Quiet divider: a hairline, a small label, a hairline. Decorative, so hidden from the live region. */
function Separator({ children }: { children: string }) {
  return (
    <div aria-hidden className="flex items-center gap-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
      <span className="h-px flex-1 bg-border" />
      {children}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

/**
 * Conversation list. Auto-scrolls to the newest message and announces it politely to screen readers.
 * Date separators use when each message first appeared on this screen (the chat itself is not persisted with timestamps).
 */
export function MessageList({ messages, compact, empty, endClassName }: { messages: CoachMsg[]; compact?: boolean; empty?: React.ReactNode; endClassName?: string }) {
  const end = useRef<HTMLDivElement>(null);
  const seen = useRef(new Map<string, number>());
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  for (const m of messages) if (!seen.current.has(m.id)) seen.current.set(m.id, Date.now());
  const now = new Date();

  return (
    <div className="space-y-3" role="log" aria-live="polite" aria-label="Conversation with your coach">
      {messages.length === 0 && empty}
      {messages.map((m, i) => {
        const at = new Date(seen.current.get(m.id) ?? Date.now());
        const prev = i > 0 ? messages[i - 1] : null;
        const prevAt = prev ? new Date(seen.current.get(prev.id) ?? 0) : null;
        let sep: string | null = null;
        if (!compact) {
          if (!prevAt) sep = dayLabel(at, now);
          else if (!sameDay(prevAt, at)) sep = `${dayLabel(at, now)}, ${timeOf(at)}`;
          else if (at.getTime() - prevAt.getTime() > GAP_MS) sep = timeOf(at);
        }
        return (
          <Fragment key={m.id}>
            {sep && <Separator>{sep}</Separator>}
            <Bubble m={m} compact={compact} avatar={!prev || prev.role !== "assistant"} />
          </Fragment>
        );
      })}
      <div ref={end} className={endClassName} />
    </div>
  );
}

export function SafetyFooter({ className }: { className?: string }) {
  return (
    <p className={clsx("text-xs text-muted", className)}>
      {DISCLAIMER} {MEDICAL}
    </p>
  );
}
