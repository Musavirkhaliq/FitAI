"use client";
import { Trash2 } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Field, Sheet } from "@/components/ui";
import { MEAL_LABEL } from "@/lib/client/format";
import type { FoodEntryDto, MealType } from "@/lib/client/types";
import { MEAL_ORDER, type EntryPatch } from "./dayMath";

/** Sheets render in a portal so no card/animation ancestor can trap them. `onClose` must be stable (Sheet refocuses when it changes). */
function InPortal({ open, children }: { open: boolean; children: ReactNode }) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

/** Delete confirmation as a bottom sheet (thumb-reachable, never window.confirm). */
export function ConfirmDeleteSheet({ open, onClose, onConfirm, title = "Delete this entry?", detail, note, busy }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title?: string; detail: ReactNode; note?: ReactNode; busy?: boolean;
}) {
  return (
    <InPortal open={open}>
      <Sheet open onClose={onClose} title={title}>
        <div role="group" aria-label="Confirm delete">
          <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm font-medium">{detail}</p>
          {note && <p className="mt-2 text-xs text-muted">{note}</p>}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button type="button" className="btn" onClick={onClose}>Keep it</button>
            <button type="button" className="btn !border-bad/30 !bg-bad/15 text-bad hover:!bg-bad/25" onClick={onConfirm} disabled={busy}>
              <Trash2 className="h-4 w-4" aria-hidden /> Delete
            </button>
          </div>
        </div>
      </Sheet>
    </InPortal>
  );
}

function EditForm({ entry: e, onSave, onCancel }: { entry: FoodEntryDto; onSave: (patch: EntryPatch) => void; onCancel: () => void }) {
  const id = useId();
  const [qty, setQty] = useState(String(e.quantity));
  const [meal, setMeal] = useState<MealType>(e.meal);
  const q = Number(qty.replace(",", "."));
  const ok = Number.isFinite(q) && q > 0;

  const submit = () => {
    if (!ok) return;
    const patch: EntryPatch = {};
    if (q !== e.quantity) patch.quantity = q;
    if (meal !== e.meal) patch.meal = meal;
    onSave(patch);
  };

  return (
    <form className="space-y-4" onSubmit={(ev) => { ev.preventDefault(); submit(); }}>
      <p className="text-sm text-muted">{e.food}{e.prep ? ` · ${e.prep}` : ""}</p>
      <Field label={`Quantity (${e.unit})`} htmlFor={`${id}-q`} hint="Nutrients rescale with the quantity.">
        <input id={`${id}-q`} className="input" inputMode="decimal" value={qty} onChange={(ev) => setQty(ev.target.value)} />
      </Field>
      <Field label="Meal" htmlFor={`${id}-m`}>
        <select id={`${id}-m`} className="input" value={meal} onChange={(ev) => setMeal(ev.target.value as MealType)}>
          {MEAL_ORDER.map((m) => <option key={m} value={m}>{MEAL_LABEL[m]}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3 pt-1">
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" disabled={!ok}>Save</button>
      </div>
    </form>
  );
}

export function EditEntrySheet({ open, entry, onClose, onSave }: { open: boolean; entry: FoodEntryDto; onClose: () => void; onSave: (patch: EntryPatch) => void }) {
  return (
    <InPortal open={open}>
      <Sheet open onClose={onClose} title="Edit entry">
        <EditForm entry={entry} onSave={onSave} onCancel={onClose} />
      </Sheet>
    </InPortal>
  );
}
