import type { FoodRecord } from "./types";

const UA = "FitTrackAI/0.1 (self-hosted fitness coach)";

interface OffProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, number | string | undefined>;
}

const num = (v: unknown) => {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
};

export function mapOff(p: OffProduct): FoodRecord | null {
  const n = p.nutriments ?? {};
  const kcal = num(n["energy-kcal_100g"]) || num(n["energy_100g"]) / 4.184;
  if (!p.product_name || !kcal) return null;
  const serving = num(p.serving_quantity);
  return {
    name: p.product_name.toLowerCase(),
    source: "OFF",
    externalId: p.code ?? null,
    brand: p.brands?.split(",")[0]?.trim() || null,
    state: "PACKAGED",
    kcal: Math.round(kcal),
    protein: num(n["proteins_100g"]),
    carbs: num(n["carbohydrates_100g"]),
    fat: num(n["fat_100g"]),
    fiber: num(n["fiber_100g"]),
    sodium: num(n["sodium_100g"]) * 1000,
    calcium: num(n["calcium_100g"]) * 1000,
    iron: num(n["iron_100g"]) * 1000,
    potassium: num(n["potassium_100g"]) * 1000,
    vitA: num(n["vitamin-a_100g"]) * 1_000_000,
    vitC: num(n["vitamin-c_100g"]) * 1000,
    vitD: num(n["vitamin-d_100g"]) * 1_000_000,
    vitB12: num(n["vitamin-b12_100g"]) * 1_000_000,
    folate: num(n["vitamin-b9_100g"]) * 1_000_000,
    edibleFraction: 1,
    unitGrams: serving > 0 ? { serving, packet: serving, piece: serving } : {},
  };
}

export async function searchOff(query: string, limit = 5): Promise<FoodRecord[]> {
  const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
  url.searchParams.set("search_terms", query);
  url.searchParams.set("search_simple", "1");
  url.searchParams.set("action", "process");
  url.searchParams.set("json", "1");
  url.searchParams.set("page_size", String(limit));
  url.searchParams.set("fields", "code,product_name,brands,nutriments,serving_quantity");
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(6_000) });
  if (!res.ok) throw new Error(`OFF ${res.status}`);
  const j = (await res.json()) as { products?: OffProduct[] };
  return (j.products ?? []).map(mapOff).filter((x): x is FoodRecord => x !== null);
}

export async function lookupBarcode(barcode: string): Promise<FoodRecord | null> {
  if (!/^\d{6,14}$/.test(barcode)) return null;
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=code,product_name,brands,nutriments,serving_quantity`, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(6_000),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { status?: number; product?: OffProduct };
  return j.status === 1 && j.product ? mapOff(j.product) : null;
}
