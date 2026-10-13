"use client";
import { Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Notice, Spinner } from "@/components/ui";
import { ApiError, isOfflineError, post } from "@/lib/client/api";
import { fmtDay, fmtNum } from "@/lib/client/format";

interface SearchResult {
  answer: string;
  query: { kind: "food" | "weight" | "workouts" | "activity" | "sleep"; field?: string | null };
  rows: { date: string; label: string; value: number | null }[];
}

const EXAMPLES = [
  "What did I eat last Monday?",
  "How much chicken did I eat this week?",
  "What was my average protein last month?",
  "What was my lowest weight?",
  "Show all my workouts",
];

const PAGE = 8;

function unitFor(q: SearchResult["query"]): string {
  switch (q.kind) {
    case "weight": return "kg";
    case "workouts": return q.field === "reps" ? "reps" : "kg volume";
    case "activity": return "steps";
    case "sleep": return "h";
    default: return q.field === "calories" || !q.field ? "kcal (est.)" : "g";
  }
}

/** Plain-language questions about the log. The server turns the question into a validated query and computes the answer in code. */
export function SearchPanel() {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);

  const ask = async (text: string) => {
    const query = text.trim();
    if (query.length < 2) return;
    setQ(query);
    setBusy(true);
    setError(null);
    try {
      setResult(await post<SearchResult>("/api/search", { q: query }));
      setShown(PAGE);
    } catch (e) {
      setResult(null);
      if (isOfflineError(e)) setError("Search needs a connection. Try again when you're back online.");
      else if (e instanceof ApiError && e.status === 422) setError("I couldn't work out what to look for. Try asking about food, weight, workouts, steps or sleep.");
      else if (e instanceof ApiError && e.status === 429) setError("You're searching quickly. Give it a minute and try again.");
      else setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const unit = result ? unitFor(result.query) : "";

  return (
    <section className="card space-y-3" aria-labelledby="search-h">
      <h2 id="search-h" className="text-sm font-semibold">Ask about your log</h2>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void ask(q); }}>
        <div className="flex-1">
          <label htmlFor="search-q" className="sr-only">Your question</label>
          <input id="search-q" className="input" value={q} onChange={(e) => setQ(e.target.value)} maxLength={300} placeholder="e.g. How much chicken did I eat this week?" />
        </div>
        <button className="btn btn-primary shrink-0" disabled={busy || q.trim().length < 2}>
          {busy ? <Spinner label="Searching" /> : <Search className="h-4 w-4" aria-hidden />} Search
        </button>
      </form>
      <ul className="flex flex-wrap gap-2" aria-label="Example questions">
        {EXAMPLES.map((ex) => (
          <li key={ex}><button className="btn !min-h-[44px] !px-3 text-muted" onClick={() => void ask(ex)} disabled={busy}>{ex}</button></li>
        ))}
      </ul>

      <div aria-live="polite" className="space-y-3">
        {error && <Notice tone="warn">{error}</Notice>}
        {result && (
          <>
            <p className="rounded-xl bg-brand/10 p-3 text-lg font-medium">{result.answer}</p>
            {result.rows.length > 0 && (
              <div>
                <p className="mb-1 text-xs text-muted">Showing {Math.min(shown, result.rows.length)} of {result.rows.length} matching entries</p>
                <ul className="divide-y divide-border text-sm">
                  {result.rows.slice(0, shown).map((r, i) => (
                    <li key={i} className="flex items-start justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <Link href={`/nutrition?date=${r.date}`} className="text-brand underline">{fmtDay(r.date)}</Link>
                        <p className="break-words text-muted">{r.label}</p>
                      </div>
                      <p className="shrink-0 tabular-nums">{r.value == null ? "—" : `${fmtNum(r.value, 1)} ${unit}`}</p>
                    </li>
                  ))}
                </ul>
                {shown < result.rows.length && (
                  <button className="btn mt-2" onClick={() => setShown((n) => n + 20)}>Show more</button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
