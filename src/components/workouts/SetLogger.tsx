"use client";
import { Check } from "lucide-react";
import { useState } from "react";
import type { UnitSystem } from "@/lib/client/format";
import { Stepper } from "./Stepper";
import { fromDisplay, stepFor, unitLabel } from "./util";

export interface LoggerDefaults { weight: string; reps: string; rpe: number }
export interface LoggedValues { weightKg: number; reps: number; rpe: number }

const num = (s: string) => Number(s.trim().replace(",", "."));
const tidy = (n: number) => String(Math.round(n * 100) / 100);
const rirText = (rpe: number) => {
  const rir = Math.max(0, 10 - rpe);
  return rir === 0 ? "≈ 0 reps in reserve (all-out)" : `≈ ${rir} ${rir === 1 ? "rep" : "reps"} in reserve`;
};

/**
 * Weight / reps / RPE steppers and the big Log button. Edits are keyed by `inputKey` (exercise + sets done), so the fields
 * snap back to fresh defaults after every logged set without an effect.
 */
export function SetLogger({
  inputKey, defaults, units, label, disabled, onLog,
}: { inputKey: string; defaults: LoggerDefaults; units: UnitSystem; label: string; disabled?: boolean; onLog: (v: LoggedValues) => void }) {
  const [edit, setEdit] = useState<{ key: string; weight?: string; reps?: string; rpe?: number }>({ key: inputKey });
  const cur = edit.key === inputKey ? edit : { key: inputKey };
  const weight = cur.weight ?? defaults.weight;
  const reps = cur.reps ?? defaults.reps;
  const rpe = cur.rpe ?? defaults.rpe;
  const patch = (p: { weight?: string; reps?: string; rpe?: number }) => setEdit({ ...cur, ...p, key: inputKey });

  const w = num(weight);
  const r = num(reps);
  const weightOk = weight.trim() !== "" && Number.isFinite(w) && w >= 0 && fromDisplay(w, units) <= 1000;
  const repsOk = reps.trim() !== "" && Number.isInteger(r) && r >= 1 && r <= 100;
  const valid = weightOk && repsOk;

  const stepWeight = (dir: 1 | -1) => patch({ weight: tidy(Math.max(0, (Number.isFinite(w) ? w : 0) + dir * stepFor(units))) });
  const stepReps = (dir: 1 | -1) => patch({ reps: String(Math.min(100, Math.max(1, (Number.isInteger(r) ? r : 0) + dir))) });
  const stepRpe = (dir: 1 | -1) => patch({ rpe: Math.min(10, Math.max(6, rpe + dir * 0.5)) });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (valid) onLog({ weightKg: fromDisplay(w, units), reps: r, rpe });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stepper label="Weight" unit={unitLabel(units)} value={weight} onChange={(v) => patch({ weight: v })} onStep={stepWeight} />
        <Stepper label="Reps" value={reps} inputMode="numeric" onChange={(v) => patch({ reps: v })} onStep={stepReps} />
        <Stepper label="RPE (effort)" value={String(rpe)} readOnly onStep={stepRpe} hint={rirText(rpe)} />
      </div>
      {!valid && <p role="status" className="text-center text-sm text-warn">Enter a weight (0 for bodyweight) and a whole number of reps to log this set.</p>}
      <button type="submit" disabled={!valid || disabled} className="btn btn-primary !min-h-[64px] w-full !rounded-2xl text-lg">
        <Check className="h-6 w-6" aria-hidden /> {label}
      </button>
    </form>
  );
}
