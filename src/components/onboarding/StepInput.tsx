"use client";
import { ArrowRight } from "lucide-react";
import { useId, useRef, type ReactNode } from "react";
import { clsx } from "@/components/ui";
import { DictateButton } from "./DictateButton";
import { fromSpeech } from "./speech";
import {
  ACTIVITY_OPTIONS, EQUIPMENT_OPTIONS, EXPERIENCE_OPTIONS, FOOD_EXAMPLES, GOAL_OPTIONS, MEAL_CHOICES, SEX_OPTIONS, SESSION_CHOICES,
  TRAIN_DAY_CHOICES, UNIT_OPTIONS, parseFoods, weightUnit, type Answers, type Option, type StepId,
} from "./model";

interface Props {
  id: StepId;
  answers: Answers;
  set: (patch: Partial<Answers>) => void;
  /** Validate and move on. A patch is merged first, so a tap on a choice can answer and advance in one go. */
  submit: (patch?: Partial<Answers>) => void;
  error: string | null;
  labelId: string;
  last: boolean;
}

function ChoiceList<T extends string>({ options, value, onPick, labelId }: { options: Option<T>[]; value: T | null; onPick: (v: T) => void; labelId: string }) {
  return (
    <div role="radiogroup" aria-labelledby={labelId} className="grid gap-2">
      {options.map((o) => (
        <button
          key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onPick(o.value)}
          className={clsx(
            "min-h-[56px] w-full rounded-xl border px-4 py-3 text-left transition-colors",
            value === o.value ? "border-brand bg-brand/10" : "border-border bg-surface hover:bg-surface-2",
          )}
        >
          <span className="block font-medium">{o.label}</span>
          {o.description && <span className="block text-sm text-muted">{o.description}</span>}
        </button>
      ))}
    </div>
  );
}

function Chips({ values, current, onPick, format, labelId }: { values: number[]; current: string | number; onPick: (v: number) => void; format: (n: number) => string; labelId: string }) {
  return (
    <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-2">
      {values.map((v) => (
        <button
          key={v} type="button" role="radio" aria-checked={String(current) === String(v)} onClick={() => onPick(v)}
          className={clsx(
            "min-h-[44px] min-w-[56px] rounded-full border px-4 text-sm font-medium transition-colors",
            String(current) === String(v) ? "border-brand bg-brand/15 text-brand" : "border-border bg-surface hover:bg-surface-2",
          )}
        >
          {format(v)}
        </button>
      ))}
    </div>
  );
}

function Suffix({ children, unit }: { children: ReactNode; unit: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">{children}</div>
      <span className="shrink-0 text-sm font-medium text-muted">{unit}</span>
    </div>
  );
}

export function StepInput({ id, answers: a, set, submit, error, labelId, last }: Props) {
  const errId = useId();
  const common = { "aria-labelledby": labelId, "aria-describedby": error ? errId : undefined, "aria-invalid": error ? true : undefined } as const;
  const nextLabel = last ? "See my plan" : "Next";

  // Optional voice answer: fills the field live; the person still reviews and presses Next themselves.
  const baseRef = useRef("");
  const voice = (base = "") => (
    <DictateButton
      onStart={() => { baseRef.current = base; }}
      onText={(text) => { const p = fromSpeech(id, text, a, baseRef.current); if (p) set(p); }}
    />
  );

  const next = (opts: { skip?: { label: string; patch: Partial<Answers> }; disabled?: boolean } = {}) => (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <button type="submit" className="btn btn-primary min-w-[120px]" disabled={opts.disabled}>
        {nextLabel} <ArrowRight className="h-4 w-4" aria-hidden />
      </button>
      {opts.skip && <button type="button" className="btn btn-ghost" onClick={() => submit(opts.skip!.patch)}>{opts.skip.label}</button>}
    </div>
  );

  let body: ReactNode;
  switch (id) {
    case "units":
      body = <ChoiceList options={UNIT_OPTIONS} value={a.unitSystem} onPick={(v) => submit({ unitSystem: v })} labelId={labelId} />;
      break;
    case "sex":
      body = <ChoiceList options={SEX_OPTIONS} value={a.sex} onPick={(v) => submit({ sex: v })} labelId={labelId} />;
      break;
    case "goal":
      body = <ChoiceList options={GOAL_OPTIONS} value={a.goal} onPick={(v) => submit({ goal: v })} labelId={labelId} />;
      break;
    case "activity":
      body = <ChoiceList options={ACTIVITY_OPTIONS} value={a.activity} onPick={(v) => submit({ activity: v })} labelId={labelId} />;
      break;
    case "equipment":
      body = <ChoiceList options={EQUIPMENT_OPTIONS} value={a.equipment} onPick={(v) => submit({ equipment: v })} labelId={labelId} />;
      break;
    case "experience":
      body = <ChoiceList options={EXPERIENCE_OPTIONS} value={a.experience} onPick={(v) => submit({ experience: v })} labelId={labelId} />;
      break;
    case "name":
      body = (
        <>
          <input {...common} className="input !min-h-[52px] text-lg" autoComplete="given-name" maxLength={80} value={a.name} onChange={(e) => set({ name: e.target.value })} />
          {voice()}
          {next({ skip: { label: "Skip", patch: { name: "" } } })}
        </>
      );
      break;
    case "birthYear":
      body = (
        <>
          <input {...common} className="input !min-h-[52px] text-lg" inputMode="numeric" autoComplete="bday-year" maxLength={4} placeholder="YYYY" value={a.birthYear} onChange={(e) => set({ birthYear: e.target.value })} />
          {voice()}
          {next()}
        </>
      );
      break;
    case "height":
      body = a.unitSystem === "IMPERIAL" ? (
        <>
          <div className="flex items-center gap-2" role="group" aria-labelledby={labelId}>
            <Suffix unit="ft"><input aria-label="Feet" className="input !min-h-[52px] text-lg" inputMode="numeric" value={a.heightFt} onChange={(e) => set({ heightFt: e.target.value })} aria-invalid={error ? true : undefined} aria-describedby={error ? errId : undefined} /></Suffix>
            <Suffix unit="in"><input aria-label="Inches" className="input !min-h-[52px] text-lg" inputMode="decimal" value={a.heightIn} onChange={(e) => set({ heightIn: e.target.value })} aria-invalid={error ? true : undefined} aria-describedby={error ? errId : undefined} /></Suffix>
          </div>
          {voice()}
          {next()}
        </>
      ) : (
        <>
          <Suffix unit="cm"><input {...common} className="input !min-h-[52px] text-lg" inputMode="decimal" value={a.heightCm} onChange={(e) => set({ heightCm: e.target.value })} /></Suffix>
          {voice()}
          {next()}
        </>
      );
      break;
    case "weight":
      body = (
        <>
          <Suffix unit={weightUnit(a.unitSystem)}><input {...common} className="input !min-h-[52px] text-lg" inputMode="decimal" value={a.weight} onChange={(e) => set({ weight: e.target.value })} /></Suffix>
          {voice()}
          {next()}
        </>
      );
      break;
    case "targetWeight":
      body = (
        <>
          <Suffix unit={weightUnit(a.unitSystem)}><input {...common} className="input !min-h-[52px] text-lg" inputMode="decimal" value={a.targetWeight} onChange={(e) => set({ targetWeight: e.target.value })} /></Suffix>
          {voice()}
          {next({ skip: { label: "Skip, no target", patch: { targetWeight: "" } } })}
        </>
      );
      break;
    case "trainDays":
      body = (
        <>
          <Chips values={TRAIN_DAY_CHOICES} current={a.trainDays} labelId={labelId} format={(n) => `${n} days`} onPick={(n) => submit({ trainDays: n })} />
          {next()}
        </>
      );
      break;
    case "sessionMinutes":
      body = (
        <>
          <Chips values={SESSION_CHOICES} current={a.sessionMinutes} labelId={labelId} format={(n) => `${n} min`} onPick={(n) => submit({ sessionMinutes: String(n) })} />
          <div className="mt-3 max-w-[200px]">
            <Suffix unit="minutes"><input aria-label="Or type your own, in minutes" className="input" inputMode="numeric" value={a.sessionMinutes} onChange={(e) => set({ sessionMinutes: e.target.value })} aria-invalid={error ? true : undefined} aria-describedby={error ? errId : undefined} /></Suffix>
          </div>
          {voice()}
          {next()}
        </>
      );
      break;
    case "injuries":
      body = (
        <>
          <textarea {...common} className="input min-h-[96px] py-2" rows={3} maxLength={300} value={a.injuries} onChange={(e) => set({ injuries: e.target.value })} />
          {voice(a.injuries)}
          {next({ skip: { label: "None", patch: { injuries: "" } } })}
        </>
      );
      break;
    case "foods": {
      const current = parseFoods(a.foods).map((f) => f.toLowerCase());
      const toggle = (food: string) => {
        const list = parseFoods(a.foods);
        const has = current.includes(food.toLowerCase());
        set({ foods: (has ? list.filter((f) => f.toLowerCase() !== food.toLowerCase()) : [...list, food]).join(", ") });
      };
      body = (
        <>
          <input {...common} className="input !min-h-[52px] text-lg" placeholder="Separate with commas" value={a.foods} onChange={(e) => set({ foods: e.target.value })} />
          {voice(a.foods)}
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Common examples">
            {FOOD_EXAMPLES.map((f) => {
              const on = current.includes(f.toLowerCase());
              return (
                <button key={f} type="button" aria-pressed={on} onClick={() => toggle(f)}
                  className={clsx("min-h-[44px] rounded-full border px-4 text-sm font-medium transition-colors", on ? "border-brand bg-brand/15 text-brand" : "border-border bg-surface hover:bg-surface-2")}>
                  {f}
                </button>
              );
            })}
          </div>
          {next({ skip: { label: "Nothing to avoid", patch: { foods: "" } } })}
        </>
      );
      break;
    }
    case "mealsPerDay":
      body = (
        <>
          <Chips values={MEAL_CHOICES} current={a.mealsPerDay} labelId={labelId} format={(n) => String(n)} onPick={(n) => submit({ mealsPerDay: n })} />
          {next()}
        </>
      );
      break;
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
      {body}
      {error && <p id={errId} role="alert" className="mt-3 text-sm text-bad">{error}</p>}
    </form>
  );
}
