import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { addDays } from "@/lib/dates";
import { LlmUnavailableError, type ChatMessage } from "@/lib/providers/llm";
import { adviseCalories, bmr, calorieFloor, estimateDailyExpenditure } from "@/lib/engines/calories";
import { navyBodyFat, estimateFatLost } from "@/lib/engines/bodycomp";
import { checkRapidLoss, checkTrainingLoad, classifyMessage, YELLOW_RESPONSE, RED_RESPONSE, type SafetyLevel } from "@/lib/engines/safety";
import { fitIntoBudget, substitute, suggestMeal } from "@/lib/engines/mealPlan";
import { findAlternative } from "@/lib/engines/workoutPlan";
import type { Equipment, Level, PlanGoal } from "@/lib/engines/workoutPlan";
import { consistencyScore, type DayHabits } from "@/lib/engines/habits";
import { lookupFood } from "@/lib/food/lookup";
import { computeFoodEstimate, needsBoneQuestion, type EstimatedFood, type ParsedFood, type MealTypeName } from "@/lib/food/portion";
import { loadUserContext, type UserContext } from "../context";
import { boneInPreference, memoryPrompt, relevantMemories, remember } from "../memory";
import { getDaySummary, getRangeDaily, getTrend, loggingAdherence, type DaySummary } from "../summary";
import { callTool } from "../tools";
import { getTodaysWorkout, strengthProgress } from "../workouts";
import { maybeCalibrate } from "../calibration";
import { classifyIntent, coachMessages, extractEntities, guessNutrition, streamText } from "./agents";
import { LOGGING_INTENTS, type Extraction, type Intent } from "./schemas";

export type Label = "FACT" | "ESTIMATE" | "ASSUMPTION" | "RECOMMENDATION";

export interface Card {
  kind: "food" | "weight" | "steps" | "sleep" | "water" | "activity" | "set" | "goal" | "memory" | "plan" | "workout" | "meal" | "note" | "measurement" | "info";
  title: string;
  lines: { label: Label; text: string }[];
  entry?: { kind: "food" | "weight" | "activity" | "sleep" | "set" | "measurement"; id: string };
  confidence?: "HIGH" | "MEDIUM" | "LOW";
  range?: [number, number];
}

export type PipelineEvent =
  | { type: "stage"; stage: string; label: string }
  | { type: "clarify"; question: string; options?: string[] }
  | { type: "cards"; cards: Card[] }
  | { type: "safety"; level: SafetyLevel; text: string }
  | { type: "token"; text: string }
  | { type: "workout_command"; action: "START_REST_TIMER" | "SKIP_EXERCISE" | "ADD_SET"; seconds?: number }
  | { type: "link"; href: string; label: string }
  | { type: "day"; summary: DaySummaryLite }
  | { type: "done"; messageId: string; text: string }
  | { type: "error"; message: string };

export interface DaySummaryLite {
  date: string;
  calories: number;
  caloriesRange: [number, number];
  protein: number;
  fiber: number;
  steps: number;
  sleepH: number | null;
  weightKg: number | null;
  water: number;
  trainingMin: number;
  targets: DaySummary["targets"];
  remaining: DaySummary["remaining"];
}

const lite = (s: DaySummary): DaySummaryLite => ({
  date: s.date,
  calories: Math.round(s.totals.calories),
  caloriesRange: [Math.round(s.totals.minKcal), Math.round(s.totals.maxKcal)],
  protein: Math.round(s.totals.protein),
  fiber: Math.round(s.totals.fiber),
  steps: s.activity.steps,
  sleepH: s.sleep?.hours ?? null,
  weightKg: s.weight?.kg ?? null,
  water: s.water,
  trainingMin: s.activity.trainingMin,
  targets: s.targets,
  remaining: s.remaining,
});

type Pending =
  | { kind: "bone"; foods: ParsedFood[]; meal: MealTypeName | null; date: string; conservative: boolean; source: "VOICE" | "TEXT" }
  | { kind: "apply_goal"; calorieTarget: number };

const PENDING_TTL_MS = 30 * 60_000;
const MSG_UNDERSTAND = "I had trouble understanding that. Could you rephrase, or type it instead?";

interface State {
  ctx: UserContext;
  text: string;
  source: "VOICE" | "TEXT";
  date: string;
  intents: Intent[];
  ext: Extraction | null;
  cards: Card[];
  facts: Record<string, unknown>;
  notes: string[]; // lines the coach must keep verbatim (safety etc.)
  problems: string[];
  clarify?: { question: string; options?: string[]; pending?: Pending };
  /** A suggested calorie change awaiting the user's "yes". */
  pendingApply?: Pending;
  loggedFood: boolean;
  loggedAnything: boolean;
  entryRefs: { kind: string; id: string }[];
  events: PipelineEvent[];
}

const has = (st: State, ...i: Intent[]) => i.some((x) => st.intents.includes(x));
const kg = (v: number, unit: "kg" | "lb") => (unit === "lb" ? Math.round(v * 0.45359237 * 10) / 10 : v);
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

function hourIn(tz: string): number {
  try {
    return Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).format(new Date())) % 24;
  } catch {
    return new Date().getUTCHours();
  }
}
function mealByTime(tz: string): MealTypeName {
  const h = hourIn(tz);
  return h < 11 ? "BREAKFAST" : h < 16 ? "LUNCH" : h < 21 ? "DINNER" : "SNACK";
}

async function recentHistory(userId: string): Promise<ChatMessage[]> {
  const rows = await db.aiConversation.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 6 });
  return rows.reverse().map((r) => ({ role: r.role === "assistant" ? "assistant" : "user", content: r.content.slice(0, 500) }));
}

async function loadPending(userId: string): Promise<Pending | null> {
  const last = await db.aiConversation.findFirst({ where: { userId, role: "assistant" }, orderBy: { createdAt: "desc" } });
  if (!last || Date.now() - last.createdAt.getTime() > PENDING_TTL_MS) return null;
  const meta = last.meta as { pending?: Pending } | null;
  return meta?.pending ?? null;
}

async function lastEntryRefs(userId: string): Promise<{ kind: string; id: string }[]> {
  const last = await db.aiConversation.findFirst({ where: { userId, role: "assistant" }, orderBy: { createdAt: "desc" } });
  const meta = last?.meta as { entryRefs?: { kind: string; id: string }[] } | null;
  return meta?.entryRefs ?? [];
}

// ─── Handlers (each only calls validated tools; none touches the DB directly for writes) ───────────

async function estimateFoods(st: State, foods: ParsedFood[]): Promise<EstimatedFood[]> {
  const { ctx } = st;
  const conservative = !!(st.ext?.conservative || ctx.profile.conservativeEstimates);
  const results = await Promise.all(
    foods.map(async (f) => {
      let hit = await lookupFood(f.name, ctx.userId, { state: f.state, boneIn: f.boneIn });
      let guessed = false;
      if (!hit || hit.score < 0.5) {
        const g = await guessNutrition(f.name);
        if (g) {
          hit = { food: g, score: 0.4, matchedName: g.name, branded: false, state: g.state, fromUser: false };
          guessed = true;
        }
      }
      if (!hit) return null;
      const est = computeFoodEstimate(f, hit, { bias: ctx.profile.calorieBias, conservative });
      if (guessed) est.assumptions.unshift(`I couldn't find "${f.name}" in the food databases, so this is an AI ballpark.`);
      return est;
    }),
  );
  const missing = foods.filter((_, i) => !results[i]).map((f) => f.name);
  if (missing.length) st.problems.push(`Couldn't find nutrition for: ${missing.join(", ")}. Ask the user for a rough calorie figure or a different name.`);
  return results.filter((r): r is EstimatedFood => r !== null);
}

function foodCard(e: EstimatedFood, id?: string): Card {
  const q = Number.isInteger(e.quantity) ? e.quantity : Math.round(e.quantity * 10) / 10;
  const lines: Card["lines"] = [
    { label: "ESTIMATE", text: `About ${fmt(e.calories)} kcal (range ${fmt(e.estimate.min)}–${fmt(e.estimate.max)}), ${Math.round(e.protein)} g protein, ${Math.round(e.carbs)} g carbs, ${Math.round(e.fat)} g fat. ${e.estimate.confidence} confidence.` },
  ];
  if (e.estimate.sources.length) lines.push({ label: "ESTIMATE", text: `Main uncertainty: ${e.estimate.sources.slice(0, 3).join("; ")}.` });
  for (const a of e.assumptions.slice(0, 3)) lines.push({ label: "ASSUMPTION", text: a });
  return { kind: "food", title: `${q} ${e.unit} ${e.name}${e.prep ? ` (${e.prep})` : ""}`, lines, entry: id ? { kind: "food", id } : undefined, confidence: e.estimate.confidence, range: [e.estimate.min, e.estimate.max] };
}

async function handleFoods(st: State, rawFoods: ParsedFood[]) {
  const { ctx } = st;
  const bone = await boneInPreference(ctx.userId);
  const inferredMeal = st.ext?.mealType ?? mealByTime(ctx.tz);
  const settled: ParsedFood[] = [];
  const ask: ParsedFood[] = [];
  for (const raw of rawFoods) {
    const f: ParsedFood = { ...raw, state: raw.state ?? null, boneIn: raw.boneIn ?? null, meal: raw.meal ?? inferredMeal };
    if (needsBoneQuestion(f, bone)) {
      ask.push(f);
      continue;
    }
    if (f.boneIn == null && bone !== null && /chicken|mutton|lamb|ribs|wing|leg|drumstick|pork/i.test(f.name) && /^(g|gram|grams|kg|oz|lb)s?$/i.test(f.unit)) {
      f.boneIn = bone;
    }
    settled.push(f);
  }

  if (settled.length) {
    st.events.push({ type: "stage", stage: "logging", label: "Logging your meal…" });
    const estimated = await estimateFoods(st, settled);
    const byMeal = new Map<MealTypeName, EstimatedFood[]>();
    for (const e of estimated) {
      const m = (e.meal ?? inferredMeal) as MealTypeName;
      byMeal.set(m, [...(byMeal.get(m) ?? []), e]);
    }
    for (const [meal, list] of byMeal) {
      const res = (await callTool(ctx.userId, "log_food", {
        date: st.date,
        meal,
        source: st.source,
        entries: list.map((e) => ({
          food: e.name,
          foodItemId: e.foodItemId,
          quantity: e.quantity,
          unit: e.unit,
          grams: e.grams,
          prep: e.prep,
          calories: e.calories,
          protein: e.protein,
          carbs: e.carbs,
          fat: e.fat,
          fiber: e.fiber,
          sodium: e.sodium,
          micros: e.micros,
          confidence: e.estimate.confidence,
          estimateMin: e.estimate.min,
          estimateMax: e.estimate.max,
          assumptions: e.assumptions,
          uncertaintySources: e.estimate.sources,
        })),
      }, ctx)) as { ids: string[] };
      list.forEach((e, i) => {
        st.cards.push(foodCard(e, res.ids[i]));
        st.entryRefs.push({ kind: "food", id: res.ids[i] });
      });
    }
    if (estimated.length) {
      st.loggedFood = true;
      st.loggedAnything = true;
      st.facts.loggedFoods = estimated.map((e) => ({
        food: e.name, qty: `${e.quantity} ${e.unit}`, meal: e.meal, kcal: e.calories, kcalRange: [e.estimate.min, e.estimate.max], confidence: e.estimate.confidence,
        protein: Math.round(e.protein), assumptions: e.assumptions, uncertainty: e.estimate.sources,
      }));
    }
  }

  if (ask.length) {
    const f = ask[0];
    const q = Number.isInteger(f.quantity) ? f.quantity : f.quantity;
    const unit = /^(g|gram|grams)$/i.test(f.unit) ? "g" : f.unit;
    st.clarify = {
      question: `Was that ${q}${unit === "g" ? "g" : " " + unit} of ${f.name} bone-in or boneless?`,
      options: ["Bone-in", "Boneless"],
      pending: { kind: "bone", foods: ask, meal: (st.ext?.mealType as MealTypeName) ?? inferredMeal, date: st.date, conservative: !!st.ext?.conservative, source: st.source },
    };
  }
}

async function handleSimpleLogs(st: State) {
  const { ctx, ext, date } = st;
  if (!ext) return;
  const tryTool = async (fn: () => Promise<void>, what: string) => {
    try {
      await fn();
    } catch (e) {
      st.problems.push(`Couldn't log ${what}: ${(e as Error).message.slice(0, 160)}`);
    }
  };

  if (ext.weight) {
    await tryTool(async () => {
      const w = kg(ext.weight!.value, ext.weight!.unit);
      const r = (await callTool(ctx.userId, "log_weight", { date, weightKg: w }, ctx)) as { id: string };
      st.cards.push({ kind: "weight", title: "Weigh-in", lines: [{ label: "FACT", text: `${w} kg logged for ${date === ctx.today ? "today" : date}.` }], entry: { kind: "weight", id: r.id } });
      st.entryRefs.push({ kind: "weight", id: r.id });
      st.loggedAnything = true;
      const trend = await getTrend(ctx, date);
      st.facts.weightTrend = trend;
      const rapid = checkRapidLoss(trend);
      if (rapid) st.notes.push(`SAFETY: ${rapid.response}`);
      void maybeCalibrate(ctx).catch(() => null);
    }, "weight");
  }

  if (ext.steps != null) {
    await tryTool(async () => {
      const r = (await callTool(ctx.userId, "log_activity", { date, type: "STEPS", steps: ext.steps }, ctx)) as { id: string };
      st.cards.push({ kind: "steps", title: "Steps", lines: [{ label: "FACT", text: `${fmt(ext.steps!)} steps logged.` }], entry: { kind: "activity", id: r.id } });
      st.entryRefs.push({ kind: "activity", id: r.id });
      st.loggedAnything = true;
    }, "steps");
  }

  for (const a of ext.activities ?? []) {
    await tryTool(async () => {
      const r = (await callTool(ctx.userId, "log_activity", { date, type: a.type, durationMin: a.durationMin ? Math.round(a.durationMin) : undefined, distanceKm: a.distanceKm ?? undefined, intensity: a.intensity ?? undefined, notes: a.notes ?? undefined }, ctx)) as { id: string };
      const bits = [a.type.toLowerCase(), a.durationMin ? `${Math.round(a.durationMin)} min` : null, a.distanceKm ? `${a.distanceKm} km` : null].filter(Boolean).join(", ");
      st.cards.push({ kind: "activity", title: "Activity", lines: [{ label: "FACT", text: `${bits} logged.` }, ...(a.notes ? [{ label: "FACT" as Label, text: a.notes }] : [])], entry: { kind: "activity", id: r.id } });
      st.entryRefs.push({ kind: "activity", id: r.id });
      st.loggedAnything = true;
      const sum = await getDaySummary(ctx, date);
      const warn = checkTrainingLoad(sum.activity.trainingMin);
      if (warn) st.notes.push(`SAFETY: ${warn}`);
    }, "activity");
  }

  if (ext.sleepHours != null) {
    await tryTool(async () => {
      const r = (await callTool(ctx.userId, "log_sleep", { date: date === ctx.today ? ctx.today : date, hours: ext.sleepHours }, ctx)) as { id: string };
      st.cards.push({ kind: "sleep", title: "Sleep", lines: [{ label: "FACT", text: `${ext.sleepHours} hours logged.` }], entry: { kind: "sleep", id: r.id } });
      st.entryRefs.push({ kind: "sleep", id: r.id });
      st.loggedAnything = true;
    }, "sleep");
  }

  if (ext.waterMl != null) {
    await tryTool(async () => {
      const r = (await callTool(ctx.userId, "log_water", { date, ml: Math.round(ext.waterMl!) }, ctx)) as { totalMl: number };
      st.cards.push({ kind: "water", title: "Water", lines: [{ label: "FACT", text: `+${fmt(ext.waterMl!)} ml. Today: ${fmt(r.totalMl)} ml.` }] });
      st.loggedAnything = true;
    }, "water");
  }

  if (ext.measurement && Object.values(ext.measurement).some((v) => v != null)) {
    await tryTool(async () => {
      const m = ext.measurement!;
      const r = (await callTool(ctx.userId, "log_measurement", { date, waistCm: m.waistCm ?? undefined, neckCm: m.neckCm ?? undefined, hipCm: m.hipCm ?? undefined, bodyFatPct: m.bodyFatPct ?? undefined }, ctx)) as { id: string };
      const lines: Card["lines"] = [{ label: "FACT", text: [m.waistCm && `waist ${m.waistCm} cm`, m.neckCm && `neck ${m.neckCm} cm`, m.hipCm && `hip ${m.hipCm} cm`, m.bodyFatPct && `body fat ${m.bodyFatPct}% (as reported)`].filter(Boolean).join(", ") + " logged." }];
      const w = (await getTrend(ctx, date)).latest?.weightKg ?? ctx.profile.startWeightKg;
      if (m.waistCm && m.neckCm && ctx.profile.heightCm && w) {
        const bf = navyBodyFat({ sex: ctx.profile.sex, heightCm: ctx.profile.heightCm, waistCm: m.waistCm, neckCm: m.neckCm, hipCm: m.hipCm, weightKg: w });
        if (bf) {
          lines.push({ label: "ESTIMATE", text: `Body fat roughly ${bf.low}–${bf.high}% (tape-measure estimate, not clinical). Fat mass about ${bf.fatMassKg.low}–${bf.fatMassKg.high} kg.` });
          st.facts.bodyFat = bf;
        }
      }
      st.cards.push({ kind: "measurement", title: "Body measurements", lines, entry: { kind: "measurement", id: r.id } });
      st.entryRefs.push({ kind: "measurement", id: r.id });
      st.loggedAnything = true;
    }, "measurements");
  }

  if (ext.note) {
    await tryTool(async () => {
      await callTool(ctx.userId, "log_note", { date, note: ext.note }, ctx);
      st.cards.push({ kind: "note", title: "Note", lines: [{ label: "FACT", text: ext.note! }] });
      st.loggedAnything = true;
    }, "note");
  }
}

async function resolveExercise(st: State, hint?: string | null): Promise<{ name: string; id?: string; planned?: number } | null> {
  const { ctx } = st;
  const wk = await getTodaysWorkout(ctx);
  const planned = wk?.exercises ?? [];
  if (hint) {
    const h = hint.toLowerCase();
    const m = planned.find((e) => e.name.toLowerCase() === h) ?? planned.find((e) => e.name.toLowerCase().includes(h) || h.includes(e.name.toLowerCase()));
    return m ? { name: m.name, id: m.id, planned: m.sets } : { name: hint.replace(/\b\w/g, (c) => c.toUpperCase()) };
  }
  const open = await db.workoutSession.findFirst({ where: { userId: ctx.userId, date: st.date, status: "IN_PROGRESS" }, include: { sets: { orderBy: { createdAt: "desc" }, take: 1 } } });
  const lastName = open?.sets[0]?.exerciseName;
  if (lastName) {
    const m = planned.find((e) => e.name === lastName);
    return { name: lastName, id: m?.id, planned: m?.sets };
  }
  return planned[0] ? { name: planned[0].name, id: planned[0].id, planned: planned[0].sets } : null;
}

async function handleSets(st: State) {
  for (const s of st.ext?.sets ?? []) {
    try {
      const ex = await resolveExercise(st, s.exercise);
      if (!ex) {
        st.clarify = { question: "Which exercise was that set for?" };
        return;
      }
      const w = kg(s.weight, s.unit);
      const r = (await callTool(st.ctx.userId, "log_workout_set", { date: st.date, exerciseName: ex.name, exerciseId: ex.id, reps: s.reps, weightKg: w, rpe: s.rpe ?? undefined, setNumber: s.setNumber ?? undefined }, st.ctx)) as { id: string; setNumber: number; isPr: boolean };
      const lines: Card["lines"] = [{ label: "FACT", text: `Set ${r.setNumber}: ${w} kg × ${s.reps}${s.rpe ? ` @ RPE ${s.rpe}` : ""}.` }];
      if (r.isPr) lines.push({ label: "FACT", text: "That's a new personal best on estimated one-rep max." });
      if (ex.planned) lines.push({ label: "FACT", text: `${Math.min(r.setNumber, ex.planned)} of ${ex.planned} planned sets.` });
      st.cards.push({ kind: "set", title: ex.name, lines, entry: { kind: "set", id: r.id } });
      st.entryRefs.push({ kind: "set", id: r.id });
      st.loggedAnything = true;
    } catch (e) {
      st.problems.push(`Couldn't log set: ${(e as Error).message.slice(0, 120)}`);
    }
  }
}

async function handlePreferences(st: State) {
  for (const p of st.ext?.preferences ?? []) {
    try {
      await callTool(st.ctx.userId, "remember_preference", { category: p.category, key: p.key, value: p.value, source: "EXPLICIT" }, st.ctx);
      st.cards.push({ kind: "memory", title: "Remembered", lines: [{ label: "FACT", text: `${p.value}. You can change this any time on the Memory page.` }] });
      st.loggedAnything = true;
    } catch (e) {
      st.problems.push(`Couldn't save preference: ${(e as Error).message.slice(0, 100)}`);
    }
  }
}

async function handleGoal(st: State) {
  const g = st.ext?.goal;
  const explicit = g && Object.values(g).some((v) => v != null);
  if (explicit) {
    try {
      const patch = Object.fromEntries(Object.entries(g!).filter(([, v]) => v != null));
      const res = (await callTool(st.ctx.userId, "update_goal", patch, st.ctx)) as { goal: { calorieTarget: number; proteinTargetG: number }; warnings: string[] };
      const lines: Card["lines"] = [{ label: "FACT", text: `Targets now: ${fmt(res.goal.calorieTarget)} kcal, ${res.goal.proteinTargetG} g protein.` }];
      for (const w of res.warnings) lines.push({ label: "RECOMMENDATION", text: w });
      st.cards.push({ kind: "goal", title: "Goal updated", lines });
      st.loggedAnything = true;
      st.ctx.goal = (await loadUserContext(st.ctx.userId)).goal;
    } catch (e) {
      st.problems.push(`Couldn't update goal: ${(e as Error).message.slice(0, 120)}`);
    }
    return;
  }
  // No explicit numbers: this is a request for advice ("adjust my calories because my weight hasn't moved").
  if (!st.ctx.goal) return;
  const [trend, days] = await Promise.all([getTrend(st.ctx), getRangeDaily(st.ctx.userId, addDays(st.ctx.today, -13), st.ctx.today)]);
  const advice = adviseCalories({ trend, currentTarget: st.ctx.goal.calorieTarget, sex: st.ctx.profile.sex, adherence: loggingAdherence(days), goal: st.ctx.goal.type });
  st.facts.calorieAdvice = { ...advice, currentTarget: st.ctx.goal.calorieTarget, trendStatus: trend.status, weeklyRateKg: trend.weeklyRateKg, daysOfData: trend.daysOfData };
  if (advice.deltaKcal !== 0 && advice.action !== "WAIT") {
    st.clarify = undefined;
    st.facts.pendingApply = advice.suggestedTarget;
    st.pendingApply = { kind: "apply_goal", calorieTarget: advice.suggestedTarget };
  }
}

async function handleQueries(st: State) {
  const { ctx } = st;
  {
    // Today's numbers accompany every answer: they're cheap and keep "what's left" grounded in data.
    const s = await getDaySummary(ctx, st.date);
    st.facts.today = {
      date: s.date,
      weightKg: s.weight?.kg ?? null,
      sleepH: s.sleep?.hours ?? null,
      eatenKcal: Math.round(s.totals.calories),
      eatenKcalRange: [Math.round(s.totals.minKcal), Math.round(s.totals.maxKcal)],
      proteinG: Math.round(s.totals.protein),
      fiberG: Math.round(s.totals.fiber),
      steps: s.activity.steps,
      trainingMin: s.activity.trainingMin,
      waterMl: s.water,
      targets: s.targets,
      remaining: s.remaining,
      estimatedBurnKcal: s.expenditure?.mid ?? null,
      estimatedDeficitKcal: s.deficit?.mid ?? null,
      mealsLogged: s.meals.filter((m) => m.entries.length).map((m) => `${m.meal.toLowerCase()}: ${m.entries.map((e) => e.food).join(", ")}`),
    };
    st.events.push({ type: "day", summary: lite(s) });
  }

  if (has(st, "weekly_summary", "monthly_summary", "progress_analysis")) {
    const monthly = has(st, "monthly_summary");
    const span = monthly ? 30 : 7;
    const end = addDays(ctx.today, -(st.ext?.periodOffset ?? 0) * span);
    const from = addDays(end, -(span - 1));
    const days = await getRangeDaily(ctx.userId, from, end);
    const avg = (xs: (number | null)[]) => {
      const v = xs.filter((x): x is number => x != null);
      return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null;
    };
    st.facts.period = {
      from, to: end, days: span,
      daysWithFoodLogged: days.filter((d) => d.calories != null).length,
      avgKcal: avg(days.map((d) => d.calories)), avgProteinG: avg(days.map((d) => d.protein)), avgSteps: avg(days.map((d) => d.steps)),
      avgSleepH: (() => { const v = days.map((d) => d.sleepH).filter((x): x is number => x != null); return v.length ? Math.round((v.reduce((s, x) => s + x, 0) / v.length) * 10) / 10 : null; })(),
      workoutDays: days.filter((d) => d.trainingMin > 0 || d.volume > 0).length, totalVolumeKg: days.reduce((s, d) => s + d.volume, 0),
      weighIns: days.filter((d) => d.weightKg != null).length,
    };
    st.facts.weightTrend = await getTrend(ctx, end);
    if (has(st, "progress_analysis")) {
      const strength = await strengthProgress(ctx.userId);
      st.facts.strength = strength.slice(0, 5).map((s) => ({ exercise: s.exercise, first: s.points[0], latest: s.points[s.points.length - 1] }));
      const g = ctx.goal;
      if (g) {
        const habits: DayHabits[] = days.map((d) => ({
          date: d.date, weighedIn: d.weightKg != null, loggedFood: d.calories != null,
          caloriesInRange: d.calories != null && d.calories <= g.calorieTarget * 1.1,
          proteinHit: (d.protein ?? 0) >= g.proteinTargetG * 0.9, stepsHit: (d.steps ?? 0) >= g.stepTarget * 0.8,
          slept: (d.sleepH ?? 0) >= g.sleepTargetH - 0.5, trained: null,
        }));
        st.facts.consistencyScore = consistencyScore(habits);
      }
    }
  }

  if (has(st, "weight_trend", "why_weight_changed", "progress_analysis", "body_fat_estimate") && !st.facts.weightTrend) {
    st.facts.weightTrend = await getTrend(ctx);
  }

  if (has(st, "why_weight_changed")) {
    const days = await getRangeDaily(ctx.userId, addDays(ctx.today, -6), ctx.today);
    st.facts.recentDays = days.map((d) => ({ date: d.date, weightKg: d.weightKg, kcal: d.calories, steps: d.steps, sleepH: d.sleepH }));
    const food = await db.foodEntry.findMany({ where: { userId: ctx.userId, date: { gte: addDays(ctx.today, -2), lte: ctx.today } }, select: { date: true, sodium: true, carbs: true } });
    const by = new Map<string, { sodiumMg: number; carbsG: number }>();
    for (const f of food) {
      const x = by.get(f.date) ?? { sodiumMg: 0, carbsG: 0 };
      x.sodiumMg += f.sodium;
      x.carbsG += f.carbs;
      by.set(f.date, x);
    }
    st.facts.recentIntake = Object.fromEntries(by);
  }

  if (has(st, "body_fat_estimate")) {
    const m = await db.bodyMeasurement.findFirst({ where: { userId: ctx.userId, waistCm: { not: null }, neckCm: { not: null } }, orderBy: { date: "desc" } });
    const trend = (st.facts.weightTrend ?? (await getTrend(ctx))) as Awaited<ReturnType<typeof getTrend>>;
    const w = trend.latest?.weightKg ?? ctx.profile.startWeightKg;
    if (m && ctx.profile.heightCm && w) {
      st.facts.bodyFat = navyBodyFat({ sex: ctx.profile.sex, heightCm: ctx.profile.heightCm, waistCm: m.waistCm!, neckCm: m.neckCm!, hipCm: m.hipCm, weightKg: w });
      st.facts.bodyFatMeasuredOn = m.date;
    } else st.facts.bodyFatNote = "Needs waist and neck (and hip for women) measurements plus height. Ask the user to log them.";
    if (trend.changeFromStartKg != null) st.facts.fatLostEstimate = estimateFatLost(trend.changeFromStartKg);
  }

  if (has(st, "get_todays_workout")) {
    const wk = await getTodaysWorkout(ctx);
    if (!wk) st.facts.workout = "No active workout plan yet. Offer to create one.";
    else {
      st.facts.workout = { plan: wk.plan.name, day: wk.day.name, focus: wk.day.focus, completedToday: wk.completedToday, deloadSuggested: wk.deloadSuggested, exercises: wk.exercises.map((e) => ({ name: e.name, sets: e.sets, reps: `${e.repMin}-${e.repMax}`, restSec: e.restSec, rpe: e.targetRpe, plan: e.prescription.text })) };
      st.cards.push({
        kind: "workout", title: `${wk.day.name} — ${wk.day.focus}`,
        lines: wk.exercises.map((e) => ({ label: "RECOMMENDATION" as Label, text: `${e.name}: ${e.sets} × ${e.repMin}–${e.repMax}, rest ${e.restSec}s. ${e.prescription.text}` })),
      });
      st.events.push({ type: "link", href: "/workouts", label: "Start workout" });
    }
  }

  if (has(st, "export_data") && st.ext?.exportRequest) {
    const { kind, format } = st.ext.exportRequest;
    st.events.push({ type: "link", href: `/api/export?type=${kind}&format=${format}`, label: `Download ${kind} (${format.toUpperCase()})` });
    st.facts.export = `Prepared a ${format.toUpperCase()} export of ${kind}; a download button is shown.`;
  }
}

async function favouriteFoods(userId: string): Promise<string[]> {
  const rows = await db.foodEntry.groupBy({ by: ["food"], where: { userId }, _count: { food: true }, orderBy: { _count: { food: "desc" } }, take: 15 });
  return rows.map((r) => r.food);
}

async function avoidList(st: State): Promise<string[]> {
  const mems = await db.aiMemory.findMany({ where: { userId: st.ctx.userId, category: "PREFERENCE" } });
  const out = [...st.ctx.profile.foodsAvoided];
  for (const m of mems) {
    if (/^dislike|^avoid|^no_/.test(m.key)) out.push(m.key.replace(/^(dislikes?|avoid|no)_/, "").replace(/_/g, " "));
    const mm = m.value.toLowerCase().match(/(?:don'?t|do not|doesn'?t) (?:like|want|eat|enjoy) ([a-z ]{3,30})/);
    if (mm) out.push(mm[1].trim());
  }
  return out;
}

async function handleMeals(st: State) {
  const { ctx, ext } = st;
  const today = st.facts.today as { remaining?: { calories: number; proteinG: number } | null } | undefined;

  if (has(st, "check_meal") && ext?.foods?.length) {
    const parsed = ext.foods.map((f) => ({ ...f, state: f.state ?? null, boneIn: f.boneIn ?? true, meal: null })) as ParsedFood[];
    const est = await estimateFoods(st, parsed);
    const kcal = est.reduce((s, e) => s + e.calories, 0);
    const min = est.reduce((s, e) => s + e.estimate.min, 0);
    const max = est.reduce((s, e) => s + e.estimate.max, 0);
    const rem = today?.remaining?.calories ?? null;
    st.facts.checkMeal = {
      foods: est.map((e) => ({ food: e.name, kcal: e.calories, range: [e.estimate.min, e.estimate.max], confidence: e.estimate.confidence, assumptions: e.assumptions })),
      totalKcal: kcal, totalRange: [min, max], remainingKcalToday: rem, remainingProteinToday: today?.remaining?.proteinG ?? null,
      fit: rem != null ? fitIntoBudget({ foodKcal: kcal, remainingKcal: rem, remainingProtein: today?.remaining?.proteinG ?? 0, mealsLeft: 1 }) : null,
      note: "This is a what-if. Nothing has been logged.",
    };
    for (const e of est) st.cards.push({ ...foodCard(e), title: `If you eat: ${e.name}` });
  }

  if (has(st, "get_meal_recommendation", "create_meal_plan") || (has(st, "food_substitution") && false)) {
    const q = ext?.mealQuery;
    const kcal = q?.caloriesLeft ?? today?.remaining?.calories ?? null;
    const protein = q?.proteinLeft ?? today?.remaining?.proteinG ?? 0;
    if (kcal == null || kcal < 150) {
      st.facts.mealPlan = "Not enough calorie budget left for a full meal; suggest a light, high-protein snack instead.";
    } else {
      const avoid = await avoidList(st);
      const favourites = await favouriteFoods(ctx.userId);
      const meals = Math.max(1, ctx.profile.mealsPerDay - (st.facts.today ? ((st.facts.today as { mealsLogged: string[] }).mealsLogged?.length ?? 0) : 0));
      const s = suggestMeal({ kcal, proteinG: Math.max(0, protein), avoid, favourites, onlyFavourites: !!q?.useFavourites, meals: has(st, "create_meal_plan") ? meals : 1 });
      if (s) {
        st.facts.mealPlan = { suggestion: s.text, approxKcal: s.kcal, approxProteinG: s.protein, items: s.items, for: { kcal: Math.round(kcal), proteinG: Math.round(protein) }, avoided: avoid };
        st.cards.push({ kind: "meal", title: "Meal idea", lines: [{ label: "RECOMMENDATION", text: `${s.text}` }, { label: "ESTIMATE", text: `Roughly ${fmt(s.kcal)} kcal and ${s.protein} g protein.` }] });
      }
    }
  }

  if (has(st, "food_substitution") && ext?.substitution) {
    const avoid = await avoidList(st);
    avoid.push(ext.substitution.removeFood);
    const todayFood = await db.foodEntry.findFirst({ where: { userId: ctx.userId, date: st.date, food: { contains: ext.substitution.removeFood.split(" ")[0], mode: "insensitive" } }, orderBy: { createdAt: "desc" } });
    const grams = ext.substitution.grams ?? todayFood?.grams ?? 150;
    const sub = substitute({ name: ext.substitution.removeFood.toLowerCase().replace(/s$/, ""), grams }, { avoid, favourites: await favouriteFoods(ctx.userId) });
    if (sub) {
      st.facts.substitution = { removed: ext.substitution.removeFood, replaceWith: sub.text, approxKcal: sub.kcal, approxProteinG: sub.protein, items: sub.items };
      st.cards.push({ kind: "meal", title: `Instead of ${ext.substitution.removeFood}`, lines: [{ label: "RECOMMENDATION", text: sub.text }, { label: "ESTIMATE", text: `About ${fmt(sub.kcal)} kcal and ${sub.protein} g protein.` }] });
    } else st.facts.substitution = "No close swap found in the food list; suggest any high-protein food they like.";
  }
}

async function handlePlan(st: State) {
  const { ctx, ext } = st;
  const wp = ext?.workoutPlan;

  if (has(st, "modify_workout_plan") && wp?.replaceExercise) {
    const plan = await db.exercise.findFirst({ where: { userId: ctx.userId, name: { contains: wp.replaceExercise, mode: "insensitive" }, day: { plan: { active: true } } } });
    if (plan) {
      const alt = findAlternative(plan.name, ctx.profile.equipment as Equipment, ctx.profile.injuries ?? "");
      if (alt) {
        await db.exercise.updateMany({ where: { userId: ctx.userId, name: plan.name, day: { plan: { active: true } } }, data: { name: alt.name, technique: alt.tip } });
        st.cards.push({ kind: "plan", title: "Workout updated", lines: [{ label: "FACT", text: `Replaced ${plan.name} with ${alt.name} in your plan.` }] });
        st.loggedAnything = true;
        return;
      }
    }
    st.problems.push("Couldn't find that exercise or a suitable replacement in the active plan.");
    return;
  }

  if (has(st, "create_workout_plan")) {
    const p = ctx.profile;
    const goal = (wp?.goal ?? ctx.goal?.type ?? "FAT_LOSS") as PlanGoal;
    const missing = [
      !wp?.experience && !p.onboarded ? "your experience (beginner, intermediate or advanced)" : null,
      !wp?.equipment && !p.onboarded ? "your equipment (full gym, dumbbells, home or bodyweight)" : null,
      !wp?.daysPerWeek && !p.onboarded ? "days per week (2–6)" : null,
    ].filter(Boolean);
    if (missing.length) {
      st.clarify = { question: `Quick questions so I build the right plan: ${missing.join(", ")}. Any injuries or limitations?` };
      return;
    }
    const args = {
      goal,
      experience: (wp?.experience ?? p.experience) as Level,
      daysPerWeek: Math.min(6, Math.max(2, wp?.daysPerWeek ?? p.trainDaysPerWeek)),
      sessionMinutes: Math.min(120, Math.max(30, wp?.sessionMinutes ?? p.sessionMinutes)),
      equipment: (wp?.equipment ?? p.equipment) as Equipment,
      injuries: wp?.injuries ?? p.injuries ?? null,
    };
    const res = (await callTool(ctx.userId, "create_workout_plan", args, ctx)) as { plan: { name: string; days: { name: string; focus: string; exercises: { name: string }[] }[] } };
    st.cards.push({
      kind: "plan", title: res.plan.name,
      lines: res.plan.days.map((d) => ({ label: "RECOMMENDATION" as Label, text: `${d.name} (${d.focus}): ${d.exercises.map((e) => e.name).join(", ")}` })),
    });
    st.events.push({ type: "link", href: "/workouts", label: "Open plan" });
    st.facts.plan = { name: res.plan.name, days: res.plan.days.map((d) => ({ name: d.name, count: d.exercises.length })) };
    st.loggedAnything = true;
  }
}

async function handleEdits(st: State) {
  const e = st.ext?.edit;
  if (!e) return;
  const { ctx } = st;
  const refs = await lastEntryRefs(ctx.userId);
  let target: { kind: string; id: string; label: string } | null = null;
  if (e.kind === "food") {
    const hint = e.nameHint?.split(" ")[0];
    const row = hint
      ? await db.foodEntry.findFirst({ where: { userId: ctx.userId, date: { gte: addDays(ctx.today, -2) }, food: { contains: hint, mode: "insensitive" } }, orderBy: { createdAt: "desc" } })
      : (await db.foodEntry.findFirst({ where: { userId: ctx.userId, id: { in: refs.filter((r) => r.kind === "food").map((r) => r.id) } }, orderBy: { createdAt: "desc" } })) ??
        (await db.foodEntry.findFirst({ where: { userId: ctx.userId }, orderBy: { createdAt: "desc" } }));
    if (row) target = { kind: "food", id: row.id, label: `${row.quantity} ${row.unit} ${row.food}` };
  } else {
    const ref = [...refs].reverse().find((r) => r.kind === (e.kind === "set" ? "set" : e.kind));
    if (ref) target = { ...ref, label: e.kind };
  }
  if (!target) {
    st.problems.push("Couldn't find the entry to change.");
    return;
  }
  if (e.action === "DELETE") {
    await callTool(ctx.userId, "delete_entry", { kind: target.kind, id: target.id }, ctx);
    st.cards.push({ kind: "info", title: "Removed", lines: [{ label: "FACT", text: `Deleted ${target.label}.` }] });
    st.loggedAnything = true;
  } else if (target.kind === "food" && e.newQuantity) {
    await callTool(ctx.userId, "edit_food_entry", { id: target.id, quantity: e.newQuantity, rescale: true }, ctx);
    st.cards.push({ kind: "info", title: "Updated", lines: [{ label: "FACT", text: `Changed ${target.label} to quantity ${e.newQuantity}; calories and macros were rescaled.` }] });
    st.loggedAnything = true;
  } else st.problems.push("Tell me what to change it to (for example, the new quantity).");
}

/** "I measured it" / "log it on the higher side" refine the previously logged food, without an LLM. */
async function handleRefine(st: State): Promise<boolean> {
  const t = st.text.trim().toLowerCase().replace(/[.!]+$/, "");
  // Must refer back to the previous entry ("I measured it"), so "I weighed 84.5" is not a refinement.
  const measured = /^(yes[, ]*)?(i |we )?(did )?(measured|weighed|weighted)( it| that| them| everything| all of it)( out| on a scale)?$/.test(t) || /^it was (measured|weighed)( out)?$/.test(t);
  const higher = /^(please )?(log|put|count|record)( it| that| them)?( on| at)? the (higher|upper|conservative) (side|end)$/.test(t) || /^(use|go with) the (higher|upper|conservative) (estimate|number|side|end)$/.test(t);
  if (!measured && !higher) return false;
  const refs = (await lastEntryRefs(st.ctx.userId)).filter((r) => r.kind === "food");
  if (!refs.length) return false;
  const rows = await db.foodEntry.findMany({ where: { userId: st.ctx.userId, id: { in: refs.map((r) => r.id) } } });
  if (!rows.length) return false;
  for (const r of rows) {
    if (measured) {
      await db.foodEntry.update({ where: { id: r.id }, data: { confidence: "HIGH", estimateMin: Math.round(r.calories * 0.9), estimateMax: Math.round(r.calories * 1.1), uncertaintySources: [] } });
    } else {
      const k = r.calories > 0 ? r.estimateMax / r.calories : 1;
      await db.foodEntry.update({ where: { id: r.id }, data: { calories: Math.round(r.estimateMax), protein: Math.round(r.protein * k * 10) / 10, carbs: Math.round(r.carbs * k * 10) / 10, fat: Math.round(r.fat * k * 10) / 10, estimateMin: Math.round(r.calories) } });
    }
  }
  st.cards.push({ kind: "info", title: measured ? "Upgraded to measured" : "Logged on the higher side", lines: [{ label: "FACT", text: measured ? `${rows.length} item(s) now count as measured (HIGH confidence, ±10%).` : `${rows.length} item(s) now use the top of their estimated range.` }] });
  st.loggedAnything = true;
  st.entryRefs.push(...refs);
  st.intents = ["log_meal"];
  return true;
}

// ─── Coach response ─────────────────────────────────────────────────────────────────────────────

function taskFor(st: State): string {
  if (st.loggedAnything) {
    return `Confirm what was logged in a few short sentences. Keep FACTS (logged values), ESTIMATES (food calories — say "about" and give the range/confidence), and ASSUMPTIONS (only the ones that matter) clearly distinct. Then say what's left today (calories, protein) and give one practical RECOMMENDATION. If food was logged, end by inviting a correction. Do not restate every card in detail — the app already shows them.`;
  }
  if (has(st, "check_meal")) return `The user asked whether they can eat this. Never say no. Give the estimate with its range, show how it fits in today's remaining budget, and give 1–2 concrete ways to make it work. This was NOT logged.`;
  if (has(st, "get_meal_recommendation", "create_meal_plan", "food_substitution")) return `Present the concrete suggestion from DATA with portions and the approximate calories/protein (an ESTIMATE). Be matter-of-fact and friendly.`;
  if (has(st, "why_weight_changed")) return `Explain likely reasons for the recent weight movement using the 7/14-day trend, recent intake (sodium, carbs), sleep and logging. Be clear that a single-day change is mostly water. Stay with what the DATA supports.`;
  if (has(st, "weekly_summary", "monthly_summary", "progress_analysis", "weight_trend", "body_fat_estimate", "daily_summary")) return `Summarise how the user is doing from DATA: facts first, then what it means, then one recommendation. Body-fat figures are ranges and estimates, not clinical measurements.`;
  if (st.facts.calorieAdvice) return `Explain the calorie-target suggestion from DATA as a SUGGESTION (not medical instruction), with the reason. If a new target is proposed, ask if they'd like to apply it.`;
  if (has(st, "get_todays_workout", "create_workout_plan", "modify_workout_plan")) return `Introduce the workout/plan briefly; the app shows the details. Mention the progression idea in one sentence.`;
  return `Answer the user's question helpfully using DATA and MEMORY. If it's outside fitness/nutrition, say so briefly.`;
}

function fallbackText(st: State): string {
  const parts: string[] = [];
  for (const c of st.cards.slice(0, 6)) parts.push(`${c.title}: ${c.lines[0]?.text ?? ""}`);
  const rem = (st.facts.today as { remaining?: { calories: number; proteinG: number } | null } | undefined)?.remaining;
  if (rem) parts.push(`About ${fmt(rem.calories)} kcal and ${fmt(rem.proteinG)} g protein left today (estimates).`);
  if (st.loggedFood) parts.push("Tell me if anything's off and I'll fix it.");
  return parts.join("\n") || MSG_UNDERSTAND;
}

// ─── Main entry ─────────────────────────────────────────────────────────────────────────────────

export interface TurnInput {
  text: string;
  source: "VOICE" | "TEXT";
  signal?: AbortSignal;
}

async function save(userId: string, date: string, role: "user" | "assistant", content: string, extra: { intent?: string; confidence?: number; meta?: Record<string, unknown> } = {}) {
  return db.aiConversation.create({ data: { userId, date, role, content, intent: extra.intent ?? null, confidence: extra.confidence ?? null, meta: (extra.meta ?? {}) as Prisma.InputJsonValue } });
}

export async function* runTurn(userId: string, input: TurnInput): AsyncGenerator<PipelineEvent> {
  const ctx = await loadUserContext(userId);
  const text = input.text.trim().slice(0, 2000);
  if (!text) {
    yield { type: "error", message: MSG_UNDERSTAND };
    return;
  }
  yield { type: "stage", stage: "safety", label: "Understanding…" };

  const history = await recentHistory(userId);
  const pending = await loadPending(userId);
  await save(userId, ctx.today, "user", text, { meta: { source: input.source } });

  // 1. Safety (deterministic, before any model call or write). RED never logs.
  const verdict = classifyMessage(text);
  if (verdict.level === "RED") {
    yield { type: "safety", level: "RED", text: RED_RESPONSE };
    yield { type: "token", text: RED_RESPONSE };
    const m = await save(userId, ctx.today, "assistant", RED_RESPONSE, { intent: "safety_red", meta: { safety: "RED", reasons: verdict.reasons } });
    yield { type: "done", messageId: m.id, text: RED_RESPONSE };
    return;
  }

  const st: State = {
    ctx, text, source: input.source, date: ctx.today, intents: [], ext: null, cards: [], facts: {}, notes: [], problems: [],
    loggedFood: false, loggedAnything: false, entryRefs: [], events: [],
  };
  if (verdict.level === "YELLOW") st.notes.push(`SAFETY: ${YELLOW_RESPONSE}`);

  const flush = function* (): Generator<PipelineEvent> {
    while (st.events.length) yield st.events.shift()!;
  };

  try {
    // 2. Answers to an outstanding question.
    if (pending?.kind === "bone") {
      const ans = /\bboneless|without (the )?bones?|no bones?\b/i.test(text) ? false : /\bbone[- ]?in|with (the )?bones?|bones\b/i.test(text) ? true : null;
      if (ans !== null) {
        st.intents = ["log_meal"];
        st.date = pending.date;
        st.ext = { conservative: pending.conservative, mealType: pending.meal } as Extraction;
        yield { type: "stage", stage: "logging", label: "Logging your meal…" };
        await handleFoods(st, pending.foods.map((f) => ({ ...f, boneIn: ans })));
        await remember(userId, { category: "PREFERENCE", key: "chicken_cut", value: ans ? "bone-in" : "boneless", source: "INFERRED", confidence: 0.6 });
        st.facts.preferenceSaved = `Remembered that you usually eat ${ans ? "bone-in" : "boneless"} meat (inferred; editable on the Memory page).`;
      }
    } else if (pending?.kind === "apply_goal" && /^(yes|yeah|yep|sure|ok(ay)?|apply( it)?|do it|go ahead|please do)\b/i.test(text)) {
      st.intents = ["goal_update"];
      await callTool(userId, "update_goal", { calorieTarget: pending.calorieTarget }, ctx);
      st.cards.push({ kind: "goal", title: "Calorie target updated", lines: [{ label: "FACT", text: `Your target is now ${fmt(pending.calorieTarget)} kcal.` }] });
      st.loggedAnything = true;
    }

    // Cheap, model-free follow-ups about the previous entry ("I measured it", "log it on the higher side").
    if (!st.intents.length && (await handleRefine(st))) {
      /* handled: cards and intents are set */
    }

    if (!st.intents.length) {
      // 3. Intent classification.
      yield { type: "stage", stage: "understanding", label: "Understanding…" };
      const cls = await classifyIntent(text, history);
      const confident = cls.intents.filter((i) => i.confidence >= 0.7);
      if (!confident.length) {
        const q = cls.clarifyingQuestion || "I want to get this right — could you say a bit more about what you'd like me to do?";
        const m = await save(userId, ctx.today, "assistant", q, { intent: "clarify", confidence: cls.intents[0]?.confidence, meta: {} });
        yield { type: "clarify", question: q };
        yield { type: "done", messageId: m.id, text: q };
        return;
      }
      st.intents = confident.map((i) => i.intent);

      // 4. Entity extraction.
      if (!st.intents.every((i) => i === "chitchat" || i === "general_fitness_question")) {
        st.ext = await extractEntities(text, st.intents, history, `${ctx.today} ${hourIn(ctx.tz)}:00 (${ctx.tz})`);
        st.date = addDays(ctx.today, st.ext.dateOffsetDays ?? 0);
      }

      {
        // 5–7. Look up, estimate, validate and write — only through validated tools.
        if (st.ext) {
          const logging = st.intents.some((i) => LOGGING_INTENTS.has(i));
          if (st.ext.preferences?.length) await handlePreferences(st);
          if (logging) await handleSimpleLogs(st);
          if (st.ext.foods?.length && has(st, "log_meal", "log_food")) {
            yield { type: "stage", stage: "looking_up", label: "Looking up foods…" };
            await handleFoods(st, st.ext.foods as ParsedFood[]);
          }
          if (st.ext.sets?.length && has(st, "log_workout_set")) await handleSets(st);
          if (has(st, "goal_update", "calorie_budget") && (st.ext.goal || has(st, "goal_update"))) await handleGoal(st);
          if (st.ext.workoutCommand) {
            const c = st.ext.workoutCommand;
            st.events.push({ type: "workout_command", action: c.action, seconds: c.seconds ?? undefined });
            st.facts.workoutCommand = c.action;
          }
          if (has(st, "edit_entry", "delete_entry")) await handleEdits(st);
        }
      }
    }

    yield* flush();
    yield { type: "stage", stage: "coaching", label: "Thinking…" };

    await handleQueries(st);
    await handleMeals(st);
    await handlePlan(st);
    yield* flush();

    // 8. Clarifying question (e.g. bone-in?) — logged items so far are already saved.
    if (st.clarify && !st.cards.length && !st.loggedAnything) {
      const q = st.clarify.question;
      const m = await save(userId, ctx.today, "assistant", q, { intent: "clarify", meta: { pending: st.clarify.pending ?? null } });
      yield { type: "clarify", question: q, options: st.clarify.options };
      yield { type: "done", messageId: m.id, text: q };
      return;
    }

    if (st.cards.length) yield { type: "cards", cards: st.cards };

    // Fast path: workout commands need no LLM round-trip.
    if (st.ext?.workoutCommand && !st.cards.length) {
      const c = st.ext.workoutCommand;
      const msg = c.action === "START_REST_TIMER" ? "Rest timer started." : c.action === "SKIP_EXERCISE" ? "Skipping to the next exercise." : "Added one more set.";
      yield { type: "token", text: msg };
      const m = await save(userId, ctx.today, "assistant", msg, { intent: "workout_command", meta: {} });
      yield { type: "done", messageId: m.id, text: msg };
      return;
    }

    // 9. Coach response, streamed.
    let out = "";
    if (verdict.level === "YELLOW") {
      out = YELLOW_RESPONSE + "\n\n";
      yield { type: "token", text: out };
      yield { type: "safety", level: "YELLOW", text: YELLOW_RESPONSE };
    }
    const memories = await relevantMemories(userId, text);
    const data = {
      intents: st.intents,
      logged: st.cards.map((c) => ({ title: c.title, lines: c.lines })),
      ...st.facts,
      calorieFloorKcal: calorieFloor(ctx.profile.sex),
      notes: st.notes.filter((n) => !n.includes(YELLOW_RESPONSE)),
      problems: st.problems,
      clarificationNeeded: st.clarify?.question ?? null,
      goalSet: !!ctx.goal,
      bmrKcal: ctx.profile.heightCm && ctx.ageYears && ctx.profile.sex && ctx.profile.startWeightKg ? bmr(ctx.profile.sex, ctx.profile.startWeightKg, ctx.profile.heightCm, ctx.ageYears) : null,
    };
    void estimateDailyExpenditure;
    try {
      let any = false;
      for await (const tok of streamText(coachMessages({ userText: text, data, memory: memoryPrompt(memories), history, task: taskFor(st) }), { signal: input.signal })) {
        any = true;
        out += tok;
        yield { type: "token", text: tok };
      }
      if (!any) throw new Error("empty");
    } catch (err) {
      if (input.signal?.aborted) throw err;
      const fb = (out ? "" : "") + fallbackText(st);
      const tail = out.trim() ? "" : fb;
      if (tail) {
        out += tail;
        yield { type: "token", text: tail };
      }
    }
    if (st.clarify) {
      out += `\n\n${st.clarify.question}`;
      yield { type: "token", text: `\n\n${st.clarify.question}` };
      yield { type: "clarify", question: st.clarify.question, options: st.clarify.options };
    }
    if (st.pendingApply) {
      yield { type: "clarify", question: "Want me to apply that?", options: ["Yes, apply it", "No, keep it"] };
    }

    const pendingOut = st.clarify?.pending ?? st.pendingApply ?? null;
    const m = await save(userId, ctx.today, "assistant", out.trim(), {
      intent: st.intents.join(","),
      meta: { cards: st.cards, pending: pendingOut, entryRefs: st.entryRefs, safety: verdict.level },
    });
    yield { type: "done", messageId: m.id, text: out.trim() };
  } catch (err) {
    if (input.signal?.aborted) return;
    console.error("[pipeline]", err);
    const message = err instanceof LlmUnavailableError ? "The AI service isn't configured yet. Add an LLM API key to .env.local — you can still type entries manually on the Nutrition page." : /429|rate/i.test(String((err as Error)?.message)) ? "The AI service is busy right now. Give it a few seconds and try again, or type the entry manually." : MSG_UNDERSTAND;
    yield* flush();
    yield { type: "error", message };
  }
}
