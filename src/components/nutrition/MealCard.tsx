"use client";
import { Plus } from "lucide-react";
import { clsx } from "@/components/ui";
import { fmtNum, MEAL_LABEL } from "@/lib/client/format";
import type { DaySummaryDto, MealType } from "@/lib/client/types";
import { FoodEntryRow, type EntryPatch } from "./FoodEntryRow";
import { MealAvatar } from "./mealMeta";

type Meal = DaySummaryDto["meals"][number];

/** One meal as a rounded card: icon avatar, estimated totals, entry rows, and a thumb-sized add button. Empty meals stay slim. */
export function MealCard({ m, index, onAdd, onDelete, onEdit }: {
  m: Meal; index: number; onAdd: (meal: MealType) => void;
  onDelete: (id: string) => Promise<void>; onEdit: (id: string, patch: EntryPatch) => Promise<void>;
}) {
  const label = MEAL_LABEL[m.meal];
  const has = m.entries.length > 0;
  return (
    <section className={clsx("tile rise", !has && "!py-3")} style={{ ["--i" as string]: index }} aria-label={label}>
      <div className="flex items-center gap-3">
        <MealAvatar meal={m.meal} size={has ? 44 : 40} />
        <div className="min-w-0 flex-1">
          <h2 className="display text-base font-extrabold leading-tight">{label}</h2>
          {has ? (
            <p className="mt-0.5 text-xs text-muted">
              ~{fmtNum(m.totals.calories)} kcal <span>(est. {fmtNum(m.totals.minKcal)}–{fmtNum(m.totals.maxKcal)})</span> · {fmtNum(m.totals.protein)} g protein
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-muted">Nothing logged for {label.toLowerCase()}.</p>
          )}
        </div>
        <button type="button" className="btn !rounded-full !px-4 text-brand" aria-label={`Add to ${label.toLowerCase()}`} onClick={() => onAdd(m.meal)}>
          <Plus className="h-[18px] w-[18px]" aria-hidden /> Add
        </button>
      </div>
      {has && (
        <ul className="mt-3 space-y-2">
          {m.entries.map((e) => <FoodEntryRow key={e.id} entry={e} onDelete={onDelete} onEdit={onEdit} />)}
        </ul>
      )}
    </section>
  );
}
