"use client";
import { AlertTriangle, CalendarDays, CalendarHeart, SlidersHorizontal, Utensils } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { AnimatedNumber, Field, RingCluster, Sheet, Spinner, colorVar, haptic, type RingColor } from "@/components/ui";
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
  /** The target weight as the person typed it ("72 kg"), used in the projected-date line. */
  targetLabel?: string | null;
}

const step = (i: number): CSSProperties => ({ ["--i" as string]: i });

function Eyebrow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return <p className="eyebrow flex items-center gap-1.5"><span aria-hidden>{icon}</span>{children}</p>;
}

/**
 * The money moment: a calm reveal of the personal plan. Rings draw in, the calorie number counts up, and one soft glow
 * sits behind the hero. Everything is an estimate and says so; safety notes and calorie-floor warnings are shown verbatim.
 */
export function PlanPreview({ preview, sex, goal, units, recalculating, recalcError, onRecalc, targetLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [cal, setCal] = useState(String(preview.calories));
  const [protein, setProtein] = useState(String(preview.proteinG));
  const [steps, setSteps] = useState(String(preview.steps));
  const [fieldError, setFieldError] = useState<string | null>(null);
  const closeAfter = useRef(false);

  // The server may clamp what was typed (calorie floor), so show what it actually returned.
  useEffect(() => {
    setCal(String(preview.calories));
    setProtein(String(preview.proteinG));
    setSteps(String(preview.steps));
  }, [preview.calories, preview.proteinG, preview.steps]);

  // One quiet success tick when the plan lands.
  useEffect(() => { haptic("success"); }, []);

  // After "Recheck", close the sheet once the new numbers are in, unless the check failed.
  useEffect(() => {
    if (recalculating || !closeAfter.current) return;
    closeAfter.current = false;
    if (!recalcError) setOpen(false);
  }, [recalculating, recalcError]);

  const close = useCallback(() => { setOpen(false); setFieldError(null); }, []);

  const floor = calorieFloorFor(sex);
  const belowFloor = preview.calories < floor;
  const rate = Math.abs(preview.weeklyRateKg);
  const paced = rate > 0 && goal !== "MAINTAIN" && goal !== "STRENGTH";
  const weeks = preview.weeksToGoal != null && preview.weeksToGoal > 0 ? preview.weeksToGoal : null;
  const eta = paced && weeks != null ? new Date(Date.now() + weeks * 7 * 86_400_000).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : null;

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    const c = parseNum(cal), p = parseNum(protein), s = parseNum(steps);
    if (c == null || !Number.isInteger(c) || c < 500 || c > 8000) return setFieldError("Calories should be a whole number from 500 to 8,000. Anything under the safe floor will be raised to it.");
    if (p == null || !Number.isInteger(p) || p < 20 || p > 500) return setFieldError("Protein should be a whole number of grams from 20 to 500.");
    if (s == null || !Number.isInteger(s) || s < 1000 || s > 50000) return setFieldError("Steps should be a whole number from 1,000 to 50,000.");
    setFieldError(null);
    closeAfter.current = true;
    onRecalc({ calories: c, proteinG: p, steps: s });
  };

  const rings: { ratio: number; color: RingColor }[] = [
    { ratio: 1, color: "cal" }, { ratio: 1, color: "protein" }, { ratio: 1, color: "steps" },
  ];
  const mini: { label: string; color: RingColor; value: number; unit: string; note: string }[] = [
    { label: "Protein", color: "protein", value: preview.proteinG, unit: "g", note: "estimate" },
    { label: "Steps", color: "steps", value: preview.steps, unit: "", note: "starting point" },
    { label: "Fibre", color: "fiber", value: preview.fiberG, unit: "g", note: "estimate" },
  ];

  return (
    <>
    <div className="relative isolate space-y-3">
      <p className="rise text-sm text-muted" style={step(0)}>Every number below is a starting estimate, not medical advice. {preview.note}</p>

      {(preview.warnings.length > 0 || belowFloor) && (
        <div role="alert" className="rise space-y-1.5 rounded-2xl border border-warn/40 bg-warn/10 p-3.5 text-sm" style={step(0)}>
          {preview.warnings.map((w) => (
            <p key={w} className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden />{w}</p>
          ))}
          {belowFloor && (
            <p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden />{fmtNum(preview.calories)} kcal is below the {fmtNum(floor)} kcal minimum I&apos;ll suggest without medical supervision.</p>
          )}
        </div>
      )}

      {/* Hero: rings + the one big number */}
      <section
        aria-label="Your daily targets"
        className="tile rise !p-5"
        style={{ ...step(1), borderColor: "rgb(var(--brand-a) / 0.35)", background: "linear-gradient(150deg, rgb(var(--brand-a) / 0.14), rgb(var(--brand-b) / 0.05) 60%), rgb(var(--surface))", boxShadow: "var(--shadow-tile), 0 0 56px -14px rgb(var(--brand-a) / 0.45)" }}
      >
        <div className="flex items-center gap-4">
          <RingCluster
            size={136} stroke={12} gap={4} rings={rings}
            summary={`Daily targets: ${fmtNum(preview.calories)} kilocalories, ${fmtNum(preview.proteinG)} grams of protein, ${fmtNum(preview.steps)} steps.`}
          />
          <div className="min-w-0 flex-1">
            <p className="eyebrow flex items-center gap-1.5"><span aria-hidden className="h-2 w-2 rounded-full" style={{ background: colorVar("cal") }} />Daily calories (estimate)</p>
            <p className="num mt-1.5 text-[3rem] leading-none"><AnimatedNumber value={preview.calories} fromZero duration={900} /></p>
            <p className="mt-1 text-xs text-muted">kcal a day</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">Your maintenance is roughly {fmtNum(preview.tdee)} kcal. Safe minimum for you: {fmtNum(floor)} kcal.</p>

        <ul className="mt-3 grid grid-cols-3 gap-2">
          {mini.map((m) => (
            <li key={m.label} className="rounded-2xl bg-surface-2 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted"><span aria-hidden className="h-2 w-2 rounded-full" style={{ background: colorVar(m.color) }} />{m.label}</p>
              <p className="num mt-1 text-lg"><AnimatedNumber value={m.value} fromZero duration={900} />{m.unit && <span className="ml-0.5 text-xs font-medium text-muted">{m.unit}</span>}</p>
              <p className="text-[11px] text-muted">{m.note}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">Plus about {fmtNum(preview.fiberG)} g of fibre. Build your steps up gradually if this is more than you do now.</p>
      </section>

      {/* Projected date: warm, honest, an estimate */}
      {paced && (
        <section className="tile rise" style={step(2)} aria-label={preview.weeklyRateKg > 0 ? "Weight-loss pace (estimate)" : "Weight-gain pace (estimate)"}>
          <Eyebrow icon={<CalendarHeart className="h-3.5 w-3.5" />}>{preview.weeklyRateKg > 0 ? "Weight-loss pace (estimate)" : "Weight-gain pace (estimate)"}</Eyebrow>
          {eta && (
            <p className="display mt-2 text-xl font-extrabold leading-snug">
              If it goes to plan, you could reach {targetLabel ? <>{targetLabel} </> : "your target "}around <span className="text-grad">{eta}</span>.
            </p>
          )}
          <p className="mt-2 text-sm">
            About <span className="font-semibold tabular-nums">{fmtWeight(rate, units, 2)}</span> per week
            {weeks != null && <>, so roughly <span className="font-semibold tabular-nums">{fmtNum(weeks)} weeks</span> to your target if it goes to plan</>}.
          </p>
          <p className="mt-1 text-xs text-muted">That&apos;s an estimate. Real progress is bumpy. I&apos;ll only adjust after about 14 days of data.</p>
        </section>
      )}

      {/* Weekly schedule as chips */}
      <section className="tile rise" style={step(3)} aria-label="Training schedule">
        <Eyebrow icon={<CalendarDays className="h-3.5 w-3.5" />}>Training schedule</Eyebrow>
        {preview.schedule.length ? (
          <ol className="mt-3 flex flex-wrap gap-2">
            {preview.schedule.map((d, i) => (
              <li key={`${d.name}-${i}`} className="inline-flex min-h-[40px] flex-wrap items-center gap-x-1.5 rounded-full border border-border bg-surface-2 px-3.5 py-1.5 text-sm">
                <span className="font-semibold">{d.name}</span><span className="text-muted">{d.focus}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-muted">No schedule yet.</p>
        )}
      </section>

      <section className="tile rise" style={step(4)} aria-label="Meal structure">
        <Eyebrow icon={<Utensils className="h-3.5 w-3.5" />}>Meal structure</Eyebrow>
        <p className="mt-2 text-sm leading-relaxed">{preview.mealStructure}</p>
      </section>

      {/* Editable targets live in a sheet */}
      <div className="rise" style={step(5)}>
        <button type="button" className="btn w-full !justify-between !px-4 text-left" onClick={() => setOpen(true)} aria-haspopup="dialog">
          <span className="flex items-center gap-2.5"><SlidersHorizontal className="h-4 w-4 text-brand" aria-hidden /> Adjust my numbers</span>
          <span className="text-xs font-medium text-muted">Your call</span>
        </button>
      </div>

      {/* One calm glow behind the hero. Decorative. */}
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-4 -z-10 h-64 w-72 -translate-x-1/2 rounded-full bg-brand-a/25 blur-3xl motion-safe:animate-breathe" />
    </div>

      <Sheet open={open} onClose={close} title="Adjust your targets">
        <form onSubmit={apply} className="space-y-4">
          <p className="text-sm text-muted">Want to adjust? It&apos;s your call. Change a number and I&apos;ll recheck it. Calories are never allowed below {fmtNum(floor)} kcal.</p>
          <Field label="Calories (kcal)" htmlFor="ov-cal"><input id="ov-cal" className="input" inputMode="numeric" value={cal} onChange={(e) => setCal(e.target.value)} /></Field>
          <Field label="Protein (g)" htmlFor="ov-pro"><input id="ov-pro" className="input" inputMode="numeric" value={protein} onChange={(e) => setProtein(e.target.value)} /></Field>
          <Field label="Steps" htmlFor="ov-steps"><input id="ov-steps" className="input" inputMode="numeric" value={steps} onChange={(e) => setSteps(e.target.value)} /></Field>
          {(fieldError || recalcError) && <p role="alert" className="rounded-2xl border border-bad/30 bg-bad/10 px-3.5 py-2.5 text-sm">{fieldError ?? recalcError}</p>}
          <button className="btn btn-primary w-full !min-h-[52px] !text-base" disabled={recalculating}>{recalculating ? <Spinner label="Rechecking" /> : "Recheck my numbers"}</button>
        </form>
      </Sheet>
    </>
  );
}
