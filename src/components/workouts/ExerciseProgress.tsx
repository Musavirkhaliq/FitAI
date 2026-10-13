"use client";
import { Check, Circle, SkipForward } from "lucide-react";
import { clsx } from "@/components/ui";

export interface ProgressItem { id: string; name: string; done: number; planned: number; skipped: boolean }

/** Compact list of every exercise in today's session; tap one to jump to it. */
export function ExerciseProgress({ items, current, onSelect }: { items: ProgressItem[]; current: number; onSelect: (i: number) => void }) {
  return (
    <ol className="grid gap-1.5" aria-label="Workout progress">
      {items.map((it, i) => {
        const complete = it.done >= it.planned;
        return (
          <li key={it.id}>
            <button
              onClick={() => onSelect(i)}
              aria-current={i === current ? "step" : undefined}
              className={clsx(
                "flex min-h-[44px] w-full items-center gap-3 rounded-xl border px-3 text-left text-sm transition-colors",
                i === current ? "border-brand bg-brand/10 font-medium" : "border-border hover:bg-surface-2",
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
