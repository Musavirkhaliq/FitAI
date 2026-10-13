import { buildEstimate, type Estimate, type UncertaintyFactors } from "../engines/estimation";
import type { FoodRecord } from "./types";

export type MealTypeName = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";

export interface ParsedFood {
  name: string;
  quantity: number;
  unit: string;
  prep?: string | null;
  meal?: MealTypeName | null;
  /** The user said raw/uncooked or cooked. null = didn't say. */
  state?: "RAW" | "COOKED" | null;
  /** true = bone-in, false = boneless, null/undefined = unknown. */
  boneIn?: boolean | null;
  /** User weighed it or read it off a label. */
  measured?: boolean;
  restaurant?: boolean;
}

export interface Micros {
  calcium: number;
  iron: number;
  potassium: number;
  vitA: number;
  vitC: number;
  vitD: number;
  vitB12: number;
  folate: number;
}

export interface EstimatedFood {
  name: string;
  matchedName: string;
  foodItemId?: string;
  quantity: number;
  unit: string;
  grams: number;
  edibleGrams: number;
  prep: string | null;
  meal: MealTypeName | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  micros: Micros;
  estimate: Estimate;
  assumptions: string[];
}

const UNIT_ALIASES: Record<string, string> = {
  g: "g", gm: "g", gms: "g", gram: "g", grams: "g", gramme: "g", grammes: "g",
  kg: "kg", kgs: "kg", kilo: "kg", kilos: "kg", kilogram: "kg", kilograms: "kg",
  oz: "oz", ounce: "oz", ounces: "oz",
  lb: "lb", lbs: "lb", pound: "lb", pounds: "lb",
  ml: "ml", milliliter: "ml", milliliters: "ml", millilitre: "ml", millilitres: "ml",
  l: "l", liter: "l", liters: "l", litre: "l", litres: "l",
  tbsp: "tbsp", tablespoon: "tbsp", tablespoons: "tbsp",
  tsp: "tsp", teaspoon: "tsp", teaspoons: "tsp",
  cup: "cup", cups: "cup",
  piece: "piece", pieces: "piece", pc: "piece", pcs: "piece", nos: "piece", no: "piece", whole: "piece", item: "piece", items: "piece", unit: "piece", units: "piece",
  slice: "slice", slices: "slice",
  bowl: "bowl", bowls: "bowl",
  plate: "plate", plates: "plate", plateful: "plate",
  katori: "katori", katoris: "katori", katora: "katori",
  glass: "glass", glasses: "glass",
  can: "can", cans: "can", bottle: "bottle", bottles: "bottle",
  scoop: "scoop", scoops: "scoop",
  handful: "handful", handfuls: "handful",
  packet: "packet", packets: "packet", pack: "packet",
  serving: "serving", servings: "serving", portion: "serving", portions: "serving",
  egg: "egg", eggs: "egg", cube: "cube", cubes: "cube", sachet: "sachet", square: "square", squares: "square", bar: "bar",
};

export function normalizeUnit(u: string | null | undefined): string {
  const k = (u ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (!k) return "serving";
  return UNIT_ALIASES[k] ?? k;
}

const EXACT_UNITS = new Set(["g", "kg", "oz", "lb", "ml", "l"]);
const WEIGHT_FACTORS: Record<string, number> = { g: 1, kg: 1000, oz: 28.3495, lb: 453.592, ml: 1, l: 1000 };
/** Generic household sizes used only when the food has no own value for the unit. */
const DEFAULT_UNIT_GRAMS: Record<string, number> = {
  tbsp: 15, tsp: 5, cup: 240, bowl: 200, plate: 250, katori: 150, glass: 250, slice: 30, scoop: 30, handful: 28, serving: 100, can: 330, bottle: 500, packet: 30,
};

/** Cooked-weight ÷ raw-weight, for converting between states when no matching record exists. */
const COOK_YIELD: [RegExp, number][] = [
  [/rice|poha/, 2.8],
  [/dal|lentil|moong|toor|masoor|chickpea|chana|rajma|beans/, 2.5],
  [/pasta|noodle|spaghetti|macaroni/, 2.2],
  [/oat/, 2.5],
  [/chicken|mutton|lamb|fish|meat|prawn/, 0.75],
];
const yieldFor = (name: string) => COOK_YIELD.find(([re]) => re.test(name))?.[1] ?? null;

/** Added cooking fat, grams per 100 g of food, by preparation. */
const PREP_OIL_G_PER_100G: [RegExp, number][] = [
  [/deep[- ]?fried|fried chicken|pakora|bhaji/, 12],
  [/fried|fry/, 8],
  [/curry|masala|gravy|korma/, 5],
  [/saut|stir|tadka|bhuna|tempered/, 4],
  [/roast|baked|bake/, 2],
  [/grill|tandoor|tikka/, 1.5],
];

const BONE_IN_DEFAULT_FRACTION = 0.6;
const BONE_IN_RE = /chicken|mutton|lamb|fish|rib|wing|leg|thigh|drumstick|pork/;

export function toGrams(quantity: number, unit: string, food: FoodRecord): { grams: number; exact: boolean; note?: string } {
  const u = normalizeUnit(unit);
  if (WEIGHT_FACTORS[u]) return { grams: quantity * WEIGHT_FACTORS[u], exact: true };
  const own = food.unitGrams[u] ?? food.unitGrams[u + "s"];
  if (own) return { grams: quantity * own, exact: !["bowl", "plate", "katori", "handful", "serving", "glass", "cup"].includes(u) };
  const generic = DEFAULT_UNIT_GRAMS[u];
  if (generic) return { grams: quantity * generic, exact: false, note: `assumed a ${u} is about ${generic} g` };
  return { grams: quantity * 100, exact: false, note: `didn't recognise the unit "${unit}", assumed ${quantity * 100} g` };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function computeFoodEstimate(
  p: ParsedFood,
  hit: { food: FoodRecord; score: number; branded: boolean },
  opts: { bias?: number; conservative?: boolean } = {},
): EstimatedFood {
  const f = hit.food;
  const assumptions: string[] = [];
  const factors: UncertaintyFactors = {};
  const unit = normalizeUnit(p.unit);

  const conv = toGrams(p.quantity, p.unit, f);
  let grams = conv.grams;
  if (conv.note) assumptions.push(`I ${conv.note}.`);
  if (!conv.exact) factors.portionGuessed = true;

  // --- raw vs cooked -------------------------------------------------------------------------
  const y = yieldFor(f.name);
  const weightBased = EXACT_UNITS.has(unit);
  if (p.state && f.state !== "PACKAGED" && p.state !== f.state && y) {
    // User said raw but the record is cooked (or vice-versa): convert the weight.
    grams = p.state === "RAW" ? grams * y : grams / y;
    assumptions.push(`Converted ${p.state.toLowerCase()} weight to ${f.state.toLowerCase()} equivalent (×${p.state === "RAW" ? y : round1(1 / y)}).`);
  } else if (!p.state && weightBased && y && f.state === "COOKED" && y > 1.5) {
    assumptions.push(`Assumed ${p.quantity}${unit} is cooked weight (it would be ~${Math.round((grams * y) / 10) * 10} g cooked if raw).`);
    factors.rawCookedAmbiguous = true;
  }

  // --- bone-in -------------------------------------------------------------------------------
  let edibleGrams = grams;
  if (p.boneIn === true && f.edibleFraction === 1 && BONE_IN_RE.test(f.name)) {
    edibleGrams = grams * BONE_IN_DEFAULT_FRACTION;
    assumptions.push(`Bone-in: assumed about ${Math.round(BONE_IN_DEFAULT_FRACTION * 100)}% of the weight is edible meat.`);
    factors.boneIn = true;
  } else if (p.boneIn === true && f.edibleFraction < 1) {
    edibleGrams = grams * f.edibleFraction;
    assumptions.push(`Bone-in: assumed about ${Math.round(f.edibleFraction * 100)}% of the weight is edible meat.`);
    factors.boneIn = true;
  } else if (p.boneIn === false && f.edibleFraction < 1) {
    // Record's nutrients are per edible gram; the user's weight is all edible.
    edibleGrams = grams;
  }

  const per = edibleGrams / 100;
  let kcal = f.kcal * per;
  let protein = f.protein * per;
  let carbs = f.carbs * per;
  let fat = f.fat * per;

  // --- cooking fat ---------------------------------------------------------------------------
  const prep = p.prep?.trim() || null;
  if (prep && !f.mixed && f.role !== "fat") {
    const oil = PREP_OIL_G_PER_100G.find(([re]) => re.test(prep.toLowerCase()))?.[1] ?? 0;
    if (oil > 0) {
      const g = oil * per;
      kcal += g * 9;
      fat += g;
      assumptions.push(`Added about ${Math.round(g)} g cooking oil for "${prep}" preparation (${Math.round(g * 9)} kcal).`);
      if (!p.measured) factors.unmeasuredOil = true;
    }
  }
  if (f.mixed && !p.measured) {
    factors.mixedDish = true;
    factors.unknownRecipe = true;
    assumptions.push(`Used a typical ${f.name} recipe; yours may differ a lot in oil and portion.`);
  }
  if (p.restaurant) {
    factors.restaurant = true;
    if (!f.mixed) assumptions.push("Restaurant portion: expect extra oil/butter versus home cooking.");
  }
  if (hit.score < 0.6) {
    factors.unknownRecipe = true;
    assumptions.push(`I matched "${p.name}" to "${f.name}" — that's a loose match, so treat the numbers as rough.`);
  }
  if (p.measured || (hit.branded && f.source === "OFF" && weightBased)) factors.barcodeOrMeasured = true;
  if (f.state === "PACKAGED" && f.source === "LOCAL" && !p.measured && weightBased) factors.barcodeOrMeasured = false;

  const estimate = buildEstimate(kcal, factors, { bias: opts.bias, conservative: opts.conservative });
  const scale = kcal > 0 ? estimate.kcal / kcal : 1; // keep macros consistent with bias/conservative adjustments
  const m = (v: number) => round1(v * per);

  return {
    name: p.name,
    matchedName: f.name,
    foodItemId: f.id,
    quantity: p.quantity,
    unit: p.unit,
    grams: Math.round(grams),
    edibleGrams: Math.round(edibleGrams),
    prep,
    meal: p.meal ?? null,
    calories: estimate.kcal,
    protein: round1(protein * scale),
    carbs: round1(carbs * scale),
    fat: round1(fat * scale),
    fiber: m(f.fiber),
    sodium: Math.round(f.sodium * per),
    micros: {
      calcium: Math.round(f.calcium * per),
      iron: m(f.iron),
      potassium: Math.round(f.potassium * per),
      vitA: Math.round(f.vitA * per),
      vitC: m(f.vitC),
      vitD: m(f.vitD),
      vitB12: m(f.vitB12),
      folate: Math.round(f.folate * per),
    },
    estimate,
    assumptions,
  };
}

/**
 * Should we ask "bone-in or boneless?" before logging? Only when the food is a bone-capable meat, the
 * user didn't say, and no remembered preference settles it.
 */
export function needsBoneQuestion(p: ParsedFood, rememberedBoneIn: boolean | null): boolean {
  if (p.boneIn === true || p.boneIn === false) return false;
  if (rememberedBoneIn !== null) return false;
  const n = p.name.toLowerCase();
  if (/boneless|breast|fillet|fillets|keema|mince|ground|tikka|nugget|thigh boneless|bone-?less|egg|paneer|biryani|burger|curry\s+boneless/.test(n)) return false;
  if (!/chicken|mutton|lamb|\bribs?\b|wings?|drumsticks?|\bleg\b|fish|pork/.test(n)) return false;
  if (/fish/.test(n) && !/bone/.test(n)) return false; // fish fillets are the norm; don't pester
  return normalizeUnit(p.unit) === "g" || normalizeUnit(p.unit) === "kg" || normalizeUnit(p.unit) === "oz" || normalizeUnit(p.unit) === "lb";
}
