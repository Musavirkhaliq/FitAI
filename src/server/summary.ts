import type { FoodEntry, MealType } from "@prisma/client";
import { db } from "@/lib/db";
import { addDays, dateRange } from "@/lib/dates";
import { bmr, estimateDailyExpenditure, remaining } from "@/lib/engines/calories";
import { summarizeTrend, type WeightPoint } from "@/lib/engines/weightTrend";
import type { UserContext } from "./context";

export const MEALS: MealType[] = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"];

export interface Totals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  /** Summed uncertainty range for the calories above. */
  minKcal: number;
  maxKcal: number;
}

const zero = (): Totals => ({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0, minKcal: 0, maxKcal: 0 });

export function sumEntries(entries: Pick<FoodEntry, "calories" | "protein" | "carbs" | "fat" | "fiber" | "sodium" | "estimateMin" | "estimateMax">[]): Totals {
  const t = zero();
  for (const e of entries) {
    t.calories += e.calories;
    t.protein += e.protein;
    t.carbs += e.carbs;
    t.fat += e.fat;
    t.fiber += e.fiber;
    t.sodium += e.sodium;
    t.minKcal += e.estimateMin;
    t.maxKcal += e.estimateMax;
  }
  for (const k of Object.keys(t) as (keyof Totals)[]) t[k] = Math.round(t[k] * 10) / 10;
  return t;
}

export interface DaySummary {
  date: string;
  weight: { kg: number; time: string | null } | null;
  sleep: { hours: number; quality: number | null } | null;
  meals: { meal: MealType; entries: FoodEntry[]; totals: Totals }[];
  totals: Totals;
  activity: { steps: number; trainingMin: number; entries: { id: string; type: string; steps: number | null; durationMin: number | null; notes: string | null }[] };
  water: number;
  vegServings: number;
  fruitServings: number;
  targets: { calories: number; proteinG: number; fiberG: number; steps: number; sleepH: number; waterMl: number } | null;
  remaining: { calories: number; proteinG: number } | null;
  /** All values are estimates, never facts. */
  expenditure: { mid: number; low: number; high: number } | null;
  deficit: { mid: number; low: number; high: number } | null;
}

export async function getDaySummary(ctx: UserContext, date: string): Promise<DaySummary> {
  const userId = ctx.userId;
  const [food, weight, sleep, acts, log, sessions, lastWeight] = await Promise.all([
    db.foodEntry.findMany({ where: { userId, date }, orderBy: { createdAt: "asc" } }),
    db.weightEntry.findUnique({ where: { userId_date: { userId, date } } }),
    db.sleepEntry.findUnique({ where: { userId_date: { userId, date } } }),
    db.activityEntry.findMany({ where: { userId, date }, orderBy: { createdAt: "asc" } }),
    db.dailyLog.findUnique({ where: { userId_date: { userId, date } } }),
    db.workoutSession.findMany({ where: { userId, date, status: "COMPLETED" } }),
    db.weightEntry.findFirst({ where: { userId, date: { lte: date } }, orderBy: { date: "desc" } }),
  ]);

  const totals = sumEntries(food);
  const steps = acts.reduce((s, a) => s + (a.steps ?? 0), 0);
  const trainingMin =
    acts.filter((a) => a.type !== "STEPS" && a.type !== "WALKING").reduce((s, a) => s + (a.durationMin ?? 0), 0) +
    sessions.reduce((s, x) => s + (x.durationMin ?? 0), 0);

  const g = ctx.goal;
  const targets = g
    ? { calories: g.calorieTarget, proteinG: g.proteinTargetG, fiberG: g.fiberTargetG, steps: g.stepTarget, sleepH: g.sleepTargetH, waterMl: g.waterTargetMl }
    : null;

  let expenditure: DaySummary["expenditure"] = null;
  let deficit: DaySummary["deficit"] = null;
  const p = ctx.profile;
  const wKg = lastWeight?.weightKg ?? p.startWeightKg;
  if (wKg && p.heightCm && ctx.ageYears && p.sex) {
    expenditure = estimateDailyExpenditure({ bmrKcal: bmr(p.sex, wKg, p.heightCm, ctx.ageYears), weightKg: wKg, steps, trainingMinutes: trainingMin });
    if (food.length) {
      deficit = { mid: expenditure.mid - totals.calories, low: expenditure.low - totals.maxKcal, high: expenditure.high - totals.minKcal };
    }
  }

  return {
    date,
    weight: weight ? { kg: weight.weightKg, time: weight.time } : null,
    sleep: sleep ? { hours: sleep.hours, quality: sleep.quality } : null,
    meals: MEALS.map((meal) => {
      const entries = food.filter((f) => f.meal === meal);
      return { meal, entries, totals: sumEntries(entries) };
    }),
    totals,
    activity: { steps, trainingMin, entries: acts.map((a) => ({ id: a.id, type: a.type, steps: a.steps, durationMin: a.durationMin, notes: a.notes })) },
    water: log?.waterMl ?? 0,
    vegServings: log?.vegServings ?? 0,
    fruitServings: log?.fruitServings ?? 0,
    targets,
    remaining: targets ? remaining({ calories: targets.calories, proteinG: targets.proteinG }, { calories: totals.calories, protein: totals.protein }) : null,
    expenditure,
    deficit,
  };
}

export async function getWeightPoints(userId: string, from?: string, to?: string): Promise<WeightPoint[]> {
  const rows = await db.weightEntry.findMany({
    where: { userId, ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) },
    orderBy: { date: "asc" },
    select: { date: true, weightKg: true },
  });
  return rows;
}

export async function getTrend(ctx: UserContext, asOf = ctx.today) {
  const pts = await getWeightPoints(ctx.userId, addDays(asOf, -120), asOf);
  return summarizeTrend(pts, asOf, ctx.profile.startWeightKg);
}

export interface DailyPoint {
  date: string;
  calories: number | null;
  protein: number | null;
  fiber: number | null;
  steps: number | null;
  sleepH: number | null;
  weightKg: number | null;
  trainingMin: number;
  volume: number;
  hardSets: number;
}

/** One row per day in the range, for charts, correlations and adherence. */
export async function getRangeDaily(userId: string, from: string, to: string): Promise<DailyPoint[]> {
  const [food, weights, sleeps, acts, sets, sessions] = await Promise.all([
    db.foodEntry.findMany({ where: { userId, date: { gte: from, lte: to } }, select: { date: true, calories: true, protein: true, fiber: true } }),
    db.weightEntry.findMany({ where: { userId, date: { gte: from, lte: to } }, select: { date: true, weightKg: true } }),
    db.sleepEntry.findMany({ where: { userId, date: { gte: from, lte: to } }, select: { date: true, hours: true } }),
    db.activityEntry.findMany({ where: { userId, date: { gte: from, lte: to } }, select: { date: true, type: true, steps: true, durationMin: true } }),
    db.workoutSet.findMany({ where: { userId, date: { gte: from, lte: to } }, select: { date: true, volume: true, rpe: true } }),
    db.workoutSession.findMany({ where: { userId, date: { gte: from, lte: to }, status: "COMPLETED" }, select: { date: true, durationMin: true } }),
  ]);
  return dateRange(from, to).map((date) => {
    const f = food.filter((x) => x.date === date);
    const a = acts.filter((x) => x.date === date);
    const s = sets.filter((x) => x.date === date);
    const stepRows = a.filter((x) => x.steps != null);
    return {
      date,
      calories: f.length ? Math.round(f.reduce((t, x) => t + x.calories, 0)) : null,
      protein: f.length ? Math.round(f.reduce((t, x) => t + x.protein, 0)) : null,
      fiber: f.length ? Math.round(f.reduce((t, x) => t + x.fiber, 0)) : null,
      steps: stepRows.length ? stepRows.reduce((t, x) => t + (x.steps ?? 0), 0) : null,
      sleepH: sleeps.find((x) => x.date === date)?.hours ?? null,
      weightKg: weights.find((x) => x.date === date)?.weightKg ?? null,
      trainingMin:
        a.filter((x) => x.type !== "STEPS" && x.type !== "WALKING").reduce((t, x) => t + (x.durationMin ?? 0), 0) +
        sessions.filter((x) => x.date === date).reduce((t, x) => t + (x.durationMin ?? 0), 0),
      volume: Math.round(s.reduce((t, x) => t + x.volume, 0)),
      hardSets: s.filter((x) => x.rpe == null || x.rpe >= 6).length,
    };
  });
}

/** Share of days in the range with any food logged (0–1). */
export const loggingAdherence = (days: DailyPoint[]) => (days.length ? days.filter((d) => d.calories != null).length / days.length : 0);
