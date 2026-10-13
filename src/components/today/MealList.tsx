"use client";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge, EmptyState } from "@/components/ui";
import { logTool } from "@/lib/client/api";
import { fmtNum, MEAL_LABEL } from "@/lib/client/format";
import type { DaySummaryDto, FoodEntryDto } from "@/lib/client/types";

const TONE = { HIGH: "good", MEDIUM: "warn", LOW: "bad" } as const;

export function FoodRow({ e, onRemoved }: { e: FoodEntryDto; onRemoved?: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    setBusy(true);
    try {
      onRemoved?.(e.id); // optimistic
      await logTool("delete_entry", { kind: "food", id: e.id });
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="truncate font-medium">{e.quantity} {e.unit} {e.food}{e.prep ? <span className="font-normal text-muted"> · {e.prep}</span> : null}</p>
        <p className="text-sm text-muted">
          ~{fmtNum(e.calories)} kcal <span className="text-xs">(est. {fmtNum(e.estimateMin)}–{fmtNum(e.estimateMax)})</span> · {fmtNum(e.protein)} g protein
        </p>
        {e.assumptions?.[0] && <p className="text-xs text-muted">Assumed: {e.assumptions[0]}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Badge tone={TONE[e.confidence]}>{e.confidence}</Badge>
        <button className="btn btn-ghost !min-h-[36px] !px-2" onClick={remove} disabled={busy} aria-label={`Delete ${e.food}`}>
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </li>
  );
}

/** Meals grouped by type with per-meal totals. Used on Today; the Nutrition page has the full editor. */
export function MealList({ meals, onRemoved }: { meals: DaySummaryDto["meals"]; onRemoved?: (id: string) => void }) {
  const any = meals.some((m) => m.entries.length);
  if (!any) {
    return <EmptyState title="Nothing logged yet" body="Tap the mic and say what you ate, like “two eggs and toast for breakfast”. I'll estimate it and show how sure I am." />;
  }
  return (
    <div className="space-y-4">
      {meals.filter((m) => m.entries.length).map((m) => (
        <section key={m.meal} aria-label={MEAL_LABEL[m.meal]}>
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold">{MEAL_LABEL[m.meal]}</h3>
            <p className="text-sm text-muted">~{fmtNum(m.totals.calories)} kcal · {fmtNum(m.totals.protein)} g protein</p>
          </div>
          <ul className="divide-y divide-border">
            {m.entries.map((e) => <FoodRow key={e.id} e={e} onRemoved={onRemoved} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}
