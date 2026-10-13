import { db } from "../db";
import { CATALOG } from "./catalog";
import { bestMatches, normalize, similarity } from "./fuzzy";
import { searchOff } from "./off";
import { searchUsda } from "./usda";
import type { FoodRecord, FoodState } from "./types";
import type { FoodItem } from "@prisma/client";

export interface LookupHit {
  food: FoodRecord;
  /** 0–1 name similarity; below ~0.6 the match is a guess and estimates become LOW confidence. */
  score: number;
  matchedName: string;
  branded: boolean;
  /** raw / cooked state of the matched record. */
  state: FoodState;
  /** True when the match came from the user's own history or custom foods. */
  fromUser: boolean;
}

export interface LookupHints {
  state?: "RAW" | "COOKED" | null;
  boneIn?: boolean | null;
}

const GOOD_ENOUGH = 0.8;

function fromRow(r: FoodItem): FoodRecord {
  return {
    id: r.id,
    name: r.name,
    source: r.source as FoodRecord["source"],
    externalId: r.externalId,
    brand: r.brand,
    state: r.state as FoodState,
    kcal: r.kcal,
    protein: r.protein,
    carbs: r.carbs,
    fat: r.fat,
    fiber: r.fiber,
    sodium: r.sodium,
    calcium: r.calcium,
    iron: r.iron,
    potassium: r.potassium,
    vitA: r.vitA,
    vitC: r.vitC,
    vitD: r.vitD,
    vitB12: r.vitB12,
    folate: r.folate,
    edibleFraction: r.edibleFraction,
    unitGrams: (r.unitGrams as Record<string, number>) ?? {},
  };
}

function catalogCandidates(query: string, hints: LookupHints) {
  let q = query;
  // Steer toward the state/bone variant the user told us about, without changing the base name.
  if (hints.state === "RAW" && !/raw/i.test(q)) q = `${q} raw`;
  if (hints.boneIn === true && /chicken/i.test(q) && !/bone/i.test(q)) q = `${q} bone-in`;
  const pool = CATALOG.flatMap((f) => [{ f, label: f.name }, ...(f.aliases ?? []).map((a) => ({ f, label: a }))]);
  const hits = bestMatches(q, pool, (x) => x.label, 12, 0.5);
  // Dedupe by food, keep best score.
  const seen = new Map<FoodRecord, number>();
  for (const h of hits) if (!seen.has(h.item.f) || seen.get(h.item.f)! < h.score) seen.set(h.item.f, h.score);
  return [...seen.entries()].map(([food, score]) => ({ food, score })).sort((a, b) => b.score - a.score);
}

/** Cache an external result as a shared (userId = null) food row so repeat lookups are instant and offline-safe. */
async function cacheExternal(f: FoodRecord): Promise<FoodRecord> {
  try {
    const row = await db.foodItem.create({
      data: {
        userId: null,
        name: f.name,
        nameNorm: normalize(f.name),
        source: f.source,
        externalId: f.externalId ?? null,
        brand: f.brand ?? null,
        state: f.state,
        kcal: f.kcal,
        protein: f.protein,
        carbs: f.carbs,
        fat: f.fat,
        fiber: f.fiber,
        sodium: f.sodium,
        calcium: f.calcium,
        iron: f.iron,
        potassium: f.potassium,
        vitA: f.vitA,
        vitC: f.vitC,
        vitD: f.vitD,
        vitB12: f.vitB12,
        folate: f.folate,
        edibleFraction: f.edibleFraction,
        unitGrams: f.unitGrams,
      },
    });
    return { ...f, id: row.id };
  } catch {
    return f; // caching is best-effort
  }
}

/**
 * Database Lookup Agent. Order: the user's own foods → shared cache → local catalog (fuzzy, Levenshtein)
 * → USDA FoodData Central → Open Food Facts. External calls only happen when nothing local is good enough.
 */
export async function lookupFood(query: string, userId: string, hints: LookupHints = {}): Promise<LookupHit | null> {
  const norm = normalize(query);
  if (!norm) return null;
  const firstToken = norm.split(" ")[0];

  // 1. DB rows (user's custom/frequent foods and the shared cache).
  let dbHits: { food: FoodRecord; score: number }[] = [];
  try {
    const rows = await db.foodItem.findMany({
      where: { OR: [{ userId }, { userId: null }], nameNorm: { contains: firstToken.slice(0, 5) } },
      orderBy: { useCount: "desc" },
      take: 60,
    });
    dbHits = rows
      .map((r) => ({ food: fromRow(r), score: similarity(query, r.name), mine: r.userId === userId }))
      .filter((x) => x.score >= 0.6)
      .map((x) => ({ food: x.food, score: x.score + (x.mine ? 0.05 : 0) }));
  } catch {
    /* DB unavailable: carry on with the in-memory catalog */
  }

  const local = catalogCandidates(query, hints);
  const all = [...dbHits.map((h) => ({ ...h, userOwned: true })), ...local.map((h) => ({ ...h, userOwned: false }))].sort((a, b) => b.score - a.score);
  let best = all[0];

  if (!best || best.score < GOOD_ENOUGH) {
    const external = await externalSearch(query);
    if (external.length) {
      const scored = external.map((f) => ({ food: f, score: similarity(query, f.name) })).sort((a, b) => b.score - a.score);
      if (!best || scored[0].score > best.score) {
        const cached = await cacheExternal(scored[0].food);
        best = { food: cached, score: scored[0].score, userOwned: false };
      }
    }
  }
  if (!best) return null;

  return {
    food: best.food,
    score: Math.min(1, best.score),
    matchedName: best.food.name,
    branded: best.food.source === "OFF" || !!best.food.brand,
    state: best.food.state,
    fromUser: best.userOwned,
  };
}

async function externalSearch(query: string): Promise<FoodRecord[]> {
  try {
    const usda = await searchUsda(query, 4);
    if (usda.length) return usda;
  } catch {
    /* fall through to OFF */
  }
  try {
    return await searchOff(query, 4);
  } catch {
    return [];
  }
}

/** Autocomplete for manual add: user history first, then catalog. No external calls. */
export async function suggestFoods(q: string, userId: string, limit = 8): Promise<FoodRecord[]> {
  const local = catalogCandidates(q, {}).slice(0, limit).map((x) => x.food);
  try {
    const rows = await db.foodItem.findMany({
      where: { userId, nameNorm: { contains: normalize(q).split(" ")[0] ?? "" } },
      orderBy: { useCount: "desc" },
      take: limit,
    });
    return [...rows.map(fromRow), ...local].slice(0, limit);
  } catch {
    return local;
  }
}
