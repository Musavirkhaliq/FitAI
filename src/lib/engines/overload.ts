/** Progressive overload: double progression, RPE/RIR auto-regulation, 1RM estimation, volume landmarks. */

export interface SetResult {
  weightKg: number;
  reps: number;
  rpe?: number | null;
}

export const rirFromRpe = (rpe: number) => Math.max(0, 10 - rpe);

export const epley1RM = (w: number, reps: number) => (reps <= 1 ? w : w * (1 + reps / 30));
export const brzycki1RM = (w: number, reps: number) => (reps <= 1 ? w : (w * 36) / (37 - reps));

/**
 * Robust 1RM from a list of sets. Sets above 12 reps are ignored (formulas drift badly), each remaining
 * set uses the mean of Epley and Brzycki (Epley alone at 11–12 reps), and the median is returned so one
 * generous set can't inflate the estimate.
 */
export function robust1RM(sets: SetResult[]): number | null {
  const est = sets
    .filter((s) => s.reps >= 1 && s.reps <= 12 && s.weightKg > 0)
    .map((s) => (s.reps <= 10 ? (epley1RM(s.weightKg, s.reps) + brzycki1RM(s.weightKg, s.reps)) / 2 : epley1RM(s.weightKg, s.reps)));
  if (!est.length) return null;
  est.sort((a, b) => a - b);
  const mid = est.length % 2 ? est[(est.length - 1) / 2] : (est[est.length / 2 - 1] + est[est.length / 2]) / 2;
  return Math.round(mid * 10) / 10;
}

export const roundToIncrement = (kg: number, inc = 2.5) => Math.round(kg / inc) * inc;

export interface PrescriptionInput {
  repMin: number;
  repMax: number;
  numSets: number;
  targetRpe: number;
  /** Smallest practical jump (2.5 for barbells, 1–2 for dumbbells). */
  incrementKg?: number;
  lastSession?: SetResult[];
  /** Consecutive planned sessions skipped for this lift. */
  missedInRow?: number;
  /** Consecutive training weeks the user rated hard. */
  hardWeeks?: number;
  /** Top-set RPE for the most recent sessions of this exercise, newest first. */
  recentTopRpe?: number[];
}

export interface Prescription {
  weightKg: number | null;
  targetReps: number[];
  deload: boolean;
  reason: string;
  /** Human-readable, e.g. "Today try 60kg for 8, 8, 8." */
  text: string;
}

export function prescribeNext(i: PrescriptionInput): Prescription {
  const inc = i.incrementKg ?? 2.5;
  const last = i.lastSession ?? [];
  if (!last.length) {
    return {
      weightKg: null,
      targetReps: Array(i.numSets).fill(i.repMin),
      deload: false,
      reason: "First time on this lift.",
      text: `New exercise: pick a weight you could lift for ${i.repMax} reps with 2–3 reps left in the tank, and do ${i.numSets} sets of ${i.repMin}–${i.repMax}.`,
    };
  }
  const lastWeight = Math.max(...last.map((s) => s.weightKg));
  const atLastWeight = last.filter((s) => s.weightKg === lastWeight);
  const fmt = (w: number) => `${Number.isInteger(w) ? w : w.toFixed(1)}kg`;

  const hardStreak = (i.recentTopRpe ?? []).slice(0, 2);
  const rpeDeload = hardStreak.length === 2 && hardStreak.every((r) => r >= 9);
  if ((i.hardWeeks ?? 0) >= 3 || rpeDeload) {
    const w = roundToIncrement(lastWeight * 0.9, inc);
    return {
      weightKg: w,
      targetReps: Array(i.numSets).fill(i.repMin),
      deload: true,
      reason: rpeDeload ? "RPE has been 9+ on the last two sessions." : "Three hard weeks in a row.",
      text: `Deload: ${fmt(w)} for ${i.numSets} × ${i.repMin}, keeping every set easy (RPE ≤ 7). Come back to ${fmt(lastWeight)} next week.`,
    };
  }
  if ((i.missedInRow ?? 0) >= 2) {
    const w = roundToIncrement(lastWeight * 0.9, inc);
    return {
      weightKg: w,
      targetReps: atLastWeight.map((s) => s.reps),
      deload: false,
      reason: "Two sessions missed.",
      text: `Welcome back. Ease in at ${fmt(w)} (10% under last time) and rebuild from there.`,
    };
  }

  const allAtTop = atLastWeight.length >= i.numSets && atLastWeight.every((s) => s.reps >= i.repMax);
  const topRpe = Math.max(...last.map((s) => s.rpe ?? 0));
  if (allAtTop) {
    const capped = Math.min(lastWeight + inc, lastWeight * 1.1); // never > +10%
    const w = Math.max(roundToIncrement(capped, inc), lastWeight);
    const heavy = topRpe >= 9.5 && w > lastWeight;
    return {
      weightKg: heavy ? lastWeight : w,
      targetReps: Array(i.numSets).fill(heavy ? i.repMax : i.repMin),
      deload: false,
      reason: heavy ? "Reps hit the top, but the effort was near-maximal." : "All sets hit the top of the rep range.",
      text: heavy
        ? `You hit ${i.repMax} reps on every set, but it was close to max effort. Repeat ${fmt(lastWeight)} once more with cleaner reps before adding load.`
        : `You hit ${i.repMax} reps on every set — go up to ${fmt(w)} and start back at ${i.repMin} reps.`,
    };
  }

  // Add reps first: each set aims one rep higher than last time, capped at the top of the range.
  const reps = atLastWeight.map((s) => Math.min(s.reps + 1, i.repMax));
  while (reps.length < i.numSets) reps.push(reps[reps.length - 1] ?? i.repMin);
  const lastReps = atLastWeight.map((s) => s.reps).join(", ");
  const rpeNote =
    topRpe && topRpe < i.targetRpe - 1 ? " It felt easy last time — push closer to your target effort." : topRpe >= 9 ? " Last time was very hard, so stay controlled." : "";
  return {
    weightKg: lastWeight,
    targetReps: reps,
    deload: false,
    reason: "Double progression: add reps before weight.",
    text: `Last time: ${fmt(lastWeight)} for ${lastReps}. Today try ${fmt(lastWeight)} for ${reps.join(", ")}. At ${i.numSets} × ${i.repMax} with good form, go up to ${fmt(lastWeight + inc)}.${rpeNote}`,
  };
}

// --- Volume landmarks (hard sets per muscle per week) -------------------------------------------
export const VOLUME_LANDMARKS: Record<string, { mev: number; mrv: number }> = {
  chest: { mev: 8, mrv: 22 },
  back: { mev: 10, mrv: 25 },
  quads: { mev: 8, mrv: 20 },
  hamstrings: { mev: 6, mrv: 20 },
  glutes: { mev: 0, mrv: 16 },
  shoulders: { mev: 8, mrv: 26 },
  biceps: { mev: 8, mrv: 26 },
  triceps: { mev: 6, mrv: 18 },
  calves: { mev: 8, mrv: 20 },
  abs: { mev: 0, mrv: 25 },
};

export type VolumeStatus = "BELOW_MEV" | "PRODUCTIVE" | "NEAR_MRV" | "OVER_MRV";

export function volumeStatus(muscle: string, hardSets: number): { status: VolumeStatus; mev: number; mrv: number } {
  const lm = VOLUME_LANDMARKS[muscle.toLowerCase()] ?? { mev: 6, mrv: 20 };
  const status: VolumeStatus =
    hardSets < lm.mev ? "BELOW_MEV" : hardSets > lm.mrv ? "OVER_MRV" : hardSets >= lm.mrv - 2 ? "NEAR_MRV" : "PRODUCTIVE";
  return { status, ...lm };
}

/** Count sets with reasonable effort (RPE ≥ 6 or unspecified) per muscle group. */
export function weeklyHardSets(sets: { muscleGroup: string; rpe?: number | null }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of sets) {
    if (s.rpe != null && s.rpe < 6) continue;
    const k = s.muscleGroup.toLowerCase();
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}
