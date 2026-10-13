"use client";
import { ChevronDown, Pencil, Trash2 } from "lucide-react";
import { useCallback, useId, useState } from "react";
import { clsx } from "@/components/ui";
import { CONF_LABEL, fmtNum } from "@/lib/client/format";
import type { FoodEntryDto } from "@/lib/client/types";
import type { EntryPatch } from "./dayMath";
import { ConfidenceBadge } from "./mealMeta";
import { ConfirmDeleteSheet, EditEntrySheet } from "./sheets";

const SOURCE_LABEL: Record<string, string> = { VOICE: "by voice", TEXT: "by typing to the coach", MANUAL: "with the manual form", PLAN: "from a meal plan" };

export type { EntryPatch };

interface Props {
  entry: FoodEntryDto;
  onDelete: (id: string) => Promise<void>;
  onEdit: (id: string, patch: EntryPatch) => Promise<void>;
}

/** One logged food: estimate range, confidence, an expandable "why this number", and edit / delete in bottom sheets. */
export function FoodEntryRow({ entry: e, onDelete, onEdit }: Props) {
  const [why, setWhy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const id = useId();

  const closeEdit = useCallback(() => setEditing(false), []);
  const closeConfirm = useCallback(() => setConfirming(false), []);

  const save = async (patch: EntryPatch) => {
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
    setConfirming(false);
    setBusy(true);
    try {
      await onDelete(e.id);
    } finally {
      setBusy(false);
    }
  };

  const hasNotes = e.assumptions.length > 0 || e.uncertaintySources.length > 0;

  return (
    <li className="rounded-2xl bg-surface-2 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words font-semibold leading-snug">
            {e.quantity} {e.unit} {e.food}
            {e.prep ? <span className="font-normal text-muted"> · {e.prep}</span> : null}
          </p>
          <p className="mt-1 text-sm">
            <span className="num !text-[1.05rem]">~{fmtNum(e.calories)}</span> kcal <span className="text-xs text-muted">(est. {fmtNum(e.estimateMin)}–{fmtNum(e.estimateMax)})</span>
          </p>
          <p className="mt-0.5 text-xs text-muted">
            Protein {fmtNum(e.protein, 1)} g · Carbs {fmtNum(e.carbs, 1)} g · Fat {fmtNum(e.fat, 1)} g
          </p>
        </div>
        <ConfidenceBadge confidence={e.confidence} />
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2">
        <button type="button" className="press -ml-2 inline-flex min-h-[48px] items-center gap-1 rounded-xl px-2 text-sm font-medium text-muted hover:text-fg" aria-expanded={why} aria-controls={`${id}-why`} onClick={() => setWhy((v) => !v)}>
          <ChevronDown className={clsx("h-4 w-4 transition-transform duration-300", why && "rotate-180")} aria-hidden /> Why this number
        </button>
        <div className="flex items-center gap-2">
          <button type="button" className="btn !min-h-[48px] !w-12 !rounded-full !border-transparent !bg-surface !px-0 text-muted hover:text-fg" disabled={busy} onClick={() => { setConfirming(false); setEditing(true); }}>
            <Pencil className="h-[18px] w-[18px]" aria-hidden /><span className="sr-only">Edit {e.food}</span>
          </button>
          <button type="button" className="btn !min-h-[48px] !w-12 !rounded-full !border-transparent !bg-surface !px-0 text-muted hover:text-fg" disabled={busy} onClick={() => { setEditing(false); setConfirming(true); }}>
            <Trash2 className="h-[18px] w-[18px]" aria-hidden /><span className="sr-only">Delete {e.food}</span>
          </button>
        </div>
      </div>

      {why && (
        <div id={`${id}-why`} className="rise mt-1 space-y-2.5 rounded-2xl bg-surface p-3.5 text-sm">
          <p>
            About {fmtNum(e.calories)} kcal, most likely between {fmtNum(e.estimateMin)} and {fmtNum(e.estimateMax)}. {CONF_LABEL[e.confidence]}.
            {e.grams ? ` Counted as roughly ${fmtNum(e.grams)} g.` : ""}
          </p>
          {e.assumptions.length > 0 && (
            <div>
              <p className="font-semibold">What I assumed</p>
              <ul className="list-disc pl-5 text-muted">{e.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
            </div>
          )}
          {e.uncertaintySources.length > 0 && (
            <div>
              <p className="font-semibold">What could move the number</p>
              <ul className="list-disc pl-5 text-muted">{e.uncertaintySources.map((a, i) => <li key={i}>{a}</li>)}</ul>
            </div>
          )}
          {!hasNotes && <p className="text-muted">No extra notes were saved for this entry.</p>}
          {e.notes && <p className="text-muted">Note: {e.notes}</p>}
          <p className="text-xs text-muted">Sodium about {fmtNum(e.sodium)} mg · fiber about {fmtNum(e.fiber, 1)} g · logged {SOURCE_LABEL[e.source] ?? "by you"}.</p>
        </div>
      )}

      <EditEntrySheet open={editing} entry={e} onClose={closeEdit} onSave={(p) => void save(p)} />
      <ConfirmDeleteSheet
        open={confirming}
        onClose={closeConfirm}
        onConfirm={() => void remove()}
        busy={busy}
        detail={<>{e.quantity} {e.unit} {e.food} · ~{fmtNum(e.calories)} kcal</>}
        note="You'll have a few seconds to undo."
      />
    </li>
  );
}
