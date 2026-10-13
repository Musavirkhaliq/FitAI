import { addDays } from "@/lib/dates";
import { fmtDay, fmtNum, kgToLb, type UnitSystem } from "@/lib/client/format";

export const wUnit = (u: UnitSystem) => (u === "IMPERIAL" ? "lb" : "kg");
export const wv = (kg: number, u: UnitSystem) => (u === "IMPERIAL" ? kgToLb(kg) : kg);
export const round1 = (n: number) => Math.round(n * 10) / 10;

/** Short axis label, e.g. "3 Mar". */
export const shortDay = (d: string) => fmtDay(d, { day: "numeric", month: "short" });

export const mean = (xs: (number | null)[]): number | null => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};

/** Plain-language strength + direction of a correlation coefficient. */
export function describeCorr(r: number | null): string {
  if (r == null) return "not enough data yet";
  const a = Math.abs(r);
  if (a < 0.2) return "no clear link (very weak)";
  const strength = a < 0.4 ? "weak" : a < 0.6 ? "moderate" : "strong";
  return `${strength}, ${r > 0 ? "positive" : "negative"}`;
}

export const corrLabel = (r: number | null) => `${describeCorr(r)}${r == null ? "" : ` (r = ${r.toFixed(2)})`}`;

/** Week bucket (Monday start) → inclusive end date. */
export const weekEnd = (week: string) => addDays(week, 6);

/** Y-axis domain padded around the data so a flat-ish line doesn't hug the edges. */
export const padDomain = [(min: number) => Math.floor(min - 0.5), (max: number) => Math.ceil(max + 0.5)] as [(n: number) => number, (n: number) => number];

export const fmtRange = (from: string, to: string) => `${fmtDay(from, { day: "numeric", month: "short", year: "numeric" })} to ${fmtDay(to, { day: "numeric", month: "short", year: "numeric" })}`;

export const avgText = (v: number | null, unit: string, dp = 0) => (v == null ? "no data" : `${fmtNum(v, dp)} ${unit}`);

/** Axis-friendly number: 8400 → "8.4k". */
export const compactNum = (v: number) => (Math.abs(v) >= 10000 ? `${Math.round(v / 1000)}k` : Math.abs(v) >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v * 10) / 10));

/** Signed delta as text: "+0.4", "−1.2", "0". */
export const signed = (n: number, dp = 1) => {
  const r = Math.round(n * 10 ** dp) / 10 ** dp;
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${fmtNum(Math.abs(r), dp)}`;
};
