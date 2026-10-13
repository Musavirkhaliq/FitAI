"use client";
import { ArrowRight, ChevronRight, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Notice, Skeleton, Spinner } from "@/components/ui";
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
export function SearchPanel({ index = 0 }: { index?: number }) {
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
    <section className="card rise space-y-3.5" aria-labelledby="search-h" style={{ ["--i" as string]: index }}>
      <h2 id="search-h" className="display flex items-center gap-2 text-lg font-extrabold">
        <span className="grad-brand flex h-7 w-7 items-center justify-center rounded-full text-brand-fg"><Sparkles className="h-4 w-4" aria-hidden /></span>
        Ask about your log
      </h2>

      {/* Command bar: big field, search button tucked into its right edge */}
      <form className="relative" onSubmit={(e) => { e.preventDefault(); void ask(q); }}>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden />
        <label htmlFor="search-q" className="sr-only">Your question</label>
        <input
          id="search-q"
          className="input !min-h-[60px] !rounded-[1.25rem] pl-12 pr-[7.25rem]"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={300}
          placeholder="Ask anything, e.g. how much chicken this week?"
        />
        <button className="btn btn-primary absolute right-1.5 top-1.5 !min-h-[48px] !rounded-2xl !px-4" disabled={busy || q.trim().length < 2}>
          {busy ? <Spinner label="Searching" /> : <>Search <ArrowRight className="h-4 w-4" aria-hidden /></>}
        </button>
      </form>

      <div className="-mx-4 overflow-x-auto px-4 scrollbar-none sm:-mx-5 sm:px-5">
        <ul className="flex w-max gap-2 pb-1" aria-label="Example questions">
          {EXAMPLES.map((ex) => (
            <li key={ex}><button type="button" className="chip !min-h-[44px] text-muted" onClick={() => void ask(ex)} disabled={busy}>{ex}</button></li>
          ))}
        </ul>
      </div>

      <div aria-live="polite" className="space-y-3">
        {busy && !result && <Skeleton className="h-20 !rounded-2xl" />}
        {error && <Notice tone="warn">{error}</Notice>}
        {result && (
          <>
            <p className="pop display rounded-2xl p-4 text-xl font-extrabold leading-snug" style={{ background: "linear-gradient(150deg, rgb(var(--brand-a) / 0.16), rgb(var(--brand-b) / 0.06) 70%), rgb(var(--surface-2))" }}>
              {result.answer}
            </p>
            {result.rows.length > 0 && (
              <div>
                <p className="mb-2 px-1 text-xs text-muted">Showing {Math.min(shown, result.rows.length)} of {result.rows.length} matching entries</p>
                <ul className="space-y-2">
                  {result.rows.slice(0, shown).map((r, i) => (
                    <li key={i}>
                      <Link href={`/nutrition?date=${r.date}`} className="press flex min-h-[56px] items-center gap-3 rounded-2xl bg-surface-2 px-4 py-2.5 hover:bg-surface-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-brand">{fmtDay(r.date)}</p>
                          <p className="break-words text-sm text-muted">{r.label}</p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold tabular-nums">{r.value == null ? "—" : `${fmtNum(r.value, 1)} ${unit}`}</p>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
                {shown < result.rows.length && (
                  <button className="btn mt-3 w-full" onClick={() => setShown((n) => n + 20)}>Show more</button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
