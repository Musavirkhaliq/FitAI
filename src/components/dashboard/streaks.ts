import type { DailyPointDto } from "@/lib/client/types";
import { forgivingStreak } from "@/lib/engines/habits";

export interface StreakTargets { protein: number; steps: number }

export interface StreakHabit {
  key: string;
  label: string;
  /** True when the habit needs a goal (protein/steps targets) to be evaluated. */
  needsTarget: boolean;
  pass: (d: DailyPointDto, t: StreakTargets | null) => boolean;
}

/** Same thresholds as the weekly habit grid and consistency score. Training is handled separately (no known plan schedule). */
export const STREAK_HABITS: StreakHabit[] = [
  { key: "weigh", label: "Weigh-in", needsTarget: false, pass: (d) => d.weightKg != null },
  { key: "food", label: "Food logged", needsTarget: false, pass: (d) => d.calories != null },
  { key: "protein", label: "Protein near target", needsTarget: true, pass: (d, t) => !!t && (d.protein ?? 0) >= t.protein * 0.9 },
  { key: "steps", label: "Steps near target", needsTarget: true, pass: (d, t) => !!t && (d.steps ?? 0) >= t.steps * 0.8 },
];

export const trained = (d: DailyPointDto) => d.trainingMin > 0 || d.volume > 0;

/** Current run: evaluated from yesterday backwards; today is added only if it already passes (never breaks a run while unfinished). */
export function currentRun(daysAsc: DailyPointDto[], today: string, pass: (d: DailyPointDto) => boolean): number {
  const past = daysAsc.filter((d) => d.date < today).reverse();
  const t = daysAsc.find((d) => d.date === today);
  return forgivingStreak(t && pass(t) ? [t, ...past] : past, pass);
}

/** Longest run in the window using the same forgiving rule (one miss inside a run is forgiven). */
export function bestRun(daysAsc: DailyPointDto[], today: string, pass: (d: DailyPointDto) => boolean): number {
  const nf = daysAsc.filter((d) => d.date <= today).reverse();
  let best = 0;
  for (let i = 0; i < nf.length; i++) {
    if (pass(nf[i])) best = Math.max(best, forgivingStreak(nf.slice(i), pass));
  }
  return best;
}
