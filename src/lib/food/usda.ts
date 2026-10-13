import { env } from "../env";
import type { FoodRecord, FoodState } from "./types";

const BASE = "https://api.nal.usda.gov/fdc/v1";

// FoodData Central nutrient numbers → our fields (all per 100 g).
const N = {
  kcal: ["208", "957", "958"],
  protein: ["203"],
  fat: ["204"],
  carbs: ["205"],
  fiber: ["291"],
  sodium: ["307"],
  calcium: ["301"],
  iron: ["303"],
  potassium: ["306"],
  vitA: ["320"],
  vitC: ["401"],
  vitD: ["328"],
  vitB12: ["418"],
  folate: ["435"],
} as const;

interface FdcFood {
  fdcId: number;
  description: string;
  dataType?: string;
  brandOwner?: string;
  foodNutrients?: { nutrientNumber?: string; value?: number }[];
}

function pick(nutrients: FdcFood["foodNutrients"], numbers: readonly string[]): number {
  for (const num of numbers) {
    const hit = nutrients?.find((n) => n.nutrientNumber === num);
    if (hit?.value != null) return hit.value;
  }
  return 0;
}

function stateOf(desc: string, dataType?: string): FoodState {
  if (dataType === "Branded") return "PACKAGED";
  return /\braw\b|uncooked/i.test(desc) ? "RAW" : "COOKED";
}

export function mapFdc(f: FdcFood): FoodRecord | null {
  const kcal = pick(f.foodNutrients, N.kcal);
  if (!kcal && !pick(f.foodNutrients, N.protein)) return null;
  return {
    name: f.description.toLowerCase(),
    source: "USDA",
    externalId: String(f.fdcId),
    brand: f.brandOwner ?? null,
    state: stateOf(f.description, f.dataType),
    kcal,
    protein: pick(f.foodNutrients, N.protein),
    carbs: pick(f.foodNutrients, N.carbs),
    fat: pick(f.foodNutrients, N.fat),
    fiber: pick(f.foodNutrients, N.fiber),
    sodium: pick(f.foodNutrients, N.sodium),
    calcium: pick(f.foodNutrients, N.calcium),
    iron: pick(f.foodNutrients, N.iron),
    potassium: pick(f.foodNutrients, N.potassium),
    vitA: pick(f.foodNutrients, N.vitA),
    vitC: pick(f.foodNutrients, N.vitC),
    vitD: pick(f.foodNutrients, N.vitD),
    vitB12: pick(f.foodNutrients, N.vitB12),
    folate: pick(f.foodNutrients, N.folate),
    edibleFraction: 1,
    unitGrams: {},
  };
}

/** Search USDA FoodData Central (Foundation + SR Legacy preferred: generic, well-measured foods). */
export async function searchUsda(query: string, limit = 5): Promise<FoodRecord[]> {
  const url = new URL(`${BASE}/foods/search`);
  url.searchParams.set("api_key", env().USDA_API_KEY);
  url.searchParams.set("query", query);
  url.searchParams.set("pageSize", String(limit));
  url.searchParams.set("dataType", "Foundation,SR Legacy");
  const res = await fetch(url, { signal: AbortSignal.timeout(6_000), next: { revalidate: 86_400 } });
  if (!res.ok) throw new Error(`USDA ${res.status}`);
  const j = (await res.json()) as { foods?: FdcFood[] };
  return (j.foods ?? []).map(mapFdc).filter((x): x is FoodRecord => x !== null);
}
