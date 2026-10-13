import { KCAL_PER_KG_FAT } from "./calories";

export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export interface UncertaintyFactors {
  /** Branded product with a barcode / label, or user weighed it on a scale. */
  barcodeOrMeasured?: boolean;
  restaurant?: boolean;
  boneIn?: boolean;
  unmeasuredOil?: boolean;
  mixedDish?: boolean;
  unknownRecipe?: boolean;
  portionGuessed?: boolean;
  rawCookedAmbiguous?: boolean;
}

export interface Estimate {
  kcal: number;
  min: number;
  max: number;
  confidence: Confidence;
  /** Half-width of the range as a fraction of kcal. */
  pct: number;
  sources: string[];
}

const LABELS: Record<keyof UncertaintyFactors, string | null> = {
  barcodeOrMeasured: null,
  restaurant: "restaurant preparation (hidden oil and portion size)",
  boneIn: "bone-in yield (how much of the weight is edible)",
  unmeasuredOil: "cooking oil or ghee, which wasn't measured",
  mixedDish: "mixed dish with several components",
  unknownRecipe: "unknown recipe",
  portionGuessed: "portion size was an estimate",
  rawCookedAmbiguous: "raw vs cooked weight",
};

/** Pick a confidence level from uncertainty factors. */
export function confidenceFor(f: UncertaintyFactors): Confidence {
  const hard = [f.mixedDish, f.unknownRecipe].filter(Boolean).length;
  const soft = [f.restaurant, f.boneIn, f.unmeasuredOil, f.portionGuessed, f.rawCookedAmbiguous].filter(Boolean).length;
  if (f.barcodeOrMeasured && hard === 0 && soft <= 1) return "HIGH";
  if (hard >= 1 && soft + hard >= 2) return "LOW";
  if (hard >= 1 || soft >= 1) return "MEDIUM";
  return f.barcodeOrMeasured ? "HIGH" : "MEDIUM"; // never claim HIGH for an unmeasured plain guess
}

/** HIGH ±10%, MEDIUM ±15–25%, LOW ±25–40%, widening with each extra uncertainty source. */
export function rangePct(confidence: Confidence, factorCount: number): number {
  const extra = Math.max(0, factorCount - 1);
  if (confidence === "HIGH") return 0.1;
  if (confidence === "MEDIUM") return Math.min(0.25, 0.15 + 0.05 * extra);
  return Math.min(0.4, 0.25 + 0.05 * extra);
}

export function buildEstimate(kcal: number, factors: UncertaintyFactors, opts?: { bias?: number; conservative?: boolean }): Estimate {
  const confidence = confidenceFor(factors);
  const sources = (Object.keys(LABELS) as (keyof UncertaintyFactors)[])
    .filter((k) => factors[k] && LABELS[k])
    .map((k) => LABELS[k]!);
  const pct = rangePct(confidence, sources.length);
  const corrected = kcal * (opts?.bias ?? 1);
  const min = corrected * (1 - pct);
  const max = corrected * (1 + pct);
  // "Log on the higher side": use the conservative maximum as the logged figure.
  const point = opts?.conservative ? max : corrected;
  return { kcal: Math.round(point), min: Math.round(min), max: Math.round(max), confidence, pct, sources };
}

/** User said "I measured it" → HIGH confidence, ±10%. */
export function upgradeToMeasured(e: Estimate): Estimate {
  const mid = (e.min + e.max) / 2;
  return { ...e, kcal: Math.round(mid), min: Math.round(mid * 0.9), max: Math.round(mid * 1.1), confidence: "HIGH", pct: 0.1, sources: [] };
}

/** Sum estimates. Ranges are added linearly — a deliberately cautious (wide) total. */
export function sumEstimates(list: Pick<Estimate, "kcal" | "min" | "max">[]) {
  return list.reduce(
    (a, e) => ({ kcal: a.kcal + e.kcal, min: a.min + e.min, max: a.max + e.max }),
    { kcal: 0, min: 0, max: 0 },
  );
}

export function worstConfidence(list: Confidence[]): Confidence {
  if (list.includes("LOW")) return "LOW";
  if (list.includes("MEDIUM")) return "MEDIUM";
  return list.length ? "HIGH" : "MEDIUM";
}

/**
 * Calibration loop. Compare logged intake with what the 14-day weight change implies you really ate.
 * Returns an updated multiplicative bias, nudged slowly and clamped, only when logging is dense.
 *
 *   implied intake = TDEE estimate + (actual weight change in kcal / days)
 *
 * TDEE is itself an estimate, so corrections are small (30% smoothing, ±15% total cap).
 */
export function calibrate(args: {
  avgLoggedKcal: number;
  daysLogged: number;
  windowDays: number;
  tdeeEstimate: number;
  /** Observed weight change across the window from the trend line, kg (negative = lost). */
  observedChangeKg: number;
  currentBias: number;
}): { bias: number; changed: boolean; message: string } {
  const { avgLoggedKcal, daysLogged, windowDays, tdeeEstimate, observedChangeKg, currentBias } = args;
  if (daysLogged < Math.ceil(windowDays * 0.7) || avgLoggedKcal <= 0) {
    return { bias: currentBias, changed: false, message: "Not enough logged days to calibrate yet." };
  }
  const impliedIntake = tdeeEstimate + (observedChangeKg * KCAL_PER_KG_FAT) / windowDays;
  const ratio = impliedIntake / avgLoggedKcal;
  if (Math.abs(ratio - 1) < 0.07) {
    return { bias: currentBias, changed: false, message: "Your logged intake matches your weight trend well." };
  }
  const target = Math.min(1.15, Math.max(0.85, ratio));
  const bias = Math.round((currentBias * 0.7 + target * 0.3) * 1000) / 1000;
  const dir = ratio > 1 ? "under-estimating" : "over-estimating";
  return {
    bias: Math.min(1.15, Math.max(0.85, bias)),
    changed: true,
    message: `Over the last ${windowDays} days my estimates look like they've been ${dir} by roughly ${Math.round(Math.abs(ratio - 1) * 100)}%. I've nudged future estimates by a small correction.`,
  };
}
