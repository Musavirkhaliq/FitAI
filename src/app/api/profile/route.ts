import { z } from "zod";
import { db } from "@/lib/db";
import { json, requireUser, route } from "@/server/api";
import { loadUserContext } from "@/server/context";
import { callTool } from "@/server/tools";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const userId = await requireUser();
  const ctx = await loadUserContext(userId);
  const user = await db.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
  return json({ user, profile: ctx.profile, goal: ctx.goal });
});

const reminders = z.object({
  weighIn: z.boolean(), workout: z.boolean(), protein: z.boolean(), steps: z.boolean(), sleep: z.boolean(), weeklyReview: z.boolean(),
}).partial();

const patch = z.object({
  name: z.string().trim().max(60).optional(),
  sex: z.enum(["FEMALE", "MALE"]).nullable().optional(),
  birthYear: z.number().int().min(1920).max(new Date().getFullYear() - 13).nullable().optional(),
  heightCm: z.number().min(100).max(250).nullable().optional(),
  unitSystem: z.enum(["METRIC", "IMPERIAL"]).optional(),
  timezone: z.string().max(64).optional(),
  experience: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).optional(),
  trainDaysPerWeek: z.number().int().min(1).max(7).optional(),
  sessionMinutes: z.number().int().min(20).max(180).optional(),
  equipment: z.enum(["FULL_GYM", "DUMBBELLS", "HOME", "BODYWEIGHT"]).optional(),
  injuries: z.string().max(300).nullable().optional(),
  foodsAvoided: z.array(z.string().max(40)).max(30).optional(),
  mealsPerDay: z.number().int().min(1).max(8).optional(),
  conservativeEstimates: z.boolean().optional(),
  ttsEnabled: z.boolean().optional(),
  activityLevel: z.number().min(1.1).max(2.2).optional(),
  reminders: reminders.optional(),
  goal: z.object({
    calorieTarget: z.number().int().optional(), proteinTargetG: z.number().int().optional(), fiberTargetG: z.number().int().optional(),
    stepTarget: z.number().int().optional(), sleepTargetH: z.number().optional(), waterTargetMl: z.number().int().optional(),
    targetWeightKg: z.number().optional(), type: z.enum(["FAT_LOSS", "MUSCLE_GAIN", "STRENGTH", "RECOMP", "MAINTAIN"]).optional(),
  }).optional(),
});

export const PATCH = route(async (req) => {
  const userId = await requireUser();
  const ctx = await loadUserContext(userId);
  const { name, goal, reminders: rem, ...profileFields } = patch.parse(await req.json());
  if (name !== undefined) await db.user.update({ where: { id: userId }, data: { name: name || null } });
  const data = { ...profileFields, ...(rem ? { reminders: { ...(ctx.profile.reminders as object), ...rem } } : {}) };
  if (Object.keys(data).length) await db.userProfile.update({ where: { userId }, data });
  let warnings: string[] = [];
  if (goal && Object.keys(goal).length) warnings = ((await callTool(userId, "update_goal", goal, ctx)) as { warnings: string[] }).warnings;
  const fresh = await loadUserContext(userId);
  return json({ profile: fresh.profile, goal: fresh.goal, warnings });
});

/** Permanently delete the account and every row it owns (all foreign keys cascade). */
export const DELETE = route(async (req) => {
  const userId = await requireUser();
  const confirm = new URL(req.url).searchParams.get("confirm");
  if (confirm !== "DELETE") return json({ error: "Pass ?confirm=DELETE to delete your account and all data." }, { status: 400 });
  await db.user.delete({ where: { id: userId } });
  return json({ deleted: true });
});
