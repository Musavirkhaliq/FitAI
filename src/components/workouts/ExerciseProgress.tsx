"use client";
import { Check, Circle, SkipForward } from "lucide-react";
import { clsx } from "@/components/ui";

export interface ProgressItem { id: string; name: string; done: number; planned: number; skipped: boolean }

const status = (it: ProgressItem) => (it.skipped ? "skipped" : it.done >= it.planned ? "complete" : it.done > 0 ? "partial" : "todo");

/** One dot per exercise: filled when complete, a ring when started, a long pill for the current one. Each dot is a 44 px tap target. */
export function ProgressDots({ items, current, onSelect }: { items: ProgressItem[]; current: number; onSelect: (i: number) => void }) {
  return (
    <ol className="flex items-center justify-center" aria-label="Exercise progress">
      {items.map((it, i) => {
        const st = status(it);
        const here = i === current;
        return (
          <li key={it.id}>
            <button
              type="button"
              onClick={() => onSelect(i)}
              aria-current={here ? "step" : undefined}
              aria-label={`Exercise ${i + 1} of ${items.length}: ${it.name}, ${it.skipped ? "skipped" : `${it.done} of ${it.planned} sets${st === "complete" ? ", complete" : ""}`}`}
              className="press flex h-11 min-w-[28px] items-center justify-center px-1"
            >
              <span
                aria-hidden
                className={clsx(
                  "block h-2.5 rounded-full border-2 transition-all duration-300",
                  here ? "w-7" : "w-2.5",
                  st === "complete" || here ? "border-brand bg-brand" : st === "partial" ? "border-brand bg-brand/30" : st === "skipped" ? "border-border bg-surface-3" : "border-border bg-transparent",
                  here && st !== "complete" && "shadow-glow",
                )}
              />
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** Every exercise in today's session, with set counts; tap one to jump to it. */
export function ExerciseProgress({ items, current, onSelect }: { items: ProgressItem[]; current: number; onSelect: (i: number) => void }) {
  return (
    <ol className="grid gap-1.5" aria-label="Workout progress">
      {items.map((it, i) => {
        const complete = it.done >= it.planned;
        return (
          <li key={it.id}>
            <button
              type="button"
              onClick={() => onSelect(i)}
              aria-current={i === current ? "step" : undefined}
              className={clsx(
                "press flex min-h-[52px] w-full items-center gap-3 rounded-2xl border px-3.5 text-left text-sm transition-colors",
                i === current ? "border-brand bg-brand/10 font-semibold" : "border-border hover:bg-surface-2",
              )}
            >
              {it.skipped ? <SkipForward className="h-4 w-4 shrink-0 text-muted" aria-hidden /> : complete ? <Check className="h-4 w-4 shrink-0 text-good" aria-hidden /> : <Circle className="h-4 w-4 shrink-0 text-muted" aria-hidden />}
              <span className="min-w-0 flex-1 truncate">{it.name}</span>
              <span className="shrink-0 tabular-nums text-muted">
                {it.skipped ? "Skipped" : `${it.done}/${it.planned} sets`}
                {complete && !it.skipped && <span className="sr-only"> complete</span>}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
