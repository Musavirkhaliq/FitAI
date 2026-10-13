"use client";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { Badge, clsx, Field } from "@/components/ui";
import { CONF_LABEL, fmtNum, MEAL_LABEL } from "@/lib/client/format";
import type { FoodEntryDto, MealType } from "@/lib/client/types";
import { MEAL_ORDER } from "./dayMath";

const TONE = { HIGH: "good", MEDIUM: "warn", LOW: "bad" } as const;
const SOURCE_LABEL: Record<string, string> = { VOICE: "by voice", TEXT: "by typing to the coach", MANUAL: "with the manual form", PLAN: "from a meal plan" };

export interface EntryPatch { quantity?: number; meal?: MealType }

interface Props {
  entry: FoodEntryDto;
  onDelete: (id: string) => Promise<void>;
  onEdit: (id: string, patch: EntryPatch) => Promise<void>;
}

/** One logged food with its estimate range, an expandable "why this number", and inline edit / delete. */
export function FoodEntryRow({ entry: e, onDelete, onEdit }: Props) {
  const [why, setWhy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [qty, setQty] = useState(String(e.quantity));
  const [meal, setMeal] = useState<MealType>(e.meal);
  const [busy, setBusy] = useState(false);
  const id = useId();

  const save = async () => {
    const q = Number(qty.replace(",", "."));
    if (!Number.isFinite(q) || q <= 0) return;
    const patch: EntryPatch = {};
    if (q !== e.quantity) patch.quantity = q;
    if (meal !== e.meal) patch.meal = meal;
    setEditing(false);
    if (!Object.keys(patch).length) return;
    setBusy(true);
    try {
      await onEdit(e.id, patch);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await onDelete(e.id);
    } finally {
      setBusy(false);
    }
  };

  const hasNotes = e.assumptions.length > 0 || e.uncertaintySources.length > 0;

  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words font-medium">
            {e.quantity} {e.unit} {e.food}
            {e.prep ? <span className="font-normal text-muted"> · {e.prep}</span> : null}
          </p>
          <p className="text-sm text-muted">
            ~{fmtNum(e.calories)} kcal <span className="text-xs">(est. {fmtNum(e.estimateMin)}–{fmtNum(e.estimateMax)})</span>
          </p>
          <p className="text-xs text-muted">
            Protein {fmtNum(e.protein, 1)} g · Carbs {fmtNum(e.carbs, 1)} g · Fat {fmtNum(e.fat, 1)} g
          </p>
        </div>
        <Badge tone={TONE[e.confidence]} className="shrink-0">{CONF_LABEL[e.confidence]}</Badge>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-1">
        <button className="btn btn-ghost !min-h-[44px] !px-2 text-muted" aria-expanded={why} aria-controls={`${id}-why`} onClick={() => setWhy((v) => !v)}>
          <ChevronDown className={clsx("h-4 w-4 transition-transform", why && "rotate-180")} aria-hidden /> Why this number
        </button>
        <button className="btn btn-ghost !min-h-[44px] !px-2 text-muted" aria-expanded={editing} aria-controls={`${id}-edit`} disabled={busy}
          onClick={() => { setQty(String(e.quantity)); setMeal(e.meal); setEditing((v) => !v); setConfirming(false); }}>
          <Pencil className="h-4 w-4" aria-hidden /> Edit<span className="sr-only"> {e.food}</span>
        </button>
        {confirming ? (
          <span className="inline-flex items-center gap-1" role="group" aria-label={`Confirm deleting ${e.food}`}>
            <span className="text-sm">Delete this entry?</span>
            <button className="btn !min-h-[44px] !px-3" onClick={() => void remove()} disabled={busy}>Yes, delete</button>
            <button className="btn btn-ghost !min-h-[44px] !px-3" onClick={() => setConfirming(false)}>Keep</button>
          </span>
        ) : (
          <button className="btn btn-ghost !min-h-[44px] !px-2 text-muted" onClick={() => { setConfirming(true); setEditing(false); }} disabled={busy}>
            <Trash2 className="h-4 w-4" aria-hidden /> Delete<span className="sr-only"> {e.food}</span>
          </button>
        )}
      </div>

      {editing && (
        <form id={`${id}-edit`} className="mt-2 grid gap-3 rounded-xl bg-surface-2 p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={(ev) => { ev.preventDefault(); void save(); }}>
          <Field label={`Quantity (${e.unit})`} htmlFor={`${id}-q`} hint="Nutrients rescale with the quantity.">
            <input id={`${id}-q`} className="input" inputMode="decimal" value={qty} onChange={(ev) => setQty(ev.target.value)} />
          </Field>
          <Field label="Meal" htmlFor={`${id}-m`}>
            <select id={`${id}-m`} className="input" value={meal} onChange={(ev) => setMeal(ev.target.value as MealType)}>
              {MEAL_ORDER.map((m) => <option key={m} value={m}>{MEAL_LABEL[m]}</option>)}
            </select>
          </Field>
          <div className="flex gap-2">
            <button className="btn btn-primary">Save</button>
            <button type="button" className="btn" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      )}

      {why && (
        <div id={`${id}-why`} className="mt-2 space-y-2 rounded-xl bg-surface-2 p-3 text-sm">
          <p>
            About {fmtNum(e.calories)} kcal, most likely between {fmtNum(e.estimateMin)} and {fmtNum(e.estimateMax)}. {CONF_LABEL[e.confidence]}.
            {e.grams ? ` Counted as roughly ${fmtNum(e.grams)} g.` : ""}
          </p>
          {e.assumptions.length > 0 && (
            <div>
              <p className="font-medium">What I assumed</p>
              <ul className="list-disc pl-5 text-muted">{e.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
            </div>
          )}
          {e.uncertaintySources.length > 0 && (
            <div>
              <p className="font-medium">What could move the number</p>
              <ul className="list-disc pl-5 text-muted">{e.uncertaintySources.map((a, i) => <li key={i}>{a}</li>)}</ul>
            </div>
          )}
          {!hasNotes && <p className="text-muted">No extra notes were saved for this entry.</p>}
          {e.notes && <p className="text-muted">Note: {e.notes}</p>}
          <p className="text-xs text-muted">Sodium about {fmtNum(e.sodium)} mg · fiber about {fmtNum(e.fiber, 1)} g · logged {SOURCE_LABEL[e.source] ?? "by you"}.</p>
        </div>
      )}
    </li>
  );
}
