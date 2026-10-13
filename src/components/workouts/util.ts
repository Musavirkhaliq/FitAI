import { fmtDay, fmtNum, kgToLb, lbToKg, type UnitSystem } from "@/lib/client/format";
import type { SetResultDto } from "./types";

export const unitLabel = (u: UnitSystem) => (u === "IMPERIAL" ? "lb" : "kg");

/** Weight in the user's unit as a number, rounded to a plate-friendly 0.5. */
export const toDisplay = (kg: number, u: UnitSystem) => {
  const v = u === "IMPERIAL" ? kgToLb(kg) : kg;
  return Math.round(v * 2) / 2;
};

export const fromDisplay = (v: number, u: UnitSystem) => Math.round((u === "IMPERIAL" ? lbToKg(v) : v) * 100) / 100;

export const stepFor = (u: UnitSystem) => (u === "IMPERIAL" ? 5 : 2.5);

/** Engine text is written in kg ("60kg"); rewrite it for imperial users. */
export function localizeKg(text: string, u: UnitSystem): string {
  if (u === "METRIC") return text;
  return text.replace(/(\d+(?:\.\d+)?)\s?kg/g, (_, n: string) => `${fmtNum(toDisplay(Number(n), u), 1)}lb`);
}

/** "60 kg × 8, 8, 7 · 55 kg × 6" — consecutive sets at the same weight are grouped. */
export function formatSets(sets: SetResultDto[], u: UnitSystem): string {
  const groups: { w: number; reps: number[] }[] = [];
  for (const s of sets) {
    const last = groups[groups.length - 1];
    if (last && last.w === s.weightKg) last.reps.push(s.reps);
    else groups.push({ w: s.weightKg, reps: [s.reps] });
  }
  return groups.map((g) => `${fmtNum(toDisplay(g.w, u), 1)} ${unitLabel(u)} × ${g.reps.join(", ")}`).join(" · ");
}

export const previousLine = (prev: { date: string; sets: SetResultDto[] }, u: UnitSystem) => `${formatSets(prev.sets, u)} (${fmtDay(prev.date)})`;

export const MUSCLE_LABEL = (m: string) => m.charAt(0).toUpperCase() + m.slice(1);
