import { db } from "@/lib/db";
import { addDays, daysBetween, isDateStr, startOfWeek } from "@/lib/dates";
import { movingAverage, trendSeries } from "@/lib/engines/weightTrend";
import { HttpError, json, requireUser, route } from "@/server/api";
import { loadUserContext } from "@/server/context";
import { getRangeDaily, getWeightPoints, loggingAdherence } from "@/server/summary";
import { strengthProgress, volumeLandmarks } from "@/server/workouts";

export const dynamic = "force-dynamic";

const mean = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};

/** Pearson r over paired values; null if fewer than 4 pairs or no variance. */
function pearson(pairs: [number | null, number | null][]): number | null {
  const p = pairs.filter((x): x is [number, number] => x[0] != null && x[1] != null);
  if (p.length < 4) return null;
  const mx = mean(p.map((x) => x[0]))!;
  const my = mean(p.map((x) => x[1]))!;
  let num = 0, dx = 0, dy = 0;
  for (const [x, y] of p) {
    num += (x - mx) * (y - my);
    dx += (x - mx) ** 2;
    dy += (y - my) ** 2;
  }
  return dx && dy ? Math.round((num / Math.sqrt(dx * dy)) * 100) / 100 : null;
}

/** GET /api/analytics?from=&to= → daily rows, weekly buckets, correlations, strength, volume, waist trend. */
export const GET = route(async (req) => {
  const userId = await requireUser();
  const ctx = await loadUserContext(userId);
  const p = new URL(req.url).searchParams;
  const to = p.get("to") && isDateStr(p.get("to")) ? p.get("to")! : ctx.today;
  const from = p.get("from") && isDateStr(p.get("from")) ? p.get("from")! : addDays(to, -89);
  if (from > to) throw new HttpError(400, "from must be before to");
  if (daysBetween(from, to) > 730) throw new HttpError(400, "Pick a range under two years.");

  const [days, weights, measurements, strength, volume] = await Promise.all([
    getRangeDaily(userId, from, to),
    getWeightPoints(userId, addDays(from, -14), to),
    db.bodyMeasurement.findMany({ where: { userId, date: { gte: from, lte: to }, waistCm: { not: null } }, orderBy: { date: "asc" }, select: { date: true, waistCm: true } }),
    strengthProgress(userId),
    volumeLandmarks(ctx),
  ]);

  // Weekly buckets (Monday start). Weight change = change in the 7-day average across the week.
  const weeks = new Map<string, typeof days>();
  for (const d of days) {
    const k = startOfWeek(d.date);
    weeks.set(k, [...(weeks.get(k) ?? []), d]);
  }
  const weekly = [...weeks.entries()].map(([week, ds]) => {
    const end = ds[ds.length - 1].date;
    const ma = movingAverage(weights, end, 7);
    const maPrev = movingAverage(weights, addDays(end, -7), 7);
    return {
      week,
      avgCalories: round(mean(ds.map((d) => d.calories))),
      avgProtein: round(mean(ds.map((d) => d.protein))),
      avgSteps: round(mean(ds.map((d) => d.steps))),
      avgSleep: round(mean(ds.map((d) => d.sleepH)), 1),
      sessions: ds.filter((d) => d.trainingMin > 0 || d.volume > 0).length,
      volume: ds.reduce((s, d) => s + d.volume, 0),
      weightAvg: ma == null ? null : Math.round(ma * 10) / 10,
      weightChange: ma != null && maPrev != null ? Math.round((ma - maPrev) * 100) / 100 : null,
    };
  });

  const goal = ctx.goal;
  const logged = days.filter((d) => d.calories != null);
  return json({
    from,
    to,
    days,
    weekly,
    weightSeries: trendSeries(weights.filter((w) => w.date >= from)),
    waist: measurements,
    strength,
    volume,
    correlations: {
      caloriesVsWeightChange: pearson(weekly.map((w) => [w.avgCalories, w.weightChange])),
      proteinVsWeightChange: pearson(weekly.map((w) => [w.avgProtein, w.weightChange])),
      stepsVsWeightChange: pearson(weekly.map((w) => [w.avgSteps, w.weightChange])),
      sleepVsWeightChange: pearson(weekly.map((w) => [w.avgSleep, w.weightChange])),
      sessionsVsVolume: pearson(weekly.map((w) => [w.sessions, w.volume])),
      note: "Correlation is not causation, and weekly samples are small. Read these as hints.",
    },
    adherence: {
      loggingPct: Math.round(loggingAdherence(days) * 100),
      calorieTargetPct: goal && logged.length ? Math.round((logged.filter((d) => d.calories! <= goal.calorieTarget * 1.1).length / logged.length) * 100) : null,
      proteinTargetPct: goal && logged.length ? Math.round((logged.filter((d) => (d.protein ?? 0) >= goal.proteinTargetG * 0.9).length / logged.length) * 100) : null,
      stepTargetPct: goal ? Math.round((days.filter((d) => (d.steps ?? 0) >= goal.stepTarget * 0.8).length / days.length) * 100) : null,
    },
    targets: goal && { calories: goal.calorieTarget, protein: goal.proteinTargetG, steps: goal.stepTarget, sleepH: goal.sleepTargetH },
  });
});

function round(n: number | null, dp = 0) {
  if (n == null) return null;
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
