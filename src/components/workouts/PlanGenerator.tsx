"use client";
import { Sparkles } from "lucide-react";
import { useId, useState } from "react";
import { ErrorState, Field, Notice, Segmented, Sheet, Spinner } from "@/components/ui";
import { post } from "@/lib/client/api";
import type { Equipment, Experience, PlanGoal, WorkoutsDto } from "./types";

const GOALS: { value: PlanGoal; label: string }[] = [
  { value: "MUSCLE_GAIN", label: "Build muscle" },
  { value: "FAT_LOSS", label: "Lose fat (keep muscle)" },
  { value: "STRENGTH", label: "Get stronger" },
  { value: "RECOMP", label: "Body recomposition" },
  { value: "MAINTAIN", label: "Maintain" },
];
const EQUIPMENT: { value: Equipment; label: string }[] = [
  { value: "FULL_GYM", label: "Full gym" },
  { value: "DUMBBELLS", label: "Dumbbells" },
  { value: "HOME", label: "Home (bands, basic kit)" },
  { value: "BODYWEIGHT", label: "Bodyweight only" },
];
const EXPERIENCE: { value: Experience; label: string }[] = [
  { value: "BEGINNER", label: "Beginner" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "ADVANCED", label: "Advanced" },
];
const DAYS = [2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: String(n) }));

interface Form { goal: PlanGoal; experience: Experience; days: number; minutes: number; equipment: Equipment; injuries: string }

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Asks only what the generator needs; defaults come from the profile, and edits override them. */
export function PlanGenerator({ profile, goal, hasPlan, onDone }: { profile: WorkoutsDto["profile"]; goal: PlanGoal | null; hasPlan: boolean; onDone: () => void }) {
  const [open, setOpen] = useState(!hasPlan);
  const [edits, setEdits] = useState<Partial<Form>>({});
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const id = useId();

  const f: Form = {
    goal: goal ?? "MUSCLE_GAIN",
    experience: profile.experience,
    days: clamp(profile.trainDaysPerWeek, 2, 6),
    minutes: clamp(Math.round(profile.sessionMinutes / 5) * 5, 30, 120),
    equipment: profile.equipment,
    injuries: profile.injuries ?? "",
    ...edits,
  };
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setEdits((e) => ({ ...e, [k]: v }));

  const generate = async () => {
    setConfirm(false);
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      await post("/api/workouts", {
        action: "generate", goal: f.goal, experience: f.experience, daysPerWeek: f.days, sessionMinutes: f.minutes, equipment: f.equipment,
        injuries: f.injuries.trim() || null,
      });
      setDone(true);
      setOpen(false);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (hasPlan) setConfirm(true);
    else void generate();
  };

  return (
    <section className="card space-y-3" aria-labelledby={`${id}-h`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id={`${id}-h`} className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-brand" aria-hidden /> {hasPlan ? "Make a new plan" : "Create your plan"}</h2>
          <p className="text-sm text-muted">Five quick questions. You can always swap exercises afterwards.</p>
        </div>
        {hasPlan && !open && <button className="btn" onClick={() => { setOpen(true); setDone(false); }} aria-expanded={false}>New plan</button>}
      </div>

      {done && <Notice tone="good">Your new plan is ready. It&apos;s now your active plan.</Notice>}

      {open && (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Main goal" htmlFor={`${id}-goal`}>
            <select id={`${id}-goal`} className="input" value={f.goal} onChange={(e) => set("goal", e.target.value as PlanGoal)}>
              {GOALS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </Field>

          <div>
            <p className="label">Experience</p>
            <Segmented label="Experience" value={f.experience} onChange={(v) => set("experience", v)} options={EXPERIENCE} />
          </div>

          <div>
            <p className="label">Days per week</p>
            <Segmented label="Training days per week" value={String(f.days)} onChange={(v) => set("days", Number(v))} options={DAYS} />
          </div>

          <Field label={`Session length: ${f.minutes} minutes`} htmlFor={`${id}-min`} hint="Longer sessions fit more exercises.">
            <input id={`${id}-min`} type="range" min={30} max={120} step={5} value={f.minutes} onChange={(e) => set("minutes", Number(e.target.value))}
              className="h-11 w-full accent-[rgb(var(--brand))]" aria-valuetext={`${f.minutes} minutes`} />
          </Field>

          <Field label="Equipment" htmlFor={`${id}-eq`}>
            <select id={`${id}-eq`} className="input" value={f.equipment} onChange={(e) => set("equipment", e.target.value as Equipment)}>
              {EQUIPMENT.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </Field>

          <Field label="Injuries or limitations (optional)" htmlFor={`${id}-inj`} hint="For example “sore left knee”. I'll avoid aggravating movements. This isn't medical advice, so check with a physiotherapist for anything ongoing.">
            <input id={`${id}-inj`} className="input" value={f.injuries} maxLength={300} onChange={(e) => set("injuries", e.target.value)} />
          </Field>

          {hasPlan && <Notice tone="info">A new plan replaces your active plan. Your logged sessions and history stay as they are.</Notice>}
          {error && <ErrorState message={error} />}

          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? <Spinner label="Creating plan" /> : <Sparkles className="h-4 w-4" aria-hidden />} {busy ? "Creating…" : hasPlan ? "Replace my plan" : "Create my plan"}
            </button>
            {hasPlan && <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>}
          </div>
        </form>
      )}

      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Replace your current plan?">
        <p className="text-sm text-muted">Your new plan becomes the active one and today&apos;s workout will come from it. Past sessions and personal records are kept.</p>
        <div className="mt-4 flex gap-2">
          <button className="btn btn-primary flex-1" onClick={() => void generate()}>Yes, replace it</button>
          <button className="btn flex-1" onClick={() => setConfirm(false)}>Keep current plan</button>
        </div>
      </Sheet>
    </section>
  );
}
