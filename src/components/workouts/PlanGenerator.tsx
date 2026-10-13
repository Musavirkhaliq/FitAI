"use client";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { useId, useState } from "react";
import { ErrorState, Field, Notice, Sheet, Spinner, clsx, haptic } from "@/components/ui";
import { post } from "@/lib/client/api";
import type { Equipment, Experience, PlanGoal, WorkoutsDto } from "./types";

const GOALS: { value: PlanGoal; label: string; sub: string }[] = [
  { value: "MUSCLE_GAIN", label: "Build muscle", sub: "More size, steady progress" },
  { value: "FAT_LOSS", label: "Lose fat, keep muscle", sub: "Lift to protect what you have" },
  { value: "STRENGTH", label: "Get stronger", sub: "Heavier lifts over time" },
  { value: "RECOMP", label: "Body recomposition", sub: "Leaner and stronger together" },
  { value: "MAINTAIN", label: "Maintain", sub: "Keep what you have built" },
];
const EQUIPMENT: { value: Equipment; label: string; sub: string }[] = [
  { value: "FULL_GYM", label: "Full gym", sub: "Barbells, machines, cables" },
  { value: "DUMBBELLS", label: "Dumbbells", sub: "A pair or an adjustable set" },
  { value: "HOME", label: "Home", sub: "Bands and basic kit" },
  { value: "BODYWEIGHT", label: "Bodyweight only", sub: "No equipment needed" },
];
const EXPERIENCE: { value: Experience; label: string; sub: string }[] = [
  { value: "BEGINNER", label: "Beginner", sub: "New, or coming back after a long break" },
  { value: "INTERMEDIATE", label: "Intermediate", sub: "Training steadily for a year or more" },
  { value: "ADVANCED", label: "Advanced", sub: "Several years of consistent lifting" },
];
const DAYS = [2, 3, 4, 5, 6];
const MINUTES = [30, 45, 60, 75, 90, 120];
const STEPS = ["Goal", "Experience", "Schedule", "Equipment", "Details"] as const;

interface Form { goal: PlanGoal; experience: Experience; days: number; minutes: number; equipment: Equipment; injuries: string }

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** One big tappable answer. */
function Choice({ selected, onSelect, label, sub, compact }: { selected: boolean; onSelect: () => void; label: string; sub?: string; compact?: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => { haptic(); onSelect(); }}
      className={clsx(
        "press flex w-full flex-col justify-center rounded-2xl border px-4 transition-colors",
        compact ? "min-h-[56px] items-center text-center" : "min-h-[60px] items-start py-2.5 text-left",
        selected ? "border-brand bg-brand/10" : "border-border bg-surface hover:bg-surface-2",
      )}
    >
      <span className={clsx("font-semibold", selected && "text-brand", compact && "num !text-lg")}>{label}</span>
      {sub && <span className="text-sm text-muted">{sub}</span>}
    </button>
  );
}

/**
 * Plan generator as a step-by-step sheet: one question per screen with large answers. Defaults come from the profile,
 * edits override them. `variant="primary"` is the first-time call to action; "compact" is the quiet "New plan" button.
 */
export function PlanGenerator({ profile, goal, hasPlan, onDone, variant = hasPlan ? "compact" : "primary" }: {
  profile: WorkoutsDto["profile"]; goal: PlanGoal | null; hasPlan: boolean; onDone: () => void; variant?: "primary" | "compact";
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
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
  const minuteChoices = MINUTES.includes(f.minutes) ? MINUTES : [...MINUTES, f.minutes].sort((a, b) => a - b);
  const last = step === STEPS.length - 1;

  const openSheet = () => {
    haptic();
    setStep(0);
    setConfirm(false);
    setError(null);
    setDone(false);
    setOpen(true);
  };
  const close = () => { setOpen(false); setConfirm(false); };

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
      haptic("success");
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
    if (!last) return setStep((s) => s + 1);
    if (hasPlan) setConfirm(true);
    else void generate();
  };

  return (
    <>
      {variant === "primary" ? (
        <button type="button" className="btn btn-primary !min-h-[60px] w-full !rounded-2xl text-lg" onClick={openSheet}>
          <Sparkles className="h-5 w-5" aria-hidden /> Create my plan
        </button>
      ) : (
        <button type="button" className="btn" onClick={openSheet} aria-haspopup="dialog">
          <Sparkles className="h-4 w-4 text-brand" aria-hidden /> New plan
        </button>
      )}
      {done && <div className="mt-3 w-full"><Notice tone="good">Your new plan is ready. It&apos;s now your active plan.</Notice></div>}

      <Sheet open={open} onClose={close} title={hasPlan ? "Make a new plan" : "Create your plan"}>
        <form onSubmit={submit} className="space-y-5" aria-labelledby={`${id}-q`}>
          <div>
            <ol className="flex gap-1.5" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
              {STEPS.map((s, i) => (
                <li key={s} aria-current={i === step ? "step" : undefined} className={clsx("h-1.5 flex-1 rounded-full transition-colors duration-300", i <= step ? "grad-brand" : "bg-surface-3")}>
                  <span className="sr-only">{s}{i < step ? ", done" : ""}</span>
                </li>
              ))}
            </ol>
            <p className="eyebrow mt-3">Step {step + 1} of {STEPS.length}</p>
          </div>

          {step === 0 && (
            <div className="space-y-3">
              <h3 id={`${id}-q`} className="display text-2xl font-extrabold leading-tight">What&apos;s your main goal?</h3>
              <div role="radiogroup" aria-label="Main goal" className="grid gap-2">
                {GOALS.map((g) => <Choice key={g.value} selected={f.goal === g.value} onSelect={() => set("goal", g.value)} label={g.label} sub={g.sub} />)}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <h3 id={`${id}-q`} className="display text-2xl font-extrabold leading-tight">How experienced are you?</h3>
              <div role="radiogroup" aria-label="Experience" className="grid gap-2">
                {EXPERIENCE.map((g) => <Choice key={g.value} selected={f.experience === g.value} onSelect={() => set("experience", g.value)} label={g.label} sub={g.sub} />)}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h3 id={`${id}-q`} className="display text-2xl font-extrabold leading-tight">What does your week look like?</h3>
              <div>
                <p className="label" id={`${id}-days`}>Training days per week</p>
                <div role="radiogroup" aria-labelledby={`${id}-days`} className="grid grid-cols-5 gap-2">
                  {DAYS.map((n) => <Choice key={n} compact selected={f.days === n} onSelect={() => set("days", n)} label={String(n)} />)}
                </div>
              </div>
              <div>
                <p className="label" id={`${id}-min`}>Time per session</p>
                <div role="radiogroup" aria-labelledby={`${id}-min`} className="grid grid-cols-3 gap-2">
                  {minuteChoices.map((n) => <Choice key={n} compact selected={f.minutes === n} onSelect={() => set("minutes", n)} label={`${n} min`} />)}
                </div>
                <p className="mt-1.5 text-xs text-muted">Longer sessions fit more exercises.</p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <h3 id={`${id}-q`} className="display text-2xl font-extrabold leading-tight">What can you train with?</h3>
              <div role="radiogroup" aria-label="Equipment" className="grid gap-2">
                {EQUIPMENT.map((g) => <Choice key={g.value} selected={f.equipment === g.value} onSelect={() => set("equipment", g.value)} label={g.label} sub={g.sub} />)}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h3 id={`${id}-q`} className="display text-2xl font-extrabold leading-tight">Anything to work around?</h3>
              <Field label="Injuries or limitations (optional)" htmlFor={`${id}-inj`} hint="For example “sore left knee”. I'll avoid aggravating movements. This isn't medical advice, so check with a physiotherapist for anything ongoing.">
                <input id={`${id}-inj`} className="input" value={f.injuries} maxLength={300} onChange={(e) => set("injuries", e.target.value)} />
              </Field>
              <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm">
                <span className="font-semibold">Your plan:</span>{" "}
                {GOALS.find((g) => g.value === f.goal)?.label.toLowerCase()}, {f.days} days a week, about {f.minutes} minutes, {EQUIPMENT.find((g) => g.value === f.equipment)?.label.toLowerCase()}, {f.experience.toLowerCase()}.
              </p>
              {hasPlan && <Notice tone="info">A new plan replaces your active plan. Your logged sessions and history stay as they are.</Notice>}
              {error && <ErrorState message={error} />}
            </div>
          )}

          {confirm ? (
            <div role="alertdialog" aria-labelledby={`${id}-c`} className="space-y-3 rounded-2xl border border-border bg-surface-2 p-4">
              <p id={`${id}-c`} className="font-bold">Replace your current plan?</p>
              <p className="text-sm text-muted">Your new plan becomes the active one and today&apos;s workout will come from it. Past sessions and personal records are kept.</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" className="btn btn-primary !min-h-[56px]" onClick={() => void generate()} disabled={busy}>Yes, replace it</button>
                <button type="button" className="btn !min-h-[56px]" onClick={() => setConfirm(false)}>Keep current</button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <button type="button" className="btn !min-h-[56px] !px-5" onClick={() => (step === 0 ? close() : setStep((s) => s - 1))}>
                <ArrowLeft className="h-5 w-5" aria-hidden /> {step === 0 ? "Cancel" : "Back"}
              </button>
              <button type="submit" className="btn btn-primary !min-h-[56px] text-base" disabled={busy}>
                {last ? (
                  <>{busy ? <Spinner label="Creating plan" /> : <Sparkles className="h-5 w-5" aria-hidden />} {busy ? "Creating…" : hasPlan ? "Replace my plan" : "Create my plan"}</>
                ) : (
                  <>Next <ArrowRight className="h-5 w-5" aria-hidden /></>
                )}
              </button>
            </div>
          )}
        </form>
      </Sheet>
    </>
  );
}
