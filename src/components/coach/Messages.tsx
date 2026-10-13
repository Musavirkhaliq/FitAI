"use client";
import { AlertTriangle, ExternalLink, RotateCcw, Undo2, Volume2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logTool } from "@/lib/client/api";
import { Badge, clsx, Spinner } from "@/components/ui";
import { useCoach, type CoachCard, type CoachMsg, type Label } from "./CoachProvider";

const DISCLAIMER = "AI can make mistakes. Double-check important results.";
const MEDICAL = "For pain, symptoms, or a medical condition, the next step is a doctor or physiotherapist.";

const LABEL_STYLE: Record<Label, string> = {
  FACT: "bg-surface-2 text-fg",
  ESTIMATE: "bg-warn/15 text-warn",
  ASSUMPTION: "border border-border text-muted",
  RECOMMENDATION: "bg-brand/15 text-brand",
};

export function LabelChip({ label }: { label: Label }) {
  return <span className={clsx("mr-2 inline-block rounded px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide", LABEL_STYLE[label])}>{label}</span>;
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
    <div className={clsx("rounded-xl border border-border bg-surface p-3 text-sm", removed && "opacity-50")}>
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className={clsx("font-medium", removed && "line-through")}>{card.title}</p>
        <div className="flex shrink-0 items-center gap-1">
          {card.confidence && <Badge tone={card.confidence === "HIGH" ? "good" : card.confidence === "MEDIUM" ? "warn" : "bad"}>{card.confidence}</Badge>}
          {card.entry && !removed && (
            <button className="btn btn-ghost !min-h-[32px] !px-2 text-xs" onClick={undo} disabled={busy} aria-label={`Undo: remove ${card.title}`}>
              <Undo2 className="h-3.5 w-3.5" aria-hidden /> Undo
            </button>
          )}
        </div>
      </div>
      {removed ? (
        <p className="text-muted">Removed.</p>
      ) : (
        <ul className="space-y-1">
          {card.lines.map((l, i) => (
            <li key={i} className="leading-snug"><LabelChip label={l.label} />{l.text}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Bubble({ m, compact }: { m: CoachMsg; compact?: boolean }) {
  const { speak, send, retryMsg, busy } = useCoach();
  const mine = m.role === "user";
  if (mine) {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-brand px-3.5 py-2 text-brand-fg">{m.text}</p>
      </div>
    );
  }
  return (
    <div className="flex">
      <div className={clsx("min-w-0 space-y-2", compact ? "max-w-full" : "max-w-[92%]")}>
        {m.safety === "RED" && (
          <div role="alert" className="flex gap-2 rounded-xl border border-bad/50 bg-bad/10 p-3 text-sm font-medium">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-bad" aria-hidden />
            <span>{m.text}</span>
          </div>
        )}
        {m.safety !== "RED" && (m.text || m.status !== "streaming") && (
          <p className={clsx("whitespace-pre-wrap rounded-2xl rounded-bl-md px-3.5 py-2", m.status === "error" ? "border border-bad/40 bg-bad/10" : m.status === "queued" ? "border border-warn/40 bg-warn/10" : "bg-surface-2")}>{m.text || "…"}</p>
        )}
        {m.status === "streaming" && !m.text && (
          <p className="inline-flex items-center gap-2 rounded-2xl bg-surface-2 px-3.5 py-2 text-muted" role="status"><Spinner label={m.stage ?? "Working"} /> {m.stage ?? "Thinking…"}</p>
        )}
        {m.cards.length > 0 && <div className="space-y-2">{m.cards.map((c, i) => <CardView key={i} card={c} />)}</div>}
        {m.links.map((l, i) => (
          <Link key={i} href={l.href} className="btn btn-primary !min-h-[40px]" {...(l.href.startsWith("/api/") ? { prefetch: false } : {})}>
            {l.label} <ExternalLink className="h-4 w-4" aria-hidden />
          </Link>
        ))}
        {m.options && m.status === "done" && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Quick replies">
            {m.options.map((o) => (
              <button key={o} className="btn !min-h-[40px]" disabled={busy} onClick={() => void send(o, "TEXT")}>{o}</button>
            ))}
          </div>
        )}
        <div className="flex gap-1">
          {m.status === "error" && m.retryText && (
            <button className="btn btn-ghost !min-h-[32px] text-xs" onClick={() => retryMsg(m.id)}><RotateCcw className="h-3.5 w-3.5" aria-hidden /> Retry</button>
          )}
          {m.text && m.status === "done" && (
            <button className="btn btn-ghost !min-h-[32px] text-xs" onClick={() => speak(m.text)} aria-label="Read this reply aloud"><Volume2 className="h-3.5 w-3.5" aria-hidden /> Read aloud</button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Conversation list. Auto-scrolls to the newest message and announces it politely to screen readers. */
export function MessageList({ messages, compact, empty }: { messages: CoachMsg[]; compact?: boolean; empty?: React.ReactNode }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);
  return (
    <div className="space-y-3" role="log" aria-live="polite" aria-label="Conversation with your coach">
      {messages.length === 0 && empty}
      {messages.map((m) => <Bubble key={m.id} m={m} compact={compact} />)}
      <div ref={end} />
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
