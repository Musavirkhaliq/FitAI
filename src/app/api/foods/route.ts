import { z } from "zod";
import { db } from "@/lib/db";
import { lookupFood, suggestFoods } from "@/lib/food/lookup";
import { lookupBarcode } from "@/lib/food/off";
import { computeFoodEstimate } from "@/lib/food/portion";
import { HttpError, json, rateLimit, requireUser, route } from "@/server/api";
import { loadUserContext } from "@/server/context";

export const dynamic = "force-dynamic";

/**
 * GET /api/foods?q=chick      → autocomplete suggestions (history first, then catalog)
 * GET /api/foods?barcode=123  → Open Food Facts barcode lookup
 * GET /api/foods?frequent=1   → the user's most-logged foods (for the client's IndexedDB cache)
 */
export const GET = route(async (req) => {
  const userId = await requireUser();
  const p = new URL(req.url).searchParams;
  if (p.get("frequent")) {
    const rows = await db.foodEntry.groupBy({ by: ["food", "unit"], where: { userId }, _count: { food: true }, _avg: { quantity: true, calories: true, protein: true }, orderBy: { _count: { food: "desc" } }, take: 25 });
    return json({ foods: rows.map((r) => ({ food: r.food, unit: r.unit, count: r._count.food, typicalQuantity: Math.round((r._avg.quantity ?? 1) * 10) / 10, kcal: Math.round(r._avg.calories ?? 0), protein: Math.round(r._avg.protein ?? 0) })) });
  }
  const barcode = p.get("barcode");
  if (barcode) {
    const f = await lookupBarcode(barcode);
    if (!f) throw new HttpError(404, "I couldn't find that barcode.");
    return json({ food: f });
  }
  const q = (p.get("q") ?? "").trim();
  if (q.length < 2) return json({ foods: [] });
  return json({ foods: (await suggestFoods(q, userId)).map((f) => ({ name: f.name, kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, source: f.source, units: Object.keys(f.unitGrams) })) });
});

const estimateSchema = z.object({
  name: z.string().min(1).max(120),
  quantity: z.number().positive().max(100_000),
  unit: z.string().max(30).default("g"),
  prep: z.string().max(60).nullish(),
  state: z.enum(["RAW", "COOKED"]).nullish(),
  boneIn: z.boolean().nullish(),
  measured: z.boolean().optional(),
  restaurant: z.boolean().optional(),
  meal: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]).nullish(),
});

/** POST: estimate one food (does not save). Manual-entry form uses it to preview before logging. */
export const POST = route(async (req) => {
  const userId = await requireUser();
  rateLimit(`foods:${userId}`, 60, 60_000);
  const ctx = await loadUserContext(userId);
  const body = estimateSchema.parse(await req.json());
  const hit = await lookupFood(body.name, userId, { state: body.state, boneIn: body.boneIn });
  if (!hit) throw new HttpError(404, `I couldn't find "${body.name}". Try a simpler name.`);
  const est = computeFoodEstimate(body, hit, { bias: ctx.profile.calorieBias, conservative: ctx.profile.conservativeEstimates });
  return json({ estimate: est, match: { name: hit.matchedName, score: hit.score, source: hit.food.source } });
});
