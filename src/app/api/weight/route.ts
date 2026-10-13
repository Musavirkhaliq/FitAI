import { db } from "@/lib/db";
import { addDays } from "@/lib/dates";
import { estimateFatLost, navyBodyFat } from "@/lib/engines/bodycomp";
import { trendSeries } from "@/lib/engines/weightTrend";
import { json, requireUser, route } from "@/server/api";
import { loadUserContext } from "@/server/context";
import { calorieAdviceFor } from "@/server/insight";
import { getTrend, getWeightPoints } from "@/server/summary";

export const dynamic = "force-dynamic";

/** GET /api/weight?days=90 → weigh-ins, MA series, trend verdict, measurements, body-fat range, calorie advice. */
export const GET = route(async (req) => {
  const userId = await requireUser();
  const ctx = await loadUserContext(userId);
  const days = Math.min(730, Math.max(7, Number(new URL(req.url).searchParams.get("days")) || 90));
  const from = addDays(ctx.today, -(days - 1));
  const [points, trend, measurements, entries] = await Promise.all([
    getWeightPoints(userId, from, ctx.today),
    getTrend(ctx),
    db.bodyMeasurement.findMany({ where: { userId, date: { gte: from } }, orderBy: { date: "asc" } }),
    db.weightEntry.findMany({ where: { userId, date: { gte: from } }, orderBy: { date: "desc" }, take: 60 }),
  ]);
  const latestM = [...measurements].reverse().find((m) => m.waistCm && m.neckCm);
  const w = trend.latest?.weightKg ?? ctx.profile.startWeightKg;
  const bodyFat =
    latestM && ctx.profile.heightCm && w
      ? navyBodyFat({ sex: ctx.profile.sex, heightCm: ctx.profile.heightCm, waistCm: latestM.waistCm!, neckCm: latestM.neckCm!, hipCm: latestM.hipCm, weightKg: w })
      : null;
  return json({
    series: trendSeries(points),
    trend,
    entries,
    measurements,
    bodyFat,
    bodyFatDate: latestM?.date ?? null,
    fatLostEstimate: trend.changeFromStartKg != null ? estimateFatLost(trend.changeFromStartKg) : null,
    startWeightKg: ctx.profile.startWeightKg,
    targetWeightKg: ctx.goal?.targetWeightKg ?? null,
    calorieAdvice: await calorieAdviceFor(ctx, trend),
    protocol: "Weigh in after waking, after the bathroom, before food or drink, on the same scale, in similar clothing (or none).",
  });
});
