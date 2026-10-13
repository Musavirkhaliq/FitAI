"use client";
import { AlertTriangle, Beef, Droplets, Flame, Footprints, Moon, Scale, Target, Wheat } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EmptyState, Field, Sheet } from "@/components/ui";
import type { ApiState } from "@/lib/client/api";
import { fmtNum, kgToLb, lbToKg } from "@/lib/client/format";
import type { GoalType } from "@/lib/client/types";
import { Group, NumberField, Row, SaveStatus, inRange, num, useSaver } from "./common";
import type { GoalDto, ProfilePatch, ProfileResponse } from "./types";

const GOAL_LABEL: Record<GoalType, string> = {
  FAT_LOSS: "Lose body fat", MUSCLE_GAIN: "Build muscle", STRENGTH: "Get stronger", RECOMP: "Recomposition", MAINTAIN: "Maintain",
};

const r1 = (n: number) => String(Math.round(n * 10) / 10);

export function GoalsSection({ api, data, index = 0 }: { api: ApiState<ProfileResponse>; data: ProfileResponse; index?: number }) {
  const { goal, profile } = data;
  const saver = useSaver(api);
  const imperial = profile.unitSystem === "IMPERIAL";
  const floor = profile.sex === "FEMALE" ? 1200 : 1500;

  const [open, setOpen] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [type, setType] = useState<GoalType>(goal?.type ?? "FAT_LOSS");
  const [target, setTarget] = useState("");
  const [cal, setCal] = useState("");
  const [protein, setProtein] = useState("");
  const [fiber, setFiber] = useState("");
  const [steps, setSteps] = useState("");
  const [sleep, setSleep] = useState("");
  const [water, setWater] = useState("");
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const load = (x: GoalDto) => {
    setType(x.type);
    setTarget(x.targetWeightKg != null ? r1(imperial ? kgToLb(x.targetWeightKg) : x.targetWeightKg) : "");
    setCal(String(x.calorieTarget));
    setProtein(String(x.proteinTargetG));
    setFiber(String(x.fiberTargetG));
    setSteps(String(x.stepTarget));
    setSleep(String(x.sleepTargetH));
    setWater(String(x.waterTargetMl));
  };

  // Re-sync when the saved goal changes (e.g. the server raised a too-low calorie target to the floor).
  const g = goal;
  useEffect(() => {
    if (!g) return;
    load(g);
  }, [g?.type, g?.targetWeightKg, g?.calorieTarget, g?.proteinTargetG, g?.fiberTargetG, g?.stepTarget, g?.sleepTargetH, g?.waterTargetMl, imperial]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    if (open && focusId) document.getElementById(focusId)?.focus();
  }, [open, focusId]);

  if (!goal) {
    return (
      <Group id="goals-h" title="Goals and targets" index={index}>
        <div className="p-3">
          <EmptyState title="No targets yet" body="Answer a few quick questions and I'll set starting targets for you." action={<Link href="/onboarding" className="btn btn-primary">Set up my plan</Link>} />
        </div>
      </Group>
    );
  }

  const unit = imperial ? "lb" : "kg";
  const calNum = num(cal);

  const openSheet = (field: string) => {
    load(goal);
    setErrors({});
    setFocusId(field);
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string | null> = {
      cal: inRange(cal, 500, 8000, true, "Calories"),
      protein: inRange(protein, 20, 500, true, "Protein"),
      fiber: inRange(fiber, 5, 100, true, "Fibre"),
      steps: inRange(steps, 1000, 50000, true, "Steps"),
      sleep: inRange(sleep, 4, 12, false, "Sleep"),
      water: inRange(water, 500, 8000, true, "Water"),
      target: target.trim() ? inRange(target, imperial ? 55 : 25, imperial ? 882 : 400, false, "Target weight") : null,
    };
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    const t = num(target);
    const body: NonNullable<ProfilePatch["goal"]> = {
      type, calorieTarget: num(cal) ?? undefined, proteinTargetG: num(protein) ?? undefined, fiberTargetG: num(fiber) ?? undefined,
      stepTarget: num(steps) ?? undefined, sleepTargetH: num(sleep) ?? undefined, waterTargetMl: num(water) ?? undefined,
      ...(t != null ? { targetWeightKg: Math.round((imperial ? lbToKg(t) : t) * 10) / 10 } : {}),
    };
    const saved = await saver.save({ goal: body });
    // The server may have raised the calories to the safety floor; show what was actually saved.
    if (saved?.goal) {
      setCal(String(saved.goal.calorieTarget));
      setOpen(false);
    }
  };

  const warnings = saver.warnings.length > 0 && (
    <div role="alert" className="space-y-1 rounded-2xl border border-warn/40 bg-warn/10 p-3 text-sm">
      {saver.warnings.map((w) => <p key={w} className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden />{w}</p>)}
    </div>
  );

  return (
    <div>
      <Group
        id="goals-h" title="Goals and targets" index={index}
        description="These are starting estimates, not medical advice, and they're your call. Your coach only suggests changes, and only after about 14 days of data."
        status={
          <>
            {!open && warnings}
            {!open && <SaveStatus saver={saver} />}
          </>
        }
      >
        <Row icon={Target} tint="brand" label="Goal" value={GOAL_LABEL[goal.type]} onClick={() => openSheet("g-type")} opens />
        <Row icon={Scale} tint="neutral" label="Target weight" value={goal.targetWeightKg != null ? `${r1(imperial ? kgToLb(goal.targetWeightKg) : goal.targetWeightKg)} ${unit}` : "Not set"} onClick={() => openSheet("g-target")} opens />
        <Row icon={Flame} tint="cal" label="Calories per day" value={`${fmtNum(goal.calorieTarget)} kcal`} onClick={() => openSheet("g-cal")} opens />
        <Row icon={Beef} tint="protein" label="Protein per day" value={`${fmtNum(goal.proteinTargetG)} g`} onClick={() => openSheet("g-pro")} opens />
        <Row icon={Wheat} tint="fiber" label="Fibre per day" value={`${fmtNum(goal.fiberTargetG)} g`} onClick={() => openSheet("g-fib")} opens />
        <Row icon={Footprints} tint="steps" label="Steps per day" value={fmtNum(goal.stepTarget)} onClick={() => openSheet("g-steps")} opens />
        <Row icon={Moon} tint="sleep" label="Sleep per night" value={`${goal.sleepTargetH} hours`} onClick={() => openSheet("g-sleep")} opens />
        <Row icon={Droplets} tint="protein" label="Water per day" value={`${fmtNum(goal.waterTargetMl)} ml`} onClick={() => openSheet("g-water")} opens />
      </Group>

      <Sheet open={open} onClose={close} title="Goals and targets">
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Goal" htmlFor="g-type">
            <select id="g-type" className="input" value={type} onChange={(e) => setType(e.target.value as GoalType)}>
              {(Object.keys(GOAL_LABEL) as GoalType[]).map((k) => <option key={k} value={k}>{GOAL_LABEL[k]}</option>)}
            </select>
          </Field>
          <NumberField id="g-target" label="Target weight (optional)" unit={unit} value={target} onChange={setTarget} error={errors.target} />
          <NumberField
            id="g-cal" label="Calories per day" unit="kcal" value={cal} onChange={setCal} inputMode="numeric" error={errors.cal}
            hint={`Never set below ${fmtNum(floor)} kcal (${profile.sex === "FEMALE" ? "female" : profile.sex === "MALE" ? "male" : "the safer default when sex isn't set"}). Lower values are raised to that floor.`}
          />
          <NumberField id="g-pro" label="Protein per day" unit="g" value={protein} onChange={setProtein} inputMode="numeric" error={errors.protein} />
          <NumberField id="g-fib" label="Fibre per day" unit="g" value={fiber} onChange={setFiber} inputMode="numeric" error={errors.fiber} />
          <NumberField id="g-steps" label="Steps per day" value={steps} onChange={setSteps} inputMode="numeric" error={errors.steps} />
          <NumberField id="g-sleep" label="Sleep per night" unit="hours" value={sleep} onChange={setSleep} error={errors.sleep} />
          <NumberField id="g-water" label="Water per day" unit="ml" value={water} onChange={setWater} inputMode="numeric" error={errors.water} />

          {calNum != null && calNum < floor && (
            <p className="flex items-start gap-2 rounded-2xl border border-warn/40 bg-warn/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden />
              {fmtNum(calNum)} kcal is under the {fmtNum(floor)} kcal minimum. If you save, I&apos;ll use {fmtNum(floor)} instead.
            </p>
          )}
          {open && warnings}

          <div className="space-y-2 pt-1">
            <button className="btn btn-primary w-full !min-h-[52px] !text-base" disabled={saver.state === "saving"}>Save targets</button>
            <SaveStatus saver={saver} />
          </div>
        </form>
      </Sheet>
    </div>
  );
}
