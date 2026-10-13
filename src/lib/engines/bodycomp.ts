import type { SexLike } from "./calories";

export interface BodyFatRange {
  low: number;
  mid: number;
  high: number;
  fatMassKg: { low: number; high: number };
  leanMassKg: { low: number; high: number };
  method: string;
}

/**
 * U.S. Navy circumference estimate. Typical error is ±3–4 percentage points, so the output is a range
 * and is labelled an estimate, never a clinical measurement.
 */
export function navyBodyFat(args: {
  sex: SexLike;
  heightCm: number;
  waistCm: number;
  neckCm: number;
  hipCm?: number | null;
  weightKg: number;
}): BodyFatRange | null {
  const { sex, heightCm, waistCm, neckCm, hipCm, weightKg } = args;
  if (!sex || waistCm <= neckCm) return null;
  let pct: number;
  if (sex === "MALE") {
    pct = 86.01 * Math.log10(waistCm - neckCm) - 70.041 * Math.log10(heightCm) + 36.76;
  } else {
    if (!hipCm || waistCm + hipCm <= neckCm) return null;
    pct = 163.205 * Math.log10(waistCm + hipCm - neckCm) - 97.684 * Math.log10(heightCm) - 78.387;
  }
  if (!Number.isFinite(pct)) return null;
  const mid = Math.min(60, Math.max(3, pct));
  const low = Math.max(2, mid - 3.5);
  const high = Math.min(65, mid + 3.5);
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return {
    low: r1(low),
    mid: r1(mid),
    high: r1(high),
    fatMassKg: { low: r1((weightKg * low) / 100), high: r1((weightKg * high) / 100) },
    leanMassKg: { low: r1(weightKg * (1 - high / 100)), high: r1(weightKg * (1 - low / 100)) },
    method: "U.S. Navy tape estimate (±3–4 points). Not a clinical measurement.",
  };
}

/** Rough fat lost to date from the weight change: an estimate that assumes ~75% of loss is fat. */
export function estimateFatLost(weightChangeKg: number): { lowKg: number; highKg: number } | null {
  if (weightChangeKg >= 0) return null;
  const lost = -weightChangeKg;
  return { lowKg: Math.round(lost * 0.6 * 10) / 10, highKg: Math.round(lost * 0.9 * 10) / 10 };
}
