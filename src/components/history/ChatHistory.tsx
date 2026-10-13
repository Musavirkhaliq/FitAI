"use client";
import { Badge, ErrorState, LoadingBlock, Notice } from "@/components/ui";
import { useApi } from "@/lib/client/api";

interface ChatRow { id: string; role: string; content: string; createdAt: string; pending: boolean }

const stamp = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Read-only look back at the last 50 chat messages, newest first. */
export function ChatHistory() {
  const { data, error, loading, refresh } = useApi<{ messages: ChatRow[] }>("/api/conversations?limit=50");
  const rows = data ? [...data.messages].reverse() : [];

  return (
    <section className="card space-y-3" aria-labelledby="chat-h">
      <h2 id="chat-h" className="text-sm font-semibold">Chat history</h2>
      {error && data && <Notice tone="warn">{error}</Notice>}
      {loading && !data ? (
        <LoadingBlock label="Loading chat history" rows={3} />
      ) : !data ? (
        <ErrorState message={error ?? "I couldn't load your chat history."} onRetry={() => void refresh()} />
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No conversations yet. Say hello to your coach from the Today page.</p>
      ) : (
        <ul className="max-h-[28rem] divide-y divide-border overflow-y-auto rounded-xl border border-border text-sm">
          {rows.map((m) => (
            <li key={m.id} className="px-3 py-2">
              <p className="mb-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="font-semibold text-fg">{m.role === "assistant" ? "Coach" : "You"}</span>
                <time dateTime={m.createdAt}>{stamp(m.createdAt)}</time>
                {m.pending && <Badge>Queued</Badge>}
              </p>
              <p className="line-clamp-4 whitespace-pre-wrap break-words">{m.content}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
