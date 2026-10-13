/**
 * Habit consistency. No punishment mechanics: a missed day dents the score, never resets it to zero,
 * and streaks forgive a single miss ("grace day").
 */
export interface DayHabits {
  date: string;
  weighedIn: boolean;
  caloriesInRange: boolean; // logged and within ±10% of target (or under, for fat loss)
  proteinHit: boolean; // ≥ 90% of target
  stepsHit: boolean; // ≥ 80% of target
  slept: boolean; // ≥ target − 0.5h
  trained: boolean | null; // null = rest day (not counted)
  loggedFood: boolean;
}

const WEIGHTS: Record<Exclude<keyof DayHabits, "date">, number> = {
  weighedIn: 1,
  caloriesInRange: 2,
  proteinHit: 2,
  stepsHit: 1,
  slept: 1,
  trained: 2,
  loggedFood: 1,
};

export function dayScore(d: DayHabits): number {
  let got = 0;
  let max = 0;
  for (const k of Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]) {
    const v = d[k];
    if (v === null) continue;
    max += WEIGHTS[k];
    if (v) got += WEIGHTS[k];
  }
  return max ? got / max : 0;
}

/** 0–100 consistency over the supplied days. Days with nothing logged still count, softly. */
export function consistencyScore(days: DayHabits[]): number {
  if (!days.length) return 0;
  const mean = days.reduce((s, d) => s + dayScore(d), 0) / days.length;
  return Math.round(mean * 100);
}

/** Streak of days meeting `pass`, forgiving one miss (a grace day) inside the run. */
export function forgivingStreak<T>(daysNewestFirst: T[], pass: (d: T) => boolean): number {
  let streak = 0;
  let grace = 1;
  for (const d of daysNewestFirst) {
    if (pass(d)) streak++;
    else if (grace > 0 && streak > 0) grace--;
    else break;
  }
  return streak;
}

export function consistencyLabel(score: number): string {
  if (score >= 80) return "Very consistent";
  if (score >= 60) return "Solid";
  if (score >= 40) return "Building";
  return "Getting started";
}
