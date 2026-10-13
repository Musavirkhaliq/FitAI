import { CATALOG } from "../food/catalog";
import { normalize } from "../food/fuzzy";
import type { FoodRecord } from "../food/types";

export interface PlanItem {
  name: string;
  grams: number;
  kcal: number;
  protein: number;
}

export interface MealSuggestion {
  items: PlanItem[];
  kcal: number;
  protein: number;
  /** Plain-language portions, e.g. "250 g curd". */
  text: string;
}

export interface PlanOptions {
  kcal: number;
  proteinG: number;
  /** Foods to avoid (substring match, e.g. "egg"). */
  avoid?: string[];
  /** Food names the user eats often: preferred when "use foods I already eat". */
  favourites?: string[];
  /** If true, restrict to favourites where possible. */
  onlyFavourites?: boolean;
  meals?: number;
}

const catalogByName = (n: string) => CATALOG.find((f) => f.name === n);
const per = (f: FoodRecord, g: number): PlanItem => ({
  name: f.name,
  grams: Math.round(g),
  kcal: Math.round((f.kcal * g) / 100),
  protein: Math.round(((f.protein * g) / 100) * 10) / 10,
});

const round25 = (g: number) => Math.max(25, Math.round(g / 25) * 25);

function allowed(f: FoodRecord, avoid: string[]): boolean {
  const n = normalize(f.name);
  return !avoid.some((a) => a && (n.includes(normalize(a)) || (f.aliases ?? []).some((al) => normalize(al).includes(normalize(a)))));
}

/** Protein per kcal: higher is leaner protein. */
const density = (f: FoodRecord) => f.protein / Math.max(1, f.kcal);

function pool(role: FoodRecord["role"], opts: PlanOptions): FoodRecord[] {
  const avoid = opts.avoid ?? [];
  const fav = new Set((opts.favourites ?? []).map(normalize));
  let list = CATALOG.filter((f) => f.role === role && !f.mixed && allowed(f, avoid));
  const favs = list.filter((f) => fav.has(normalize(f.name)));
  if (opts.onlyFavourites && favs.length) list = favs;
  // Favourites float to the top.
  return list.sort((a, b) => Number(fav.has(normalize(b.name))) - Number(fav.has(normalize(a.name))));
}

/**
 * Build one meal hitting the remaining calories and protein. Strategy: lean protein first, dairy second,
 * a carb source and vegetables to fill the calorie gap. Portions rounded to 25 g. Result is approximate —
 * treat it as a starting point, not a prescription.
 */
export function suggestMeal(opts: PlanOptions): MealSuggestion | null {
  const meals = Math.max(1, opts.meals ?? 1);
  const kcalGoal = opts.kcal / meals;
  const proteinGoal = opts.proteinG / meals;
  if (kcalGoal < 150) return null;

  // Everyday staples first (by protein density); seafood/soy/tofu only if they're favourites or nothing else fits.
  const fav = new Set((opts.favourites ?? []).map(normalize));
  const unusual = (f: FoodRecord) => !fav.has(normalize(f.name)) && /prawn|tuna|salmon|soya|tofu|mutton/.test(f.name);
  const proteins = pool("protein", opts)
    .filter((f) => f.state !== "RAW" && f.name !== "whey protein")
    .sort((a, b) => Number(unusual(a)) - Number(unusual(b)) || Number(fav.has(normalize(b.name))) - Number(fav.has(normalize(a.name))) || density(b) - density(a));
  const dairy = pool("dairy", opts).filter((f) => f.name !== "milk" && f.name !== "skim milk");
  const carbs = pool("carb", opts).filter((f) => f.state !== "RAW" && !/bread|paratha|oats/.test(f.name));
  const veg = pool("veg", opts).filter((f) => f.name === "mixed vegetables" || f.name === "spinach" || f.name === "broccoli");

  const items: PlanItem[] = [];
  let kcal = 0;
  let protein = 0;
  const add = (f: FoodRecord | undefined, g: number) => {
    if (!f || g < 25) return;
    const it = per(f, g);
    items.push(it);
    kcal += it.kcal;
    protein += it.protein;
  };

  // Vegetables first so they're always present (~150 g), then protein, dairy, carbs.
  const v = veg[0];
  if (v && kcalGoal >= 350) add(v, 150);
  const main = proteins[0];
  const secondary = proteins.find((f) => f !== main && f.role === "protein" && /dal|chickpea|rajma|moong|toor|tofu|fish|paneer/.test(f.name));
  if (main) add(main, round25(Math.min(300, (proteinGoal * 0.5 * 100) / Math.max(1, main.protein))));
  if (dairy[0] && protein < proteinGoal) add(dairy[0], round25(Math.min(250, ((proteinGoal - protein) * 0.5 * 100) / Math.max(1, dairy[0].protein))));
  if (secondary && protein < proteinGoal * 0.9) add(secondary, round25(Math.min(250, ((proteinGoal - protein) * 100) / Math.max(1, secondary.protein))));
  const carb = carbs[0];
  if (carb && kcal < kcalGoal * 0.95) add(carb, round25(Math.min(350, ((kcalGoal - kcal) * 100) / Math.max(1, carb.kcal))));
  if (!items.length) return null;

  // Top-up protein if still short and calories allow.
  if (protein < proteinGoal * 0.85 && main && kcal + 100 < kcalGoal * 1.05) {
    const extra = round25(Math.min(150, ((proteinGoal - protein) * 100) / Math.max(1, main.protein)));
    const idx = items.findIndex((i) => i.name === main.name);
    if (idx >= 0) {
      const g = items[idx].grams + extra;
      kcal -= items[idx].kcal;
      protein -= items[idx].protein;
      items[idx] = per(main, g);
      kcal += items[idx].kcal;
      protein += items[idx].protein;
    }
  }

  return {
    items,
    kcal: Math.round(kcal),
    protein: Math.round(protein),
    text: items.map((i) => `${i.grams} g ${i.name}`).join(", "),
  };
}

export interface Substitution {
  items: PlanItem[];
  text: string;
  kcal: number;
  protein: number;
}

/**
 * "I don't want eggs tonight": propose replacements that match the removed food's protein (and roughly
 * its calories) using one or two alternatives from other protein/dairy sources.
 */
export function substitute(removed: { name: string; grams: number }, opts: { avoid?: string[]; favourites?: string[] } = {}): Substitution | null {
  const orig = CATALOG.find((f) => f.name === removed.name || (f.aliases ?? []).includes(removed.name));
  if (!orig) return null;
  const targetProtein = (orig.protein * removed.grams) / 100;
  const targetKcal = (orig.kcal * removed.grams) / 100;
  const avoid = [...(opts.avoid ?? []), orig.name, ...(orig.aliases ?? [])];
  const cands = CATALOG.filter((f) => (f.role === "protein" || f.role === "dairy") && !f.mixed && f.state !== "RAW" && f.name !== "whey protein" && allowed(f, avoid));
  const fav = new Set((opts.favourites ?? []).map(normalize));
  cands.sort((a, b) => Number(fav.has(normalize(b.name))) - Number(fav.has(normalize(a.name))) || density(b) - density(a));
  if (cands.length < 1) return null;

  const a = cands.find((f) => f.role === "dairy") ?? cands[0];
  const b = cands.find((f) => f !== a && f.role === "protein") ?? cands[1];
  const gA = round25(Math.min(300, (targetProtein * 0.5 * 100) / Math.max(1, a.protein)));
  const itemA = per(a, gA);
  const items = [itemA];
  if (b) {
    const gB = round25(Math.min(250, ((targetProtein - itemA.protein) * 100) / Math.max(1, b.protein)));
    if (gB >= 50) items.push(per(b, gB));
  }
  const kcal = items.reduce((s, i) => s + i.kcal, 0);
  const protein = Math.round(items.reduce((s, i) => s + i.protein, 0));
  void targetKcal;
  return { items, kcal, protein, text: items.map((i) => `${i.grams} g ${i.name}`).join(" plus ") };
}

/** "Can I eat biryani tonight?": how a food fits into what's left, without ever saying no. */
export function fitIntoBudget(args: { foodKcal: number; remainingKcal: number; remainingProtein: number; mealsLeft: number }) {
  const left = args.remainingKcal - args.foodKcal;
  if (left >= 300) return { fits: true, leftKcal: left, mode: "easy" as const };
  if (left >= 0) return { fits: true, leftKcal: left, mode: "tight" as const };
  return { fits: false, leftKcal: left, mode: "over" as const };
}
