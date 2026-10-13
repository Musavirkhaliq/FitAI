"use client";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge, Sheet } from "@/components/ui";
import { fmtNum, type UnitSystem } from "@/lib/client/format";
import { toDisplay, unitLabel } from "./util";

export interface DoneSet {
  key: string;
  /** Server id; undefined while the save is in flight (or queued offline). */
  id?: string;
  setNumber: number;
  reps: number;
  weightKg: number;
  rpe: number | null;
  pending?: boolean;
  queued?: boolean;
}

/** Sets logged for this exercise. Deleting is a two-step action: the trash button opens a confirm sheet, so a sweaty tap can't remove a set. */
export function SetsDone({ sets, units, onDelete }: { sets: DoneSet[]; units: UnitSystem; onDelete: (s: DoneSet) => void }) {
  const [target, setTarget] = useState<DoneSet | null>(null);
  if (!sets.length) return <p className="rounded-2xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted">No sets logged for this exercise yet. Your first one is the hardest to start.</p>;
  const text = (s: DoneSet) => `${fmtNum(toDisplay(s.weightKg, units), 1)} ${unitLabel(units)} × ${s.reps}`;
  return (
    <>
      <ul className="space-y-2" aria-label="Sets done for this exercise">
        {sets.map((s) => (
          <li key={s.key} className="pop flex min-h-[64px] items-center gap-3 rounded-2xl bg-surface-2 py-1.5 pl-3 pr-1.5">
            <span aria-hidden className="num flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-base ring-1 ring-border">{s.setNumber}</span>
            <p className="min-w-0 flex-1 tabular-nums">
              <span className="sr-only">Set {s.setNumber}: </span>
              <span className="num !text-xl">{text(s)}</span>
              {s.rpe != null && <span className="ml-2 text-sm text-muted">RPE {s.rpe}</span>}
              {s.queued && <Badge tone="warn" className="ml-2">Will sync</Badge>}
              {s.pending && <span className="ml-2 text-xs text-muted">Saving…</span>}
            </p>
            <button type="button" className="btn btn-ghost !min-h-[52px] !min-w-[52px] !px-2 text-muted" disabled={!s.id} onClick={() => setTarget(s)} aria-label={`Delete set ${s.setNumber}`}>
              <Trash2 className="h-5 w-5" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <Sheet open={!!target} onClose={() => setTarget(null)} title={target ? `Delete set ${target.setNumber}?` : "Delete set?"}>
        {target && <p className="text-sm text-muted">{text(target)}{target.rpe != null ? ` at RPE ${target.rpe}` : ""} will be removed from today&apos;s session.</p>}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" className="btn !min-h-[56px]" onClick={() => setTarget(null)}>Keep it</button>
          <button type="button" className="btn !min-h-[56px] !border-bad/40 !bg-bad/10 text-bad" onClick={() => { if (target) onDelete(target); setTarget(null); }}>Delete set</button>
        </div>
      </Sheet>
    </>
  );
}
