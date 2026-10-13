import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { addDays, isDateStr, startOfWeek } from "@/lib/dates";
import { epley1RM, robust1RM } from "@/lib/engines/overload";
import { generatePlan, type PlanRequest } from "@/lib/engines/workoutPlan";
import { validateCalorieTarget } from "@/lib/engines/safety";
import { loadUserContext, type UserContext } from "./context";
import { getDaySummary, getRangeDaily, getTrend } from "./summary";
import { remember } from "./memory";

/**
 * The ONLY way the AI layer touches the database. Each tool has a Zod schema; arguments are validated
 * before anything runs, every query is scoped to the authenticated user, and there is no raw SQL.
 */

const date = z.string().refine(isDateStr, "date must be YYYY-MM-DD");
const meal = z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]);
const confidence = z.enum(["HIGH", "MEDIUM", "LOW"]);

export const foodEntryInput = z.object({
  food: z.string().min(1).max(120),
  foodItemId: z.string().optional(),
  quantity: z.number().positive().max(100_000),
  unit: z.string().max(30),
  grams: z.number().nonnegative().max(100_000).optional(),
  prep: z.string().max(60).nullable().optional(),
  calories: z.number().min(0).max(20_000),
  protein: z.number().min(0).max(2_000),
  carbs: z.number().min(0).max(3_000),
  fat: z.number().min(0).max(2_000),
  fiber: z.number().min(0).max(500).default(0),
  sodium: z.number().min(0).max(100_000).default(0),
  micros: z.record(z.number()).default({}),
  confidence,
  estimateMin: z.number().min(0),
  estimateMax: z.number().min(0),
  assumptions: z.array(z.string().max(300)).max(12).default([]),
  uncertaintySources: z.array(z.string().max(200)).max(12).default([]),
  notes: z.string().max(500).nullable().optional(),
});

const tools = {
  log_food: {
    schema: z.object({ date, meal, source: z.enum(["VOICE", "TEXT", "MANUAL", "PLAN"]).default("TEXT"), entries: z.array(foodEntryInput).min(1).max(30) }),
    async run(ctx: UserContext, a: { date: string; meal: z.infer<typeof meal>; source: "VOICE" | "TEXT" | "MANUAL" | "PLAN"; entries: z.infer<typeof foodEntryInput>[] }) {
      const ids: string[] = [];
      await db.$transaction(async (tx) => {
        for (const e of a.entries) {
          const row = await tx.foodEntry.create({
            data: {
              userId: ctx.userId,
              date: a.date,
              meal: a.meal,
              source: a.source,
              food: e.food,
              foodItemId: e.foodItemId ?? null,
              quantity: e.quantity,
              unit: e.unit,
              grams: e.grams ?? null,
              prep: e.prep ?? null,
              calories: e.calories,
              protein: e.protein,
              carbs: e.carbs,
              fat: e.fat,
              fiber: e.fiber,
              sodium: e.sodium,
              micros: e.micros as Prisma.InputJsonValue,
              confidence: e.confidence,
              estimateMin: e.estimateMin,
              estimateMax: e.estimateMax,
              assumptions: e.assumptions as Prisma.InputJsonValue,
              uncertaintySources: e.uncertaintySources as Prisma.InputJsonValue,
              notes: e.notes ?? null,
            },
          });
          ids.push(row.id);
          if (e.foodItemId) await tx.foodItem.updateMany({ where: { id: e.foodItemId }, data: { useCount: { increment: 1 } } });
        }
      });
      return { ids };
    },
  },

  log_weight: {
    schema: z.object({ date, weightKg: z.number().min(25).max(400), time: z.string().max(8).optional(), conditions: z.string().max(200).optional() }),
    async run(ctx: UserContext, a: { date: string; weightKg: number; time?: string; conditions?: string }) {
      const row = await db.weightEntry.upsert({
        where: { userId_date: { userId: ctx.userId, date: a.date } },
        update: { weightKg: a.weightKg, time: a.time ?? null, conditions: a.conditions ?? null },
        create: { userId: ctx.userId, date: a.date, weightKg: a.weightKg, time: a.time ?? null, conditions: a.conditions ?? null },
      });
      if (!ctx.profile.startWeightKg) {
        await db.userProfile.update({ where: { userId: ctx.userId }, data: { startWeightKg: a.weightKg, startDate: a.date } });
      }
      return { id: row.id };
    },
  },

  log_activity: {
    schema: z.object({
      date,
      type: z.enum(["STEPS", "GYM", "CYCLING", "WALKING", "RUNNING", "OTHER"]),
      steps: z.number().int().min(0).max(100_000).optional(),
      durationMin: z.number().int().min(1).max(600).optional(),
      distanceKm: z.number().min(0).max(500).optional(),
      intensity: z.enum(["LIGHT", "MODERATE", "HARD"]).optional(),
      notes: z.string().max(300).optional(),
    }),
    async run(ctx: UserContext, a: { date: string; type: "STEPS" | "GYM" | "CYCLING" | "WALKING" | "RUNNING" | "OTHER"; steps?: number; durationMin?: number; distanceKm?: number; intensity?: "LIGHT" | "MODERATE" | "HARD"; notes?: string }) {
      // Steps are a daily total: replace rather than stack a second STEPS row.
      if (a.type === "STEPS") {
        const existing = await db.activityEntry.findFirst({ where: { userId: ctx.userId, date: a.date, type: "STEPS" } });
        if (existing) {
          const row = await db.activityEntry.update({ where: { id: existing.id }, data: { steps: a.steps ?? existing.steps } });
          return { id: row.id };
        }
      }
      const row = await db.activityEntry.create({ data: { userId: ctx.userId, ...a } });
      return { id: row.id };
    },
  },

  log_sleep: {
    schema: z.object({ date, hours: z.number().min(0.5).max(18), quality: z.number().int().min(1).max(5).optional(), bedtime: z.string().max(8).optional() }),
    async run(ctx: UserContext, a: { date: string; hours: number; quality?: number; bedtime?: string }) {
      const row = await db.sleepEntry.upsert({
        where: { userId_date: { userId: ctx.userId, date: a.date } },
        update: { hours: a.hours, quality: a.quality ?? null, bedtime: a.bedtime ?? null },
        create: { userId: ctx.userId, date: a.date, hours: a.hours, quality: a.quality ?? null, bedtime: a.bedtime ?? null },
      });
      return { id: row.id };
    },
  },

  log_water: {
    schema: z.object({ date, ml: z.number().int().min(50).max(10_000) }),
    async run(ctx: UserContext, a: { date: string; ml: number }) {
      const row = await db.dailyLog.upsert({
        where: { userId_date: { userId: ctx.userId, date: a.date } },
        update: { waterMl: { increment: a.ml } },
        create: { userId: ctx.userId, date: a.date, waterMl: a.ml },
      });
      return { id: row.id, totalMl: row.waterMl };
    },
  },

  log_produce: {
    // Deltas, so the UI's "−" button can undo a mis-tap. The stored total never goes below 0.
    schema: z.object({ date, vegServings: z.number().min(-20).max(20).optional(), fruitServings: z.number().min(-20).max(20).optional() }),
    async run(ctx: UserContext, a: { date: string; vegServings?: number; fruitServings?: number }) {
      const cur = await db.dailyLog.findUnique({ where: { userId_date: { userId: ctx.userId, date: a.date } } });
      const clamp = (n: number) => Math.min(40, Math.max(0, Math.round(n * 10) / 10));
      const vegServings = clamp((cur?.vegServings ?? 0) + (a.vegServings ?? 0));
      const fruitServings = clamp((cur?.fruitServings ?? 0) + (a.fruitServings ?? 0));
      const row = await db.dailyLog.upsert({
        where: { userId_date: { userId: ctx.userId, date: a.date } },
        update: { vegServings, fruitServings },
        create: { userId: ctx.userId, date: a.date, vegServings, fruitServings },
      });
      return { id: row.id, vegServings: row.vegServings, fruitServings: row.fruitServings };
    },
  },

  log_measurement: {
    schema: z.object({
      date,
      waistCm: z.number().min(30).max(250).optional(),
      neckCm: z.number().min(20).max(80).optional(),
      hipCm: z.number().min(40).max(250).optional(),
      bodyFatPct: z.number().min(2).max(70).optional(),
      notes: z.string().max(300).optional(),
    }),
    async run(ctx: UserContext, a: { date: string; waistCm?: number; neckCm?: number; hipCm?: number; bodyFatPct?: number; notes?: string }) {
      const row = await db.bodyMeasurement.create({ data: { userId: ctx.userId, ...a } });
      return { id: row.id };
    },
  },

  log_note: {
    schema: z.object({ date, note: z.string().min(1).max(1000) }),
    async run(ctx: UserContext, a: { date: string; note: string }) {
      const row = await db.dailyLog.upsert({
        where: { userId_date: { userId: ctx.userId, date: a.date } },
        update: { notes: a.note },
        create: { userId: ctx.userId, date: a.date, notes: a.note },
      });
      return { id: row.id };
    },
  },

  log_workout_set: {
    schema: z.object({
      date,
      exerciseName: z.string().min(1).max(100),
      exerciseId: z.string().optional(),
      sessionId: z.string().optional(),
      setNumber: z.number().int().min(1).max(30).optional(),
      reps: z.number().int().min(1).max(100),
      weightKg: z.number().min(0).max(1000),
      rpe: z.number().min(1).max(10).optional(),
    }),
    async run(ctx: UserContext, a: { date: string; exerciseName: string; exerciseId?: string; sessionId?: string; setNumber?: number; reps: number; weightKg: number; rpe?: number }) {
      let sessionId = a.sessionId;
      if (!sessionId) {
        const open = await db.workoutSession.findFirst({ where: { userId: ctx.userId, date: a.date, status: "IN_PROGRESS" }, orderBy: { startedAt: "desc" } });
        sessionId = open?.id ?? (await db.workoutSession.create({ data: { userId: ctx.userId, date: a.date } })).id;
      } else {
        const owned = await db.workoutSession.findFirst({ where: { id: sessionId, userId: ctx.userId } });
        if (!owned) throw new Error("Unknown workout session");
      }
      const setNumber =
        a.setNumber ?? (await db.workoutSet.count({ where: { sessionId, exerciseName: a.exerciseName, userId: ctx.userId } })) + 1;
      const row = await db.workoutSet.create({
        data: {
          userId: ctx.userId,
          sessionId,
          exerciseId: a.exerciseId ?? null,
          date: a.date,
          exerciseName: a.exerciseName,
          setNumber,
          reps: a.reps,
          weightKg: a.weightKg,
          rpe: a.rpe ?? null,
          volume: Math.round(a.reps * a.weightKg * 10) / 10,
          est1rm: a.reps <= 12 && a.weightKg > 0 ? Math.round(epley1RM(a.weightKg, a.reps) * 10) / 10 : null,
        },
      });
      // Personal record check: heaviest robust 1RM estimate for this lift.
      const history = await db.workoutSet.findMany({ where: { userId: ctx.userId, exerciseName: a.exerciseName, id: { not: row.id } }, select: { weightKg: true, reps: true } });
      const prior = robust1RM(history.map((h) => ({ weightKg: h.weightKg, reps: h.reps })));
      const now = robust1RM([{ weightKg: a.weightKg, reps: a.reps }]);
      const isPr = !!now && (!prior || now > prior * 1.005) && history.length > 0;
      if (isPr) {
        await db.progressRecord.create({ data: { userId: ctx.userId, date: a.date, kind: "PR", title: `${a.exerciseName}: ${a.weightKg}kg × ${a.reps}`, data: { est1rm: now } } });
      }
      return { id: row.id, sessionId, setNumber, isPr };
    },
  },

  create_workout_plan: {
    schema: z.object({
      goal: z.enum(["FAT_LOSS", "MUSCLE_GAIN", "STRENGTH", "RECOMP", "MAINTAIN"]),
      experience: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
      daysPerWeek: z.number().int().min(2).max(6),
      sessionMinutes: z.number().int().min(30).max(120),
      equipment: z.enum(["FULL_GYM", "DUMBBELLS", "HOME", "BODYWEIGHT"]),
      injuries: z.string().max(300).nullable().optional(),
    }),
    async run(ctx: UserContext, a: PlanRequest) {
      const plan = generatePlan(a);
      const saved = await db.$transaction(async (tx) => {
        await tx.workoutPlan.updateMany({ where: { userId: ctx.userId, active: true }, data: { active: false } });
        const wp = await tx.workoutPlan.create({
          data: { userId: ctx.userId, name: plan.name, goal: a.goal, experience: a.experience, daysPerWeek: a.daysPerWeek, sessionMinutes: a.sessionMinutes, equipment: a.equipment, active: true },
        });
        for (const [i, d] of plan.days.entries()) {
          const day = await tx.workoutDay.create({ data: { userId: ctx.userId, planId: wp.id, dayIndex: i, name: d.name, focus: d.focus } });
          await tx.exercise.createMany({
            data: d.exercises.map((e, order) => ({
              userId: ctx.userId,
              dayId: day.id,
              order,
              name: e.name,
              muscleGroup: e.muscleGroup,
              sets: e.sets,
              repMin: e.repMin,
              repMax: e.repMax,
              restSec: e.restSec,
              targetRpe: e.targetRpe,
              technique: e.technique,
              progression: e.progression,
            })),
          });
        }
        return wp;
      });
      await db.userProfile.update({
        where: { userId: ctx.userId },
        data: { trainDaysPerWeek: a.daysPerWeek, sessionMinutes: a.sessionMinutes, equipment: a.equipment, experience: a.experience, injuries: a.injuries ?? null },
      });
      return { planId: saved.id, plan };
    },
  },

  get_daily_summary: {
    schema: z.object({ date }),
    async run(ctx: UserContext, a: { date: string }) {
      return getDaySummary(ctx, a.date);
    },
  },

  get_weekly_summary: {
    schema: z.object({ endDate: date }),
    async run(ctx: UserContext, a: { endDate: string }) {
      const from = addDays(a.endDate, -6);
      const days = await getRangeDaily(ctx.userId, from, a.endDate);
      const avg = (xs: (number | null)[]) => {
        const v = xs.filter((x): x is number => x != null);
        return v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10 : null;
      };
      return {
        from,
        to: a.endDate,
        daysLogged: days.filter((d) => d.calories != null).length,
        avgCalories: avg(days.map((d) => d.calories)),
        avgProtein: avg(days.map((d) => d.protein)),
        avgSteps: avg(days.map((d) => d.steps)),
        avgSleep: avg(days.map((d) => d.sleepH)),
        workouts: days.filter((d) => d.trainingMin > 0).length,
        totalVolume: days.reduce((s, d) => s + d.volume, 0),
        weighIns: days.filter((d) => d.weightKg != null).length,
        days,
        trend: await getTrend(ctx, a.endDate),
      };
    },
  },

  get_weight_trend: {
    schema: z.object({ asOf: date.optional() }),
    async run(ctx: UserContext, a: { asOf?: string }) {
      return getTrend(ctx, a.asOf ?? ctx.today);
    },
  },

  get_remaining_calories: {
    schema: z.object({ date }),
    async run(ctx: UserContext, a: { date: string }) {
      const s = await getDaySummary(ctx, a.date);
      return { remaining: s.remaining, eaten: s.totals, targets: s.targets };
    },
  },

  update_goal: {
    schema: z.object({
      calorieTarget: z.number().int().min(500).max(8000).optional(),
      proteinTargetG: z.number().int().min(20).max(500).optional(),
      fiberTargetG: z.number().int().min(5).max(100).optional(),
      stepTarget: z.number().int().min(1000).max(50_000).optional(),
      sleepTargetH: z.number().min(4).max(12).optional(),
      waterTargetMl: z.number().int().min(500).max(8000).optional(),
      targetWeightKg: z.number().min(25).max(400).optional(),
      type: z.enum(["FAT_LOSS", "MUSCLE_GAIN", "STRENGTH", "RECOMP", "MAINTAIN"]).optional(),
      targetRateKgPerWeek: z.number().min(0).max(1.5).optional(),
    }),
    async run(ctx: UserContext, a: Partial<Prisma.GoalUncheckedCreateInput> & { calorieTarget?: number }) {
      const warnings: string[] = [];
      const next = { ...a };
      if (a.calorieTarget != null) {
        const v = validateCalorieTarget(a.calorieTarget, ctx.profile.sex);
        if (!v.ok) {
          next.calorieTarget = v.calories;
          warnings.push(v.message!);
        }
      }
      const cur = ctx.goal;
      const data = {
        userId: ctx.userId,
        type: cur?.type ?? "FAT_LOSS",
        targetWeightKg: cur?.targetWeightKg ?? null,
        calorieTarget: cur?.calorieTarget ?? 2000,
        proteinTargetG: cur?.proteinTargetG ?? 120,
        fiberTargetG: cur?.fiberTargetG ?? 30,
        stepTarget: cur?.stepTarget ?? 8000,
        sleepTargetH: cur?.sleepTargetH ?? 7.5,
        waterTargetMl: cur?.waterTargetMl ?? 2500,
        targetRateKgPerWeek: cur?.targetRateKgPerWeek ?? 0.5,
        ...next,
        active: true,
        effectiveFrom: ctx.today,
      };
      const goal = await db.$transaction(async (tx) => {
        await tx.goal.updateMany({ where: { userId: ctx.userId, active: true }, data: { active: false } });
        return tx.goal.create({ data: data as Prisma.GoalUncheckedCreateInput });
      });
      return { goal, warnings };
    },
  },

  remember_preference: {
    schema: z.object({
      category: z.enum(["GOAL", "IDENTITY", "LIFESTYLE", "PREFERENCE", "EVENT", "HEALTH_HISTORY", "MOOD"]),
      key: z.string().min(1).max(60),
      value: z.string().min(1).max(300),
      source: z.enum(["EXPLICIT", "INFERRED"]).default("EXPLICIT"),
      confidence: z.number().min(0).max(1).optional(),
    }),
    async run(ctx: UserContext, a: { category: "GOAL" | "IDENTITY" | "LIFESTYLE" | "PREFERENCE" | "EVENT" | "HEALTH_HISTORY" | "MOOD"; key: string; value: string; source: "EXPLICIT" | "INFERRED"; confidence?: number }) {
      if (a.key.includes("conservative") || /conservative/i.test(a.value)) {
        await db.userProfile.update({ where: { userId: ctx.userId }, data: { conservativeEstimates: true } });
      }
      const m = await remember(ctx.userId, a);
      return { id: m.id };
    },
  },

  delete_entry: {
    schema: z.object({ kind: z.enum(["food", "weight", "activity", "sleep", "set", "measurement"]), id: z.string().min(1) }),
    async run(ctx: UserContext, a: { kind: "food" | "weight" | "activity" | "sleep" | "set" | "measurement"; id: string }) {
      const where = { id: a.id, userId: ctx.userId };
      const n =
        a.kind === "food" ? await db.foodEntry.deleteMany({ where })
        : a.kind === "weight" ? await db.weightEntry.deleteMany({ where })
        : a.kind === "activity" ? await db.activityEntry.deleteMany({ where })
        : a.kind === "sleep" ? await db.sleepEntry.deleteMany({ where })
        : a.kind === "set" ? await db.workoutSet.deleteMany({ where })
        : await db.bodyMeasurement.deleteMany({ where });
      return { deleted: n.count };
    },
  },

  edit_food_entry: {
    schema: z.object({
      id: z.string().min(1),
      quantity: z.number().positive().max(100_000).optional(),
      meal: meal.optional(),
      notes: z.string().max(500).optional(),
      /** Scale all nutrients when the quantity changes. */
      rescale: z.boolean().default(true),
    }),
    async run(ctx: UserContext, a: { id: string; quantity?: number; meal?: z.infer<typeof meal>; notes?: string; rescale: boolean }) {
      const cur = await db.foodEntry.findFirst({ where: { id: a.id, userId: ctx.userId } });
      if (!cur) throw new Error("Entry not found");
      const k = a.quantity && a.rescale ? a.quantity / cur.quantity : 1;
      const row = await db.foodEntry.update({
        where: { id: cur.id },
        data: {
          quantity: a.quantity ?? cur.quantity,
          meal: a.meal ?? cur.meal,
          notes: a.notes ?? cur.notes,
          calories: Math.round(cur.calories * k),
          protein: Math.round(cur.protein * k * 10) / 10,
          carbs: Math.round(cur.carbs * k * 10) / 10,
          fat: Math.round(cur.fat * k * 10) / 10,
          fiber: Math.round(cur.fiber * k * 10) / 10,
          sodium: Math.round(cur.sodium * k),
          estimateMin: Math.round(cur.estimateMin * k),
          estimateMax: Math.round(cur.estimateMax * k),
          grams: cur.grams ? Math.round(cur.grams * k) : null,
        },
      });
      return { id: row.id };
    },
  },
} as const;

export type ToolName = keyof typeof tools;
export const TOOL_NAMES = Object.keys(tools) as ToolName[];

/** Validate arguments, run the tool for this user, return its result. */
export async function callTool<N extends ToolName>(userId: string, name: N, rawArgs: unknown, ctxIn?: UserContext) {
  const tool = tools[name];
  if (!tool) throw new Error(`Unknown tool: ${String(name)}`);
  const parsed = tool.schema.safeParse(rawArgs);
  if (!parsed.success) {
    throw new Error(`Invalid arguments for ${name}: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
  }
  const ctx = ctxIn ?? (await loadUserContext(userId));
  // The cast bridges the union of per-tool schemas; each run() receives data its own schema validated.
  return (tool.run as (c: UserContext, a: unknown) => Promise<unknown>)(ctx, parsed.data) as Promise<Awaited<ReturnType<(typeof tools)[N]["run"]>>>;
}

export { startOfWeek };
