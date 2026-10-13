import type { TrendSummary } from "./weightTrend";

export type SexLike = "FEMALE" | "MALE" | null | undefined;

export const KCAL_PER_KG_FAT = 7700;

/** Hard guardrail: never recommend below these without medical supervision. */
export function calorieFloor(sex: SexLike): number {
  if (sex === "FEMALE") return 1200;
  return 1500; // male, or unknown → the more conservative floor
}

export function clampToFloor(kcal: number, sex: SexLike): { kcal: number; clamped: boolean } {
  const floor = calorieFloor(sex);
  return kcal < floor ? { kcal: floor, clamped: true } : { kcal, clamped: false };
}

/** Mifflin–St Jeor resting energy expenditure (kcal/day). */
export function bmr(sex: SexLike, weightKg: number, heightCm: number, ageYears: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return Math.round(sex === "FEMALE" ? base - 161 : base + 5);
}

export function tdeeFromActivity(bmrKcal: number, activityMultiplier: number): number {
  return Math.round(bmrKcal * activityMultiplier);
}

/**
 * Day-level expenditure estimate from what actually happened (steps + training) rather than a fixed
 * multiplier. Always returned as a range — it is an estimate, never a measurement.
 */
export function estimateDailyExpenditure(args: {
  bmrKcal: number;
  weightKg: number;
  steps: number;
  trainingMinutes: number;
}) {
  const baseline = args.bmrKcal * 1.15; // resting + digestion + incidental movement
  const stepKcal = args.steps * 0.00055 * args.weightKg;
  const trainKcal = args.trainingMinutes * 0.06 * args.weightKg;
  const mid = Math.round(baseline + stepKcal + trainKcal);
  return { mid, low: Math.round(mid * 0.9), high: Math.round(mid * 1.1) };
}

export interface StartingTargets {
  calories: number;
  proteinG: number;
  fiberG: number;
  steps: number;
  tdee: number;
  clamped: boolean;
  weeklyRateKg: number;
}

export function startingTargets(args: {
  sex: SexLike;
  weightKg: number;
  heightCm: number;
  ageYears: number;
  activityMultiplier: number;
  goal: "FAT_LOSS" | "MUSCLE_GAIN" | "STRENGTH" | "RECOMP" | "MAINTAIN";
  targetRateKgPerWeek?: number;
}): StartingTargets {
  const tdee = tdeeFromActivity(bmr(args.sex, args.weightKg, args.heightCm, args.ageYears), args.activityMultiplier);
  const rate = args.targetRateKgPerWeek ?? 0.5;
  let weeklyRateKg = 0;
  let raw = tdee;
  if (args.goal === "FAT_LOSS") {
    // Cap the deficit at 1% bodyweight/week and 25% of TDEE.
    weeklyRateKg = Math.min(rate, args.weightKg * 0.01);
    raw = Math.max(tdee - (weeklyRateKg * KCAL_PER_KG_FAT) / 7, tdee * 0.75);
  } else if (args.goal === "MUSCLE_GAIN") {
    raw = tdee + 250;
    weeklyRateKg = -0.25;
  } else if (args.goal === "RECOMP") {
    raw = tdee - 100;
  }
  const { kcal, clamped } = clampToFloor(Math.round(raw / 10) * 10, args.sex);
  const proteinG = Math.round((args.goal === "FAT_LOSS" || args.goal === "RECOMP" ? 2.0 : 1.8) * args.weightKg);
  return {
    calories: kcal,
    proteinG,
    fiberG: Math.max(25, Math.min(35, Math.round((kcal / 1000) * 14))),
    steps: 8000,
    tdee,
    clamped,
    weeklyRateKg,
  };
}

export type CalorieAction = "WAIT" | "KEEP" | "DECREASE" | "INCREASE" | "RECHECK_TDEE";

export interface CalorieAdvice {
  action: CalorieAction;
  deltaKcal: number;
  suggestedTarget: number;
  reason: string;
  /** Always true: the app suggests, the user decides. Not medical instruction. */
  isSuggestion: true;
  blockedByFloor: boolean;
}

/**
 * Rules engine for calorie targets (fat-loss goal). Deliberately conservative: it does nothing until
 * there are 14 days of data, and one or two odd weigh-ins can't trigger a change because the verdict is
 * based on the 14-day regression slope.
 */
export function adviseCalories(args: {
  trend: TrendSummary;
  currentTarget: number;
  sex: SexLike;
  /** Share of the last 14 days with food logged, 0–1. */
  adherence: number;
  goal?: "FAT_LOSS" | "MUSCLE_GAIN" | "STRENGTH" | "RECOMP" | "MAINTAIN";
}): CalorieAdvice {
  const { trend, currentTarget, sex, adherence } = args;
  const base = (action: CalorieAction, deltaKcal: number, reason: string): CalorieAdvice => {
    const wanted = currentTarget + deltaKcal;
    const { kcal, clamped } = clampToFloor(wanted, sex);
    return {
      action: clamped && deltaKcal < 0 && kcal >= currentTarget ? "KEEP" : action,
      deltaKcal: kcal - currentTarget,
      suggestedTarget: kcal,
      reason: clamped && deltaKcal < 0
        ? `${reason} Going lower would drop below ${calorieFloor(sex)} kcal, which I won't suggest without medical supervision — consider more daily movement instead.`
        : reason,
      isSuggestion: true,
      blockedByFloor: clamped && deltaKcal < 0,
    };
  };

  const goal = args.goal ?? "FAT_LOSS";
  if (trend.status === "INSUFFICIENT_DATA" || trend.spanDays < 13) {
    return base("WAIT", 0, "I need about 14 days of weigh-ins before suggesting any change. Keep going with the current target.");
  }
  if (adherence < 0.6) {
    return base("WAIT", 0, "Food logging has been patchy, so the trend can't be trusted to tune calories yet. Logging most days makes the numbers reliable.");
  }
  if (goal !== "FAT_LOSS") {
    return base("KEEP", 0, "Your current target stays as is; I'll flag it if the trend drifts from your goal.");
  }
  switch (trend.status) {
    case "FAST_LOSS":
      return trend.sustainedFastLoss
        ? base("INCREASE", 150, "Weight has dropped faster than 1% of body weight per week for two weeks. A little more food will protect muscle and energy.")
        : base("KEEP", 0, "The last fortnight was fast, but it isn't sustained yet. I'd hold the target and re-check next week.");
    case "TARGET_LOSS":
      return base("KEEP", 0, "You're in the sweet spot. Keep calories where they are.");
    case "SLOW_LOSS":
      return base("DECREASE", -125, "Loss is under 0.25 kg/week. Trim about 100–150 kcal, or add steps — your choice.");
    case "PLATEAU":
      return base("RECHECK_TDEE", -100, "Weight has been flat for two weeks with good logging. Your maintenance estimate may be too high — a small trim or more daily movement would test that.");
    case "GAINING":
      return base("DECREASE", -150, "The 14-day trend is up. Before cutting further, double-check portions and oils; a ~150 kcal trim is the next lever if it holds.");
    default:
      return base("WAIT", 0, "Not enough data yet.");
  }
}

/** Back-calculate maintenance from observed intake and observed weight change. An estimate. */
export function empiricalTdee(avgDailyIntakeKcal: number, weeklyRateKg: number): number {
  return Math.round(avgDailyIntakeKcal - (weeklyRateKg * KCAL_PER_KG_FAT) / 7);
}

/** Calories & protein left today. */
export function remaining(target: { calories: number; proteinG: number }, eaten: { calories: number; protein: number }) {
  return {
    calories: Math.round(target.calories - eaten.calories),
    proteinG: Math.round(target.proteinG - eaten.protein),
  };
}
