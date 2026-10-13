import { z } from "zod";
import { db } from "@/lib/db";
import { calorieFloor, startingTargets } from "@/lib/engines/calories";
import { validateCalorieTarget } from "@/lib/engines/safety";
import { generatePlan } from "@/lib/engines/workoutPlan";
import { json, requireUser, route } from "@/server/api";
import { loadUserContext } from "@/server/context";
import { callTool } from "@/server/tools";

const ACTIVITY: Record<string, number> = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };

const schema = z.object({
  action: z.enum(["preview", "save"]),
  sex: z.enum(["FEMALE", "MALE"]),
  birthYear: z.number().int().min(1920).max(new Date().getFullYear() - 13),
  heightCm: z.number().min(100).max(250),
  weightKg: z.number().min(25).max(400),
  targetWeightKg: z.number().min(25).max(400).optional(),
  goal: z.enum(["FAT_LOSS", "MUSCLE_GAIN", "STRENGTH", "RECOMP", "MAINTAIN"]),
  activity: z.enum(["sedentary", "light", "moderate", "active"]).default("light"),
  trainDays: z.number().int().min(2).max(6),
  sessionMinutes: z.number().int().min(30).max(120).default(60),
  equipment: z.enum(["FULL_GYM", "DUMBBELLS", "HOME", "BODYWEIGHT"]).default("FULL_GYM"),
  experience: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).default("BEGINNER"),
  injuries: z.string().max(300).nullish(),
  foodsAvoided: z.array(z.string().max(40)).max(30).default([]),
  mealsPerDay: z.number().int().min(1).max(8).default(3),
  unitSystem: z.enum(["METRIC", "IMPERIAL"]).default("METRIC"),
  timezone: z.string().max(64).default("UTC"),
  rateKgPerWeek: z.number().min(0.1).max(1).optional(),
  /** User edits to the proposed plan. */
  overrides: z.object({ calories: z.number().int().optional(), proteinG: z.number().int().optional(), steps: z.number().int().optional() }).optional(),
  createPlan: z.boolean().default(true),
});

/** Two-step: `preview` returns the proposed starting plan (editable); `save` persists it, the first weigh-in and a workout plan. */
export const POST = route(async (req) => {
  const userId = await requireUser();
  const b = schema.parse(await req.json());
  const age = new Date().getFullYear() - b.birthYear;
  const t = startingTargets({ sex: b.sex, weightKg: b.weightKg, heightCm: b.heightCm, ageYears: age, activityMultiplier: ACTIVITY[b.activity], goal: b.goal, targetRateKgPerWeek: b.rateKgPerWeek });

  const warnings: string[] = [];
  let calories = t.calories;
  if (b.overrides?.calories) {
    const v = validateCalorieTarget(b.overrides.calories, b.sex);
    calories = v.calories;
    if (!v.ok) warnings.push(v.message!);
  }
  if (t.clamped) warnings.push(`Your numbers would put you under ${calorieFloor(b.sex)} kcal/day, so I've held the target at that floor.`);
  const proteinG = b.overrides?.proteinG ?? t.proteinG;
  const steps = b.overrides?.steps ?? t.steps;
  const weeksToGoal = b.targetWeightKg && t.weeklyRateKg > 0 && b.goal === "FAT_LOSS" ? Math.ceil(Math.max(0, b.weightKg - b.targetWeightKg) / t.weeklyRateKg) : null;
  const plan = generatePlan({ goal: b.goal, experience: b.experience, daysPerWeek: b.trainDays, sessionMinutes: b.sessionMinutes, equipment: b.equipment, injuries: b.injuries });

  const preview = {
    calories, proteinG, fiberG: t.fiberG, steps, tdee: t.tdee, weeklyRateKg: t.weeklyRateKg, weeksToGoal, warnings,
    mealStructure: `${b.mealsPerDay} meals a day, about ${Math.round(calories / b.mealsPerDay)} kcal and ${Math.round(proteinG / b.mealsPerDay)} g protein each.`,
    schedule: plan.days.map((d) => ({ name: d.name, focus: d.focus })),
    note: "These are starting estimates, not medical advice. I'll adjust only after about 14 days of data.",
  };
  if (b.action === "preview") return json({ preview });

  await db.userProfile.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
  await db.userProfile.update({
    where: { userId },
    data: {
      sex: b.sex, birthYear: b.birthYear, heightCm: b.heightCm, startWeightKg: b.weightKg, activityLevel: ACTIVITY[b.activity], unitSystem: b.unitSystem, timezone: b.timezone,
      experience: b.experience, trainDaysPerWeek: b.trainDays, sessionMinutes: b.sessionMinutes, equipment: b.equipment, injuries: b.injuries ?? null,
      foodsAvoided: b.foodsAvoided, mealsPerDay: b.mealsPerDay, onboarded: true,
    },
  });
  const ctx = await loadUserContext(userId);
  await db.userProfile.update({ where: { userId }, data: { startDate: ctx.today } });
  const fresh = await loadUserContext(userId);
  await callTool(userId, "update_goal", { type: b.goal, calorieTarget: calories, proteinTargetG: proteinG, fiberTargetG: t.fiberG, stepTarget: steps, targetWeightKg: b.targetWeightKg, targetRateKgPerWeek: t.weeklyRateKg > 0 ? t.weeklyRateKg : undefined }, fresh);
  await callTool(userId, "log_weight", { date: fresh.today, weightKg: b.weightKg, conditions: "onboarding" }, fresh);
  if (b.createPlan) await callTool(userId, "create_workout_plan", { goal: b.goal, experience: b.experience, daysPerWeek: b.trainDays, sessionMinutes: b.sessionMinutes, equipment: b.equipment, injuries: b.injuries ?? null }, fresh);
  return json({ saved: true, preview });
});
