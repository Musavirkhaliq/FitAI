import { z } from "zod";
import { db } from "@/lib/db";
import { weekday } from "@/lib/dates";
import { json, requireUser, route } from "@/server/api";
import { loadUserContext } from "@/server/context";
import { getDaySummary } from "@/server/summary";
import { getTodaysWorkout } from "@/server/workouts";

export const dynamic = "force-dynamic";

function localHour(tz: string): number {
  try {
    return Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).format(new Date())) % 24;
  } catch {
    return new Date().getUTCHours();
  }
}

/**
 * GET → in-app reminders that are due right now (each reminder type can be switched off in Settings), plus unread
 * history. A reminder is created at most once per day per kind. The client may also surface them via the Notification API.
 */
export const GET = route(async () => {
  const userId = await requireUser();
  const ctx = await loadUserContext(userId);
  const enabled = { weighIn: true, workout: true, protein: true, steps: true, sleep: true, weeklyReview: true, ...(ctx.profile.reminders as Record<string, boolean>) };
  const hour = localHour(ctx.tz);
  const s = await getDaySummary(ctx, ctx.today);
  const due: { kind: string; title: string; body: string }[] = [];

  if (enabled.weighIn && hour >= 6 && hour < 12 && !s.weight) due.push({ kind: "WEIGH_IN", title: "Morning weigh-in", body: "After waking and the bathroom, before food or drink, same scale." });
  if (enabled.workout && hour >= 15 && hour < 21 && !s.activity.trainingMin) {
    const wk = await getTodaysWorkout(ctx);
    if (wk && !wk.completedToday) due.push({ kind: "WORKOUT", title: "Workout time", body: `${wk.day.name} is next in your plan.` });
  }
  if (enabled.protein && hour >= 17 && ctx.goal && s.totals.protein < ctx.goal.proteinTargetG * 0.6) due.push({ kind: "PROTEIN", title: "Protein check", body: `You're at ${Math.round(s.totals.protein)} g of ${ctx.goal.proteinTargetG} g. A protein-rich dinner would close the gap.` });
  if (enabled.steps && hour >= 17 && ctx.goal && s.activity.steps < ctx.goal.stepTarget * 0.5) due.push({ kind: "STEPS", title: "Steps", body: `${s.activity.steps.toLocaleString()} of ${ctx.goal.stepTarget.toLocaleString()} so far. A short walk helps.` });
  if (enabled.sleep && hour >= 21) due.push({ kind: "SLEEP", title: "Wind down", body: "An earlier night makes tomorrow's training and appetite easier." });
  if (enabled.weeklyReview && weekday(ctx.today) === 0 && hour >= 17) due.push({ kind: "WEEKLY_REVIEW", title: "Weekly review", body: "Ask your coach: “How am I doing this week?”" });

  const startOfDay = new Date(Date.now() - 24 * 3600_000);
  for (const d of due) {
    const exists = await db.notification.findFirst({ where: { userId, kind: d.kind, createdAt: { gte: startOfDay } } });
    if (!exists) await db.notification.create({ data: { userId, ...d, dueAt: new Date() } });
  }
  const notifications = await db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 30 });
  return json({ notifications, unread: notifications.filter((n) => !n.readAt).length, enabled });
});

export const PATCH = route(async (req) => {
  const userId = await requireUser();
  const { id, all } = z.object({ id: z.string().optional(), all: z.boolean().optional() }).parse(await req.json());
  await db.notification.updateMany({ where: { userId, readAt: null, ...(all ? {} : { id }) }, data: { readAt: new Date() } });
  return json({ ok: true });
});
