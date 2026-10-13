import { z } from "zod";
import { db } from "@/lib/db";
import { isDateStr, weekday } from "@/lib/dates";
import { completeJson } from "@/lib/providers/llm";
import { HttpError, json, rateLimit, requireUser, route } from "@/server/api";
import { loadUserContext } from "@/server/context";

export const dynamic = "force-dynamic";

const dateStr = z.string().refine(isDateStr).nullish().catch(undefined);
const querySchema = z.object({
  kind: z.enum(["food", "weight", "workouts", "activity", "sleep"]).catch("food"),
  from: dateStr,
  to: dateStr,
  /** Substring to match in a food or exercise name ("chicken", "bench"). */
  text: z.string().nullish().catch(undefined),
  agg: z.enum(["list", "sum", "avg", "min", "max", "count"]).catch("list"),
  field: z.enum(["calories", "protein", "carbs", "fat", "grams", "weightKg", "volume", "steps", "hours", "reps"]).nullish().catch(undefined),
  /** For averages of daily totals (e.g. "average protein last month"), group by day first. */
  perDay: z.boolean().nullish().catch(undefined),
});

/**
 * POST { q } → natural-language search ("How much chicken did I eat this week?"). The LLM only turns the
 * question into a validated query object; the answer is computed by code, so numbers can't be invented.
 */
export const POST = route(async (req) => {
  const userId = await requireUser();
  rateLimit(`search:${userId}`, 20, 60_000);
  const { q } = z.object({ q: z.string().min(2).max(300) }).parse(await req.json());
  const ctx = await loadUserContext(userId);
  const dow = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][weekday(ctx.today)];

  const query = await completeJson(
    [
      {
        role: "system",
        content: `Convert a question about the user's fitness log into JSON. Today is ${ctx.today} (${dow}). Resolve relative dates ("last Monday", "this week" = Monday to today, "last month") into absolute from/to (YYYY-MM-DD, inclusive). Omit from/to to mean all time.
Schema: {"kind":"food|weight|workouts|activity|sleep","from":"YYYY-MM-DD","to":"YYYY-MM-DD","text":"substring of food/exercise name","agg":"list|sum|avg|min|max|count","field":"calories|protein|carbs|fat|grams|weightKg|volume|steps|hours|reps","perDay":true|false}
Examples: "What did I eat last Monday" → kind food, agg list, from=to=that date. "How much chicken did I eat this week" → kind food, text chicken, agg sum, field grams. "Average protein last month" → kind food, agg avg, field protein, perDay true. "Lowest weight" → kind weight, agg min, field weightKg. "Show all my workouts" → kind workouts, agg list.`,
      },
      { role: "user", content: q },
    ],
    querySchema,
    { role: "extract", maxTokens: 300 },
  ).catch(() => {
    throw new HttpError(422, "I couldn't work out what to search for. Try asking about food, weight, workouts, steps or sleep.");
  });

  const range = query.from || query.to ? { date: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } } : {};
  const when = query.from && query.to ? (query.from === query.to ? `on ${query.from}` : `from ${query.from} to ${query.to}`) : "across all your data";

  let rows: { date: string; label: string; value: number | null }[] = [];
  let unit = "";
  let field = query.field ?? undefined;

  if (query.kind === "food") {
    field ??= "calories";
    const r = await db.foodEntry.findMany({ where: { userId, ...range, ...(query.text ? { food: { contains: query.text, mode: "insensitive" } } : {}) }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] });
    const pick = (x: (typeof r)[number]) => (field === "grams" ? x.grams ?? 0 : field === "protein" ? x.protein : field === "carbs" ? x.carbs : field === "fat" ? x.fat : x.calories);
    unit = field === "grams" ? " g" : field === "calories" ? " kcal (estimated)" : " g";
    rows = r.map((x) => ({ date: x.date, label: `${x.meal.toLowerCase()}: ${x.quantity} ${x.unit} ${x.food}`, value: Math.round(pick(x)) }));
  } else if (query.kind === "weight") {
    field = "weightKg";
    unit = " kg";
    const r = await db.weightEntry.findMany({ where: { userId, ...range }, orderBy: { date: "asc" } });
    rows = r.map((x) => ({ date: x.date, label: "weigh-in", value: x.weightKg }));
  } else if (query.kind === "workouts") {
    field = field === "reps" ? "reps" : "volume";
    unit = field === "reps" ? " reps" : " kg total volume";
    const r = await db.workoutSet.findMany({ where: { userId, ...range, ...(query.text ? { exerciseName: { contains: query.text, mode: "insensitive" } } : {}) }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] });
    rows = r.map((x) => ({ date: x.date, label: `${x.exerciseName} set ${x.setNumber}: ${x.weightKg} kg × ${x.reps}`, value: field === "reps" ? x.reps : x.volume }));
  } else if (query.kind === "activity") {
    field = "steps";
    unit = " steps";
    const r = await db.activityEntry.findMany({ where: { userId, ...range }, orderBy: { date: "asc" } });
    rows = r.map((x) => ({ date: x.date, label: `${x.type.toLowerCase()}${x.durationMin ? ` ${x.durationMin} min` : ""}`, value: x.steps }));
  } else {
    field = "hours";
    unit = " h sleep";
    const r = await db.sleepEntry.findMany({ where: { userId, ...range }, orderBy: { date: "asc" } });
    rows = r.map((x) => ({ date: x.date, label: "sleep", value: x.hours }));
  }

  // Group by day for "average per day" style questions.
  let series = rows;
  if (query.perDay && (query.agg === "avg" || query.agg === "min" || query.agg === "max")) {
    const byDay = new Map<string, number>();
    for (const r of rows) byDay.set(r.date, (byDay.get(r.date) ?? 0) + (r.value ?? 0));
    series = [...byDay.entries()].map(([date, value]) => ({ date, label: "daily total", value }));
  }
  const vals = series.map((r) => r.value).filter((v): v is number => v != null);
  const r1 = (n: number) => Math.round(n * 10) / 10;
  let answer: string;
  if (!rows.length) answer = `I couldn't find any matching ${query.kind} entries ${when}.`;
  else if (query.agg === "count") answer = `${rows.length} matching entries ${when}.`;
  else if (query.agg === "sum") answer = `Total${query.text ? ` ${query.text}` : ""}: ${r1(vals.reduce((s, v) => s + v, 0))}${unit} ${when}.`;
  else if (query.agg === "avg") answer = `Average${query.perDay ? " per day" : ""}: ${r1(vals.reduce((s, v) => s + v, 0) / Math.max(1, vals.length))}${unit} ${when}.`;
  else if (query.agg === "min" || query.agg === "max") {
    const best = series.reduce((a, b) => ((query.agg === "min" ? (b.value ?? Infinity) < (a.value ?? Infinity) : (b.value ?? -Infinity) > (a.value ?? -Infinity)) ? b : a));
    answer = `${query.agg === "min" ? "Lowest" : "Highest"}: ${best.value}${unit} on ${best.date}.`;
  } else answer = `${rows.length} entries ${when}.`;
  if (query.kind === "food" && field === "calories") answer += " Calorie totals are estimates.";

  return json({ answer, query, rows: rows.slice(0, 200) });
});
