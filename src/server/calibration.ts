import { db } from "@/lib/db";
import { addDays, daysBetween } from "@/lib/dates";
import { calibrate } from "@/lib/engines/estimation";
import { bmr, estimateDailyExpenditure } from "@/lib/engines/calories";
import type { UserContext } from "./context";
import { getRangeDaily, getTrend } from "./summary";

const WINDOW = 14;

/**
 * 14-day calibration loop: compare what was logged with what the weight trend says really happened, and
 * nudge the estimation bias slightly. Runs at most once per window and only with dense logging.
 */
export async function maybeCalibrate(ctx: UserContext): Promise<{ changed: boolean; message: string } | null> {
  const p = ctx.profile;
  if (!p.sex || !p.heightCm || !ctx.ageYears) return null;
  const last = await db.progressRecord.findFirst({ where: { userId: ctx.userId, kind: "CALIBRATION" }, orderBy: { date: "desc" } });
  if (last && daysBetween(last.date, ctx.today) < WINDOW) return null;

  const from = addDays(ctx.today, -(WINDOW - 1));
  const days = await getRangeDaily(ctx.userId, from, ctx.today);
  const logged = days.filter((d) => d.calories != null);
  if (logged.length < Math.ceil(WINDOW * 0.7)) return null;
  const trend = await getTrend(ctx);
  if (trend.status === "INSUFFICIENT_DATA" || trend.weeklyRateKg == null) return null;

  const wKg = trend.ma14 ?? trend.latest?.weightKg ?? p.startWeightKg;
  if (!wKg) return null;
  const base = bmr(p.sex, wKg, p.heightCm, ctx.ageYears);
  const tdee =
    days.reduce((s, d) => s + estimateDailyExpenditure({ bmrKcal: base, weightKg: wKg, steps: d.steps ?? 0, trainingMinutes: d.trainingMin }).mid, 0) / days.length;

  const res = calibrate({
    avgLoggedKcal: logged.reduce((s, d) => s + (d.calories ?? 0), 0) / logged.length,
    daysLogged: logged.length,
    windowDays: WINDOW,
    tdeeEstimate: tdee,
    observedChangeKg: (trend.weeklyRateKg * WINDOW) / 7,
    currentBias: p.calorieBias,
  });
  await db.progressRecord.create({ data: { userId: ctx.userId, date: ctx.today, kind: "CALIBRATION", title: "14-day estimate calibration", data: { ...res, tdee: Math.round(tdee) } } });
  if (res.changed) await db.userProfile.update({ where: { userId: ctx.userId }, data: { calorieBias: res.bias } });
  return res;
}
