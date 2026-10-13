"use client";
import { Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { EmptyState } from "@/components/ui";
import { ConfidenceBadge, MealAvatar } from "@/components/nutrition/mealMeta";
import { ConfirmDeleteSheet } from "@/components/nutrition/sheets";
import { logTool } from "@/lib/client/api";
import { fmtNum, MEAL_LABEL } from "@/lib/client/format";
import type { DaySummaryDto, FoodEntryDto } from "@/lib/client/types";

export function FoodRow({ e, onRemoved }: { e: FoodEntryDto; onRemoved?: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const closeConfirm = useCallback(() => setConfirming(false), []);

  const remove = async () => {
    setConfirming(false);
    setBusy(true);
    try {
      onRemoved?.(e.id); // optimistic
      await logTool("delete_entry", { kind: "food", id: e.id });
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex items-center gap-2 rounded-2xl bg-surface-2 py-2 pl-3.5 pr-2">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{e.quantity} {e.unit} {e.food}{e.prep ? <span className="font-normal text-muted"> · {e.prep}</span> : null}</p>
        <p className="text-sm text-muted">
          ~{fmtNum(e.calories)} kcal <span className="text-xs">(est. {fmtNum(e.estimateMin)}–{fmtNum(e.estimateMax)})</span> · {fmtNum(e.protein)} g protein
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <ConfidenceBadge confidence={e.confidence} />
          {e.assumptions?.[0] && <p className="min-w-0 truncate text-xs text-muted">Assumed: {e.assumptions[0]}</p>}
        </div>
      </div>
      <button type="button" className="btn !w-12 !shrink-0 !rounded-full !border-transparent !bg-transparent !px-0 text-muted hover:!bg-surface hover:text-fg" onClick={() => setConfirming(true)} disabled={busy} aria-label={`Delete ${e.food}`}>
        <Trash2 className="h-[18px] w-[18px]" aria-hidden />
      </button>
      <ConfirmDeleteSheet
        open={confirming}
        onClose={closeConfirm}
        onConfirm={() => void remove()}
        busy={busy}
        detail={<>{e.quantity} {e.unit} {e.food} · ~{fmtNum(e.calories)} kcal</>}
      />
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
    <div className="space-y-5">
      {meals.filter((m) => m.entries.length).map((m, i) => (
        <section key={m.meal} aria-label={MEAL_LABEL[m.meal]} className="rise" style={{ ["--i" as string]: i }}>
          <div className="mb-2 flex items-center gap-3">
            <MealAvatar meal={m.meal} size={36} />
            <div className="min-w-0 flex-1">
              <h3 className="display text-[0.95rem] font-extrabold leading-tight">{MEAL_LABEL[m.meal]}</h3>
              <p className="text-xs text-muted">~{fmtNum(m.totals.calories)} kcal · {fmtNum(m.totals.protein)} g protein</p>
            </div>
          </div>
          <ul className="space-y-2">
            {m.entries.map((e) => <FoodRow key={e.id} e={e} onRemoved={onRemoved} />)}
          </ul>
        </section>
      ))}
    </div>
  );
}
