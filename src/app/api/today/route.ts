import { db } from "@/lib/db";
import { addDays, isDateStr } from "@/lib/dates";
import { json, requireUser, route } from "@/server/api";
import { loadUserContext } from "@/server/context";
import { calorieAdviceFor, coachNote, dietQuality, nutritionSuggestion, recoveryNote, weeklyConsistency } from "@/server/insight";
import { maybeCalibrate } from "@/server/calibration";
import { getDaySummary, getRangeDaily, getTrend } from "@/server/summary";
import { getTodaysWorkout } from "@/server/workouts";

export const dynamic = "force-dynamic";

/** Everything the Today screen needs in one round trip. LLM-free, so it's fast and always available. */
export const GET = route(async (req) => {
  const userId = await requireUser();
  const ctx = await loadUserContext(userId);
  const q = new URL(req.url).searchParams.get("date");
  const date = q && isDateStr(q) ? q : ctx.today;

  const [summary, trend, week, workout, yesterday, favourites] = await Promise.all([
    getDaySummary(ctx, date),
    getTrend(ctx, date),
    getRangeDaily(userId, addDays(date, -6), date),
    getTodaysWorkout(ctx),
    getDaySummary(ctx, addDays(date, -1)),
    db.foodEntry.groupBy({ by: ["food"], where: { userId }, _count: { food: true }, orderBy: { _count: { food: "desc" } }, take: 12 }),
  ]);
  void maybeCalibrate(ctx).catch(() => null);

  const [quality, consistency, advice, recovery] = await Promise.all([dietQuality(ctx), weeklyConsistency(ctx), calorieAdviceFor(ctx, trend), recoveryNote(ctx)]);
  const user = await db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });

  return json({
    date,
    today: ctx.today,
    user,
    profile: {
      onboarded: ctx.profile.onboarded,
      unitSystem: ctx.profile.unitSystem,
      ttsEnabled: ctx.profile.ttsEnabled,
      timezone: ctx.tz,
      sex: ctx.profile.sex,
      heightCm: ctx.profile.heightCm,
      startWeightKg: ctx.profile.startWeightKg,
    },
    goal: ctx.goal,
    summary,
    yesterdayWeightKg: yesterday.weight?.kg ?? null,
    trend,
    workout: workout && { plan: workout.plan, day: workout.day, completedToday: workout.completedToday, exerciseCount: workout.exercises.length, deloadSuggested: workout.deloadSuggested, inProgress: !!workout.inProgress },
    coachNote: coachNote({ trend, today: summary, week, ctx }),
    nutritionSuggestion: nutritionSuggestion(summary, favourites.map((f) => f.food), ctx.profile.foodsAvoided, ctx.profile.mealsPerDay),
    dietQuality: quality,
    consistency,
    calorieAdvice: advice,
    recovery,
    weeklyDays: week,
  });
});
