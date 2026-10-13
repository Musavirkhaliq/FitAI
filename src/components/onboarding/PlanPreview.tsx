"use client";
import { AlertTriangle, CalendarDays, Flame, Footprints, Target, Utensils } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Field, Spinner } from "@/components/ui";
import { fmtNum, fmtWeight, type UnitSystem } from "@/lib/client/format";
import type { GoalType } from "@/lib/client/types";
import { calorieFloorFor, parseNum, type Overrides, type PreviewDto, type Sex } from "./model";

interface Props {
  preview: PreviewDto;
  sex: Sex | null;
  goal: GoalType | null;
  units: UnitSystem;
  recalculating: boolean;
  recalcError: string | null;
  onRecalc: (o: Required<Overrides>) => void;
}

function Stat({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2/60 p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted"><span aria-hidden>{icon}</span>{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export function PlanPreview({ preview, sex, goal, units, recalculating, recalcError, onRecalc }: Props) {
  const [cal, setCal] = useState(String(preview.calories));
  const [protein, setProtein] = useState(String(preview.proteinG));
  const [steps, setSteps] = useState(String(preview.steps));
  const [fieldError, setFieldError] = useState<string | null>(null);

  // The server may clamp what was typed (calorie floor), so show what it actually returned.
  useEffect(() => {
    setCal(String(preview.calories));
    setProtein(String(preview.proteinG));
    setSteps(String(preview.steps));
  }, [preview.calories, preview.proteinG, preview.steps]);

  const floor = calorieFloorFor(sex);
  const belowFloor = preview.calories < floor;
  const rate = Math.abs(preview.weeklyRateKg);

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    const c = parseNum(cal), p = parseNum(protein), s = parseNum(steps);
    if (c == null || !Number.isInteger(c) || c < 500 || c > 8000) return setFieldError("Calories should be a whole number from 500 to 8,000. Anything under the safe floor will be raised to it.");
    if (p == null || !Number.isInteger(p) || p < 20 || p > 500) return setFieldError("Protein should be a whole number of grams from 20 to 500.");
    if (s == null || !Number.isInteger(s) || s < 1000 || s > 50000) return setFieldError("Steps should be a whole number from 1,000 to 50,000.");
    setFieldError(null);
    onRecalc({ calories: c, proteinG: p, steps: s });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Every number below is a starting estimate, not medical advice. {preview.note}</p>

      {(preview.warnings.length > 0 || belowFloor) && (
        <div role="alert" className="space-y-1 rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm">
          {preview.warnings.map((w) => (
            <p key={w} className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden />{w}</p>
          ))}
          {belowFloor && (
            <p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden />{fmtNum(preview.calories)} kcal is below the {fmtNum(floor)} kcal minimum I&apos;ll suggest without medical supervision.</p>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Stat icon={<Flame className="h-4 w-4" />} label="Daily calories (estimate)">
          <p className="text-2xl font-semibold tabular-nums">{fmtNum(preview.calories)} <span className="text-sm font-normal text-muted">kcal</span></p>
          <p className="text-xs text-muted">Your maintenance is roughly {fmtNum(preview.tdee)} kcal. Safe minimum for you: {fmtNum(floor)} kcal.</p>
        </Stat>
        <Stat icon={<Target className="h-4 w-4" />} label="Daily protein (estimate)">
          <p className="text-2xl font-semibold tabular-nums">{fmtNum(preview.proteinG)} <span className="text-sm font-normal text-muted">g</span></p>
          <p className="text-xs text-muted">Plus about {fmtNum(preview.fiberG)} g of fibre.</p>
        </Stat>
        <Stat icon={<Footprints className="h-4 w-4" />} label="Daily steps (starting point)">
          <p className="text-2xl font-semibold tabular-nums">{fmtNum(preview.steps)}</p>
          <p className="text-xs text-muted">Build up gradually if this is more than you do now.</p>
        </Stat>
        <Stat icon={<Utensils className="h-4 w-4" />} label="Meal structure">
          <p className="text-sm">{preview.mealStructure}</p>
        </Stat>
      </div>

      {rate > 0 && goal !== "MAINTAIN" && goal !== "STRENGTH" && (
        <Stat icon={<Target className="h-4 w-4" />} label={preview.weeklyRateKg > 0 ? "Weight-loss pace (estimate)" : "Weight-gain pace (estimate)"}>
          <p>
            About <span className="font-semibold tabular-nums">{fmtWeight(rate, units, 2)}</span> per week
            {preview.weeksToGoal != null && preview.weeksToGoal > 0 && <>, so roughly <span className="font-semibold tabular-nums">{fmtNum(preview.weeksToGoal)} weeks</span> to your target if it goes to plan</>}.
          </p>
          <p className="text-xs text-muted">Real progress is bumpy. I&apos;ll only adjust after about 14 days of data.</p>
        </Stat>
      )}

      <Stat icon={<CalendarDays className="h-4 w-4" />} label="Training schedule">
        {preview.schedule.length ? (
          <ol className="mt-1 space-y-1 text-sm">
            {preview.schedule.map((d, i) => (
              <li key={`${d.name}-${i}`} className="flex flex-wrap gap-x-2"><span className="font-medium">{d.name}</span><span className="text-muted">{d.focus}</span></li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted">No schedule yet.</p>
        )}
      </Stat>

      <form onSubmit={apply} className="rounded-xl border border-border p-3" aria-labelledby="edit-h">
        <h3 id="edit-h" className="text-sm font-semibold">Want to adjust? It&apos;s your call.</h3>
        <p className="mb-3 text-xs text-muted">Change a number and I&apos;ll recheck it. Calories are never allowed below {fmtNum(floor)} kcal.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Calories (kcal)" htmlFor="ov-cal"><input id="ov-cal" className="input" inputMode="numeric" value={cal} onChange={(e) => setCal(e.target.value)} /></Field>
          <Field label="Protein (g)" htmlFor="ov-pro"><input id="ov-pro" className="input" inputMode="numeric" value={protein} onChange={(e) => setProtein(e.target.value)} /></Field>
          <Field label="Steps" htmlFor="ov-steps"><input id="ov-steps" className="input" inputMode="numeric" value={steps} onChange={(e) => setSteps(e.target.value)} /></Field>
        </div>
        {(fieldError || recalcError) && <p role="alert" className="mt-2 text-sm text-bad">{fieldError ?? recalcError}</p>}
        <button className="btn mt-3" disabled={recalculating}>{recalculating ? <Spinner label="Rechecking" /> : "Recheck my numbers"}</button>
      </form>
    </div>
  );
}
