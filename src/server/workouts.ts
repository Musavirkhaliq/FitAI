import type { Exercise, WorkoutDay, WorkoutPlan } from "@prisma/client";
import { db } from "@/lib/db";
import { addDays, daysBetween } from "@/lib/dates";
import { prescribeNext, robust1RM, weeklyHardSets, volumeStatus, type Prescription, type SetResult } from "@/lib/engines/overload";
import type { UserContext } from "./context";

export type PlanWithDays = WorkoutPlan & { days: (WorkoutDay & { exercises: Exercise[] })[] };

export async function getActivePlan(userId: string): Promise<PlanWithDays | null> {
  return db.workoutPlan.findFirst({
    where: { userId, active: true },
    orderBy: { createdAt: "desc" },
    include: { days: { orderBy: { dayIndex: "asc" }, include: { exercises: { orderBy: { order: "asc" } } } } },
  });
}

/** The next day in the rotation: the one after the most recently completed session. */
export async function nextWorkoutDay(userId: string, plan: PlanWithDays) {
  const last = await db.workoutSession.findFirst({
    where: { userId, planId: plan.id, status: "COMPLETED", dayId: { not: null } },
    orderBy: [{ date: "desc" }, { startedAt: "desc" }],
    include: { day: true },
  });
  const lastIdx = last?.day?.dayIndex ?? -1;
  const next = plan.days[(lastIdx + 1) % plan.days.length];
  return { day: next, lastSessionDate: last?.date ?? null };
}

export interface ExerciseBrief {
  id: string;
  name: string;
  muscleGroup: string;
  sets: number;
  repMin: number;
  repMax: number;
  restSec: number;
  targetRpe: number;
  technique: string;
  progression: string;
  previous: { date: string; sets: SetResult[] } | null;
  prescription: Prescription;
}

/** Pull the last two sessions of an exercise and derive the next prescription. */
async function briefFor(ctx: UserContext, ex: Exercise, today: string, missedInRow: number, hardWeeks: number): Promise<ExerciseBrief> {
  const rows = await db.workoutSet.findMany({
    where: { userId: ctx.userId, exerciseName: ex.name, date: { lt: today } },
    orderBy: [{ date: "desc" }, { setNumber: "asc" }],
    take: 40,
  });
  const dates = [...new Set(rows.map((r) => r.date))].slice(0, 2);
  const lastDate = dates[0] ?? null;
  const prev: SetResult[] = rows.filter((r) => r.date === lastDate).map((r) => ({ weightKg: r.weightKg, reps: r.reps, rpe: r.rpe }));
  const recentTopRpe = dates.map((d) => Math.max(0, ...rows.filter((r) => r.date === d).map((r) => r.rpe ?? 0))).filter((x) => x > 0);
  const incrementKg = /Squat|Leg Press|Deadlift|Hip Thrust/.test(ex.name) ? 5 : /Dumbbell|Curl|Raise|Fly|Extension/.test(ex.name) ? 2 : 2.5;
  const prescription = prescribeNext({
    repMin: ex.repMin,
    repMax: ex.repMax,
    numSets: ex.sets,
    targetRpe: ex.targetRpe,
    incrementKg,
    lastSession: prev,
    missedInRow,
    hardWeeks,
    recentTopRpe,
  });
  return {
    id: ex.id,
    name: ex.name,
    muscleGroup: ex.muscleGroup,
    sets: ex.sets,
    repMin: ex.repMin,
    repMax: ex.repMax,
    restSec: ex.restSec,
    targetRpe: ex.targetRpe,
    technique: ex.technique,
    progression: ex.progression,
    previous: lastDate ? { date: lastDate, sets: prev } : null,
    prescription,
  };
}

/** Consecutive recent training weeks whose average RPE was ≥ 8.5. */
async function hardWeekStreak(userId: string, today: string): Promise<number> {
  const sets = await db.workoutSet.findMany({ where: { userId, date: { gte: addDays(today, -21), lt: today }, rpe: { not: null } }, select: { date: true, rpe: true } });
  let streak = 0;
  for (let w = 0; w < 3; w++) {
    const from = addDays(today, -7 * (w + 1));
    const to = addDays(today, -7 * w);
    const wk = sets.filter((s) => s.date >= from && s.date < to);
    if (!wk.length) break;
    const avg = wk.reduce((t, s) => t + (s.rpe ?? 0), 0) / wk.length;
    if (avg >= 8.5) streak++;
    else break;
  }
  return streak;
}

export async function getTodaysWorkout(ctx: UserContext) {
  const plan = await getActivePlan(ctx.userId);
  if (!plan || !plan.days.length) return null;
  const { day, lastSessionDate } = await nextWorkoutDay(ctx.userId, plan);
  const perSessionGap = 7 / Math.max(1, plan.daysPerWeek);
  const daysSince = lastSessionDate ? daysBetween(lastSessionDate, ctx.today) : 0;
  const missedInRow = lastSessionDate ? Math.max(0, Math.floor(daysSince / (perSessionGap * 1.8)) ) : 0;
  const hardWeeks = await hardWeekStreak(ctx.userId, ctx.today);
  const exercises = await Promise.all(day.exercises.map((e) => briefFor(ctx, e, ctx.today, missedInRow, hardWeeks)));
  const done = await db.workoutSession.findFirst({ where: { userId: ctx.userId, date: ctx.today, status: "COMPLETED" } });
  const inProgress = await db.workoutSession.findFirst({ where: { userId: ctx.userId, date: ctx.today, status: "IN_PROGRESS" }, include: { sets: { orderBy: { createdAt: "asc" } } } });
  return {
    plan: { id: plan.id, name: plan.name, daysPerWeek: plan.daysPerWeek },
    day: { id: day.id, name: day.name, focus: day.focus, dayIndex: day.dayIndex },
    exercises,
    completedToday: !!done,
    inProgress,
    deloadSuggested: exercises.some((e) => e.prescription.deload),
    lastSessionDate,
  };
}

/** Weekly hard sets per muscle vs MEV/MRV. */
export async function volumeLandmarks(ctx: UserContext) {
  const from = addDays(ctx.today, -6);
  const sets = await db.workoutSet.findMany({ where: { userId: ctx.userId, date: { gte: from, lte: ctx.today } }, select: { exerciseName: true, rpe: true } });
  if (!sets.length) return [];
  const exs = await db.exercise.findMany({ where: { userId: ctx.userId }, select: { name: true, muscleGroup: true }, distinct: ["name"] });
  const group = new Map(exs.map((e) => [e.name, e.muscleGroup]));
  const hard = weeklyHardSets(sets.filter((s) => group.has(s.exerciseName)).map((s) => ({ muscleGroup: group.get(s.exerciseName)!, rpe: s.rpe })));
  return Object.entries(hard).map(([muscle, n]) => ({ muscle, hardSets: n, ...volumeStatus(muscle, n) }));
}

/** Best estimated 1RM per exercise, with the date it was set (for the Progress page). */
export async function strengthProgress(userId: string) {
  const sets = await db.workoutSet.findMany({ where: { userId }, orderBy: { date: "asc" }, select: { exerciseName: true, date: true, weightKg: true, reps: true } });
  const byEx = new Map<string, Map<string, SetResult[]>>();
  for (const s of sets) {
    const m = byEx.get(s.exerciseName) ?? new Map<string, SetResult[]>();
    const arr = m.get(s.date) ?? [];
    arr.push({ weightKg: s.weightKg, reps: s.reps });
    m.set(s.date, arr);
    byEx.set(s.exerciseName, m);
  }
  return [...byEx.entries()].map(([exercise, days]) => ({
    exercise,
    points: [...days.entries()].map(([date, ss]) => ({ date, est1rm: robust1RM(ss) })).filter((p) => p.est1rm != null) as { date: string; est1rm: number }[],
  }));
}
