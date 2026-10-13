"use client";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui";
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

export function SetsDone({ sets, units, onDelete }: { sets: DoneSet[]; units: UnitSystem; onDelete: (s: DoneSet) => void }) {
  if (!sets.length) return <p className="text-sm text-muted">No sets logged for this exercise yet.</p>;
  return (
    <ul className="divide-y divide-border" aria-label="Sets done for this exercise">
      {sets.map((s) => (
        <li key={s.key} className="flex min-h-[52px] items-center justify-between gap-2 py-1.5">
          <p className="tabular-nums">
            <span className="mr-2 text-sm text-muted">Set {s.setNumber}</span>
            <span className="font-semibold">{fmtNum(toDisplay(s.weightKg, units), 1)} {unitLabel(units)} × {s.reps}</span>
            {s.rpe != null && <span className="ml-2 text-sm text-muted">RPE {s.rpe}</span>}
            {s.queued && <Badge tone="warn" className="ml-2">Will sync</Badge>}
          </p>
          <button className="btn btn-ghost !min-w-[44px] !px-2" disabled={!s.id} onClick={() => onDelete(s)} aria-label={`Delete set ${s.setNumber}`}>
            <Trash2 className="h-5 w-5" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}
