import { db } from "@/lib/db";
import { addDays } from "@/lib/dates";
import { adviseCalories } from "@/lib/engines/calories";
import { consistencyScore, consistencyLabel, type DayHabits } from "@/lib/engines/habits";
import { suggestMeal } from "@/lib/engines/mealPlan";
import type { TrendSummary } from "@/lib/engines/weightTrend";
import type { UserContext } from "./context";
import { getRangeDaily, loggingAdherence, type DailyPoint, type DaySummary } from "./summary";

/** Deterministic coach notes: the Today screen never waits on (or depends on) an LLM. */
export function coachNote(args: { trend: TrendSummary; today: DaySummary; week: DailyPoint[]; ctx: UserContext }): string {
  const { trend, today, week, ctx } = args;
  const sleeps = week.map((d) => d.sleepH).filter((x): x is number => x != null);
  const avgSleep = sleeps.length >= 3 ? sleeps.reduce((s, x) => s + x, 0) / sleeps.length : null;
  if (avgSleep != null && avgSleep < 6.5) {
    return `Your sleep has averaged ${avgSleep.toFixed(1)} hours this week. Consider reducing training intensity today and protecting tonight's sleep.`;
  }
  const g = ctx.goal;
  if (g && today.totals.calories > g.calorieTarget * 1.1 && today.meals.some((m) => m.entries.length)) {
    return "You're a bit over today's calorie budget. One day doesn't change your trend — carry on as normal tomorrow.";
  }
  switch (trend.status) {
    case "TARGET_LOSS":
      return "Your weight trend is moving nicely. Keep today's calories around target rather than trying to create an extreme deficit.";
    case "FAST_LOSS":
      return "Weight is dropping faster than is usually sustainable. Eat to your full target today — more food, not less, protects muscle and energy.";
    case "SLOW_LOSS":
      return "The trend is down, just slowly. Hitting your protein and step targets consistently is the best next lever.";
    case "PLATEAU":
      return "The trend is flat over the last two weeks. That's normal now and then; consistent logging will show whether a small tweak is needed.";
    case "GAINING":
      return "The two-week trend is up a little. Single weigh-ins are noisy — focus on logging most meals and hitting your steps.";
    default:
      return trend.daysOfData ? "A few more morning weigh-ins and I'll be able to show your trend. Same time, same scale, after the bathroom." : "Start with a morning weigh-in and tell me what you ate — I'll handle the logging.";
  }
}

/** Idea for the NEXT meal: today's remaining budget split across the meals still to come. */
export function nutritionSuggestion(today: DaySummary, favourites: string[], avoid: string[], mealsPerDay = 3) {
  const rem = today.remaining;
  if (!rem) return null;
  if (rem.calories < 150) return { text: "You've used most of today's budget. If you're hungry, a high-protein snack like curd or an egg white omelette fits.", approx: null };
  const mealsLeft = Math.max(1, mealsPerDay - today.meals.filter((m) => m.entries.length).length);
  const s = suggestMeal({ kcal: rem.calories / mealsLeft, proteinG: Math.max(0, rem.proteinG) / mealsLeft, favourites, avoid, meals: 1 });
  const left = `${Math.round(rem.calories).toLocaleString("en-US")} kcal and ${Math.max(0, Math.round(rem.proteinG))} g protein left today`;
  return s
    ? { text: `${left}. For your next meal${mealsLeft > 1 ? ` (1 of ${mealsLeft} still to come)` : ""}, try ${s.text}.`, approx: { kcal: s.kcal, protein: s.protein } }
    : null;
}

/** Weekly diet-quality read: protein, vegetables/fruit, fibre. Suggests, never restricts. */
export async function dietQuality(ctx: UserContext) {
  const from = addDays(ctx.today, -6);
  const [days, logs] = await Promise.all([getRangeDaily(ctx.userId, from, ctx.today), db.dailyLog.findMany({ where: { userId: ctx.userId, date: { gte: from, lte: ctx.today } } })]);
  const logged = days.filter((d) => d.calories != null);
  if (logged.length < 3) return null;
  const g = ctx.goal;
  const avgProtein = logged.reduce((s, d) => s + (d.protein ?? 0), 0) / logged.length;
  const avgFiber = logged.reduce((s, d) => s + (d.fiber ?? 0), 0) / logged.length;
  const veg = logs.reduce((s, l) => s + l.vegServings, 0) / 7;
  const fruit = logs.reduce((s, l) => s + l.fruitServings, 0) / 7;
  const bits: string[] = [];
  if (g) bits.push(avgProtein >= g.proteinTargetG * 0.9 ? "Your protein is on point" : "Protein is a little under target");
  const produceKnown = logs.length >= 3;
  if (produceKnown) bits.push(veg >= 2 ? "vegetables are consistent" : "vegetable intake is inconsistent — aim for 200–300 g a day");
  if (produceKnown && fruit < 1) bits.push("add one or two servings of fruit");
  if (avgFiber < 25) bits.push(`fibre averages ${Math.round(avgFiber)} g — 25–35 g is the sweet spot (dal, vegetables and fruit help; no need to cut rice or bread)`);
  return { text: bits.join("; ") + ".", avgProtein: Math.round(avgProtein), avgFiber: Math.round(avgFiber), vegPerDay: Math.round(veg * 10) / 10, fruitPerDay: Math.round(fruit * 10) / 10 };
}

/** Weekly consistency score — a gentle number, never a punishment. */
export async function weeklyConsistency(ctx: UserContext) {
  const g = ctx.goal;
  if (!g) return null;
  const days = await getRangeDaily(ctx.userId, addDays(ctx.today, -6), ctx.today);
  const habits: DayHabits[] = days.map((d) => ({
    date: d.date,
    weighedIn: d.weightKg != null,
    loggedFood: d.calories != null,
    caloriesInRange: d.calories != null && d.calories <= g.calorieTarget * 1.1 && d.calories >= g.calorieTarget * 0.6,
    proteinHit: (d.protein ?? 0) >= g.proteinTargetG * 0.9,
    stepsHit: (d.steps ?? 0) >= g.stepTarget * 0.8,
    slept: (d.sleepH ?? 0) >= g.sleepTargetH - 0.5,
    trained: null,
  }));
  const score = consistencyScore(habits);
  return { score, label: consistencyLabel(score), days: habits, adherence: loggingAdherence(days) };
}

export async function calorieAdviceFor(ctx: UserContext, trend: TrendSummary) {
  if (!ctx.goal) return null;
  const days = await getRangeDaily(ctx.userId, addDays(ctx.today, -13), ctx.today);
  return adviseCalories({ trend, currentTarget: ctx.goal.calorieTarget, sex: ctx.profile.sex, adherence: loggingAdherence(days), goal: ctx.goal.type });
}

export async function recoveryNote(ctx: UserContext) {
  const days = await getRangeDaily(ctx.userId, addDays(ctx.today, -6), ctx.today);
  const sleeps = days.map((d) => d.sleepH).filter((x): x is number => x != null);
  const avgSleep = sleeps.length ? sleeps.reduce((s, x) => s + x, 0) / sleeps.length : null;
  const trainingDays = days.filter((d) => d.trainingMin > 0 || d.volume > 0).length;
  const rest = 7 - trainingDays;
  const steps = days.map((d) => d.steps).filter((x): x is number => x != null);
  const notes: string[] = [];
  if (avgSleep != null) notes.push(avgSleep < 6.5 ? `Your sleep has averaged ${avgSleep.toFixed(1)} hours this week. Consider reducing training intensity today.` : `Sleep is averaging ${avgSleep.toFixed(1)} hours — solid for recovery.`);
  if (trainingDays >= 6) notes.push("You've trained six or seven days this week. Plan at least one full rest day.");
  const sleepSd = sleeps.length >= 3 ? Math.sqrt(sleeps.reduce((s, x) => s + (x - (avgSleep ?? 0)) ** 2, 0) / sleeps.length) : null;
  return {
    avgSleepH: avgSleep == null ? null : Math.round(avgSleep * 10) / 10,
    sleepConsistencySdH: sleepSd == null ? null : Math.round(sleepSd * 10) / 10,
    trainingDays,
    restDays: rest,
    avgSteps: steps.length ? Math.round(steps.reduce((s, x) => s + x, 0) / steps.length) : null,
    notes,
  };
}
