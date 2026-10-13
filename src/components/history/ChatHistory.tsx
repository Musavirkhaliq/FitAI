"use client";
import { useState } from "react";
import { Badge, ErrorState, Notice, Skeleton, clsx } from "@/components/ui";
import { useApi } from "@/lib/client/api";

interface ChatRow { id: string; role: string; content: string; createdAt: string; pending: boolean }

const PAGE = 6;

const stamp = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Read-only look back at the last 50 chat messages, newest first. Compact: six at a time. */
export function ChatHistory({ index = 0 }: { index?: number }) {
  const { data, error, loading, refresh } = useApi<{ messages: ChatRow[] }>("/api/conversations?limit=50");
  const [shown, setShown] = useState(PAGE);
  const rows = data ? [...data.messages].reverse() : [];

  return (
    <section className="card rise space-y-3" aria-labelledby="chat-h" style={{ ["--i" as string]: index }}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="chat-h" className="display text-lg font-extrabold">Chat history</h2>
        {data && rows.length > 0 && <p className="text-xs text-muted">Last {rows.length} messages</p>}
      </div>
      {error && data && <Notice tone="warn">{error}</Notice>}
      {loading && !data ? (
        <div role="status" aria-live="polite" className="space-y-2">
          <span className="sr-only">Loading chat history…</span>
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 !rounded-2xl" />)}
        </div>
      ) : !data ? (
        <ErrorState message={error ?? "I couldn't load your chat history."} onRetry={() => void refresh()} />
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">No conversations yet. Say hello to your coach from the Today page.</p>
      ) : (
        <>
          <ul className="space-y-1.5 text-sm">
            {rows.slice(0, shown).map((m) => {
              const coach = m.role === "assistant";
              return (
                <li key={m.id} className={clsx("rounded-2xl px-3.5 py-2.5", coach ? "bg-surface-2" : "border border-border")}>
                  <p className="mb-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span className="font-semibold text-fg">{coach ? "Coach" : "You"}</span>
                    <time dateTime={m.createdAt}>{stamp(m.createdAt)}</time>
                    {m.pending && <Badge>Queued</Badge>}
                  </p>
                  <p className="line-clamp-3 whitespace-pre-wrap break-words">{m.content}</p>
                </li>
              );
            })}
          </ul>
          {shown < rows.length && <button className="btn w-full" onClick={() => setShown((n) => n + PAGE)}>Show {Math.min(PAGE, rows.length - shown)} more</button>}
        </>
      )}
    </section>
  );
}
