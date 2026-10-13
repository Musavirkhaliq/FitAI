import { z } from "zod";
import { db } from "@/lib/db";
import { addDays } from "@/lib/dates";
import { findAlternative, type Equipment } from "@/lib/engines/workoutPlan";
import { HttpError, json, requireUser, route } from "@/server/api";
import { loadUserContext } from "@/server/context";
import { callTool } from "@/server/tools";
import { getActivePlan, getTodaysWorkout, strengthProgress, volumeLandmarks } from "@/server/workouts";

export const dynamic = "force-dynamic";

/** GET → today's workout (with overload prescriptions), the full active plan, weekly volume vs MEV/MRV, recent sessions. */
export const GET = route(async () => {
  const userId = await requireUser();
  const ctx = await loadUserContext(userId);
  const [today, plan, volume, sessions, strength, prs] = await Promise.all([
    getTodaysWorkout(ctx),
    getActivePlan(userId),
    volumeLandmarks(ctx),
    db.workoutSession.findMany({ where: { userId, date: { gte: addDays(ctx.today, -60) } }, orderBy: [{ date: "desc" }, { startedAt: "desc" }], take: 30, include: { sets: { orderBy: { createdAt: "asc" } }, day: { select: { name: true } } } }),
    strengthProgress(userId),
    db.progressRecord.findMany({ where: { userId, kind: "PR" }, orderBy: { date: "desc" }, take: 20 }),
  ]);
  return json({ today, plan, volume, sessions, strength, prs, profile: { equipment: ctx.profile.equipment, experience: ctx.profile.experience, trainDaysPerWeek: ctx.profile.trainDaysPerWeek, sessionMinutes: ctx.profile.sessionMinutes, injuries: ctx.profile.injuries } });
});

const generate = z.object({
  action: z.literal("generate"),
  goal: z.enum(["FAT_LOSS", "MUSCLE_GAIN", "STRENGTH", "RECOMP", "MAINTAIN"]),
  experience: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
  daysPerWeek: z.number().int().min(2).max(6),
  sessionMinutes: z.number().int().min(30).max(120),
  equipment: z.enum(["FULL_GYM", "DUMBBELLS", "HOME", "BODYWEIGHT"]),
  injuries: z.string().max(300).nullish(),
});
const start = z.object({ action: z.literal("start"), dayId: z.string().optional() });
const finish = z.object({ action: z.literal("finish"), sessionId: z.string(), notes: z.string().max(500).optional() });
const skip = z.object({ action: z.literal("skip"), sessionId: z.string() });
const swap = z.object({ action: z.literal("swap"), exerciseId: z.string() });
const body = z.discriminatedUnion("action", [generate, start, finish, skip, swap]);

export const POST = route(async (req) => {
  const userId = await requireUser();
  const ctx = await loadUserContext(userId);
  const b = body.parse(await req.json());

  switch (b.action) {
    case "generate": {
      const { action, ...args } = b;
      void action;
      return json(await callTool(userId, "create_workout_plan", args, ctx));
    }
    case "start": {
      const open = await db.workoutSession.findFirst({ where: { userId, date: ctx.today, status: "IN_PROGRESS" } });
      if (open) return json({ session: open });
      const wk = await getTodaysWorkout(ctx);
      const session = await db.workoutSession.create({ data: { userId, date: ctx.today, planId: wk?.plan.id ?? null, dayId: b.dayId ?? wk?.day.id ?? null } });
      return json({ session });
    }
    case "finish": {
      const s = await db.workoutSession.findFirst({ where: { id: b.sessionId, userId } });
      if (!s) throw new HttpError(404, "Session not found.");
      const mins = Math.max(1, Math.round((Date.now() - s.startedAt.getTime()) / 60_000));
      const updated = await db.workoutSession.update({ where: { id: s.id }, data: { status: "COMPLETED", endedAt: new Date(), durationMin: Math.min(mins, 240), notes: b.notes ?? s.notes } });
      const sets = await db.workoutSet.findMany({ where: { sessionId: s.id } });
      return json({ session: updated, totals: { sets: sets.length, volume: Math.round(sets.reduce((t, x) => t + x.volume, 0)) } });
    }
    case "skip": {
      const s = await db.workoutSession.updateMany({ where: { id: b.sessionId, userId }, data: { status: "SKIPPED", endedAt: new Date() } });
      return json({ skipped: s.count });
    }
    case "swap": {
      const ex = await db.exercise.findFirst({ where: { id: b.exerciseId, userId } });
      if (!ex) throw new HttpError(404, "Exercise not found.");
      const alt = findAlternative(ex.name, ctx.profile.equipment as Equipment, ctx.profile.injuries ?? "");
      if (!alt) throw new HttpError(404, "No suitable alternative found for your equipment.");
      const updated = await db.exercise.update({ where: { id: ex.id }, data: { name: alt.name, technique: alt.tip } });
      return json({ exercise: updated });
    }
  }
});
