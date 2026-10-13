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

/**
 * Muscle-group dot colour. Only fixed brand tokens (never the metric series colours, which mean calories/protein/steps...).
 * The dot is decoration: the muscle name is always written next to it.
 */
export function muscleDot(muscle: string): string {
  const m = muscle.toLowerCase();
  if (/(quad|hamstring|glute|calf|calves|leg)/.test(m)) return "rgb(var(--brand-a))";
  if (/(chest|shoulder|delt|tricep)/.test(m)) return "rgb(var(--brand-b))";
  if (/(back|lat|bicep|trap)/.test(m)) return "rgb(var(--brand))";
  return "rgb(var(--muted))";
}

export const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Reps in reserve for an RPE, as short text ("2 RIR", "0 RIR"). */
export const rirShort = (rpe: number) => `${Math.max(0, 10 - rpe)} RIR`;
