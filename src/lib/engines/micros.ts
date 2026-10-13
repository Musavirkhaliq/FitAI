import type { SexLike } from "./calories";

export type MicroKey = "calcium" | "iron" | "potassium" | "vitA" | "vitC" | "vitD" | "vitB12" | "folate" | "sodium";

export interface MicroRef {
  key: MicroKey;
  label: string;
  unit: string;
  /** Approximate adult reference intake per day. For sodium it's an upper guide, not a goal. */
  target: number;
  kind: "goal" | "limit";
}

/**
 * Rounded adult reference intakes (RDA/AI-style) for a general healthy adult, to give micronutrient totals some
 * context. They are rough guides, not individual prescriptions: needs vary with age, pregnancy, health and diet.
 */
export function microReferences(sex: SexLike): MicroRef[] {
  const female = sex === "FEMALE";
  return [
    { key: "calcium", label: "Calcium", unit: "mg", target: 1000, kind: "goal" },
    { key: "iron", label: "Iron", unit: "mg", target: female ? 18 : 8, kind: "goal" },
    { key: "potassium", label: "Potassium", unit: "mg", target: female ? 2600 : 3400, kind: "goal" },
    { key: "vitA", label: "Vitamin A", unit: "µg", target: female ? 700 : 900, kind: "goal" },
    { key: "vitC", label: "Vitamin C", unit: "mg", target: female ? 75 : 90, kind: "goal" },
    { key: "vitD", label: "Vitamin D", unit: "µg", target: 15, kind: "goal" },
    { key: "vitB12", label: "Vitamin B12", unit: "µg", target: 2.4, kind: "goal" },
    { key: "folate", label: "Folate", unit: "µg", target: 400, kind: "goal" },
    { key: "sodium", label: "Sodium", unit: "mg", target: 2300, kind: "limit" },
  ];
}

export type Micros = Record<MicroKey, number>;

export const emptyMicros = (): Micros => ({ calcium: 0, iron: 0, potassium: 0, vitA: 0, vitC: 0, vitD: 0, vitB12: 0, folate: 0, sodium: 0 });

/** Sum the `micros` JSON blobs (and sodium column) of a day's food entries. Missing values count as 0. */
export function sumMicros(entries: { sodium: number; micros: unknown }[]): Micros {
  const t = emptyMicros();
  for (const e of entries) {
    t.sodium += e.sodium || 0;
    const m = (e.micros ?? {}) as Partial<Record<MicroKey, unknown>>;
    for (const k of Object.keys(t) as MicroKey[]) {
      if (k === "sodium") continue;
      const v = Number(m[k]);
      if (Number.isFinite(v)) t[k] += v;
    }
  }
  for (const k of Object.keys(t) as MicroKey[]) t[k] = Math.round(t[k] * 10) / 10;
  return t;
}

export type MicroStatus = "LOW" | "OK" | "HIGH";

/**
 * Plain-language status for the day so far. Partial-day totals will look "low" early on, so callers should present it as
 * "so far" and only call a nutrient low when a weekly average is under ~60% of the reference.
 */
export function microStatus(ref: MicroRef, amount: number): MicroStatus {
  const ratio = amount / ref.target;
  if (ref.kind === "limit") return ratio > 1 ? "HIGH" : "OK";
  return ratio < 0.6 ? "LOW" : "OK";
}
