import { addDays, daysBetween, type DateStr } from "../dates";

export interface WeightPoint {
  date: DateStr;
  weightKg: number;
}

export type TrendStatus =
  | "FAST_LOSS"
  | "TARGET_LOSS"
  | "SLOW_LOSS"
  | "PLATEAU"
  | "GAINING"
  | "INSUFFICIENT_DATA";

export interface TrendSummary {
  status: TrendStatus;
  latest: WeightPoint | null;
  changeFromYesterdayKg: number | null;
  changeFromStartKg: number | null;
  ma7: number | null;
  ma14: number | null;
  ma30: number | null;
  /** Least-squares slope over the last 14 days, kg/week (negative = losing). */
  weeklyRateKg: number | null;
  /** Least-squares slope over the last 30 days, scaled to 30 days. */
  monthlyChangeKg: number | null;
  /** Fraction of body weight per week (negative = losing). */
  weeklyRatePct: number | null;
  sustainedFastLoss: boolean;
  /** How many days of data back the 14-day verdict. */
  spanDays: number;
  daysOfData: number;
  note: string;
}

const sortByDate = (pts: WeightPoint[]) => [...pts].sort((a, b) => (a.date < b.date ? -1 : 1));

/** Mean of all points in the `windowDays` ending at (and including) `end`. */
export function movingAverage(points: WeightPoint[], end: DateStr, windowDays: number): number | null {
  const from = addDays(end, -(windowDays - 1));
  const inWin = points.filter((p) => p.date >= from && p.date <= end);
  if (!inWin.length) return null;
  return inWin.reduce((s, p) => s + p.weightKg, 0) / inWin.length;
}

/** Least-squares slope in kg/day over points in the window; null if too sparse to trust. */
export function slopePerDay(points: WeightPoint[], end: DateStr, windowDays: number, minPoints = 3): number | null {
  const from = addDays(end, -(windowDays - 1));
  const win = points.filter((p) => p.date >= from && p.date <= end);
  if (win.length < minPoints) return null;
  const xs = win.map((p) => daysBetween(from, p.date));
  const ys = win.map((p) => p.weightKg);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? null : num / den;
}

/** Daily series with 7- and 14-day moving averages, for charts. */
export function trendSeries(points: WeightPoint[]) {
  const sorted = sortByDate(points);
  return sorted.map((p) => ({
    date: p.date,
    weight: p.weightKg,
    ma7: movingAverage(sorted, p.date, 7),
    ma14: movingAverage(sorted, p.date, 14),
  }));
}

export function classifyRate(weeklyRateKg: number, weightKg: number): TrendStatus {
  if (weeklyRateKg >= 0.1) return "GAINING";
  if (weeklyRateKg > -0.1) return "PLATEAU";
  const loss = -weeklyRateKg;
  if (loss > weightKg * 0.01) return "FAST_LOSS";
  if (loss < 0.25) return "SLOW_LOSS";
  return "TARGET_LOSS";
}

/**
 * Summarise the weight trend as of `asOf`. The verdict only uses a 14-day window and refuses to
 * classify with fewer than 5 weigh-ins spanning 10+ days — one or two odd weigh-ins never move it.
 */
export function summarizeTrend(
  points: WeightPoint[],
  asOf: DateStr,
  startWeightKg?: number | null,
): TrendSummary {
  const sorted = sortByDate(points.filter((p) => p.date <= asOf));
  const latest = sorted.length ? sorted[sorted.length - 1] : null;
  const empty: TrendSummary = {
    status: "INSUFFICIENT_DATA",
    latest,
    changeFromYesterdayKg: null,
    changeFromStartKg: null,
    ma7: null,
    ma14: null,
    ma30: null,
    weeklyRateKg: null,
    monthlyChangeKg: null,
    weeklyRatePct: null,
    sustainedFastLoss: false,
    spanDays: 0,
    daysOfData: sorted.length,
    note: "Log a few more morning weigh-ins and I'll show your trend.",
  };
  if (!latest) return empty;

  const yesterday = sorted.find((p) => p.date === addDays(asOf, -1));
  const today = sorted.find((p) => p.date === asOf);
  const base = startWeightKg ?? sorted[0].weightKg;

  const win14 = sorted.filter((p) => p.date >= addDays(asOf, -13));
  const spanDays = win14.length ? daysBetween(win14[0].date, win14[win14.length - 1].date) : 0;
  const slope14 = slopePerDay(sorted, asOf, 14, 5);
  const slope30 = slopePerDay(sorted, asOf, 30, 5);

  const ma7 = movingAverage(sorted, asOf, 7);
  const ma7Prev = movingAverage(sorted, addDays(asOf, -7), 7);
  const ma7Prev2 = movingAverage(sorted, addDays(asOf, -14), 7);
  const refWeight = ma7 ?? latest.weightKg;
  const fastThreshold = refWeight * 0.01;
  const sustainedFastLoss =
    ma7 != null && ma7Prev != null && ma7Prev2 != null && ma7Prev - ma7 > fastThreshold && ma7Prev2 - ma7Prev > fastThreshold;

  const enough = slope14 != null && spanDays >= 10;
  const weeklyRateKg = enough ? slope14! * 7 : null;
  const status = weeklyRateKg == null ? "INSUFFICIENT_DATA" : classifyRate(weeklyRateKg, refWeight);

  return {
    status,
    latest,
    changeFromYesterdayKg: today && yesterday ? round(today.weightKg - yesterday.weightKg) : null,
    changeFromStartKg: round(latest.weightKg - base),
    ma7: ma7 == null ? null : round(ma7),
    ma14: round(movingAverage(sorted, asOf, 14)),
    ma30: round(movingAverage(sorted, asOf, 30)),
    weeklyRateKg: weeklyRateKg == null ? null : round(weeklyRateKg, 2),
    monthlyChangeKg: slope30 == null ? null : round(slope30 * 30, 2),
    weeklyRatePct: weeklyRateKg == null ? null : round((weeklyRateKg / refWeight) * 100, 2),
    sustainedFastLoss,
    spanDays,
    daysOfData: sorted.length,
    note: narrate(status, weeklyRateKg),
  };
}

function narrate(status: TrendStatus, rate: number | null): string {
  const r = rate == null ? "" : ` (about ${Math.abs(rate).toFixed(2)} kg/week)`;
  switch (status) {
    case "FAST_LOSS":
      return `Weight is dropping faster than is usually sustainable${r}. Worth eating a little more, not less.`;
    case "TARGET_LOSS":
      return `Weight is trending down at a healthy pace${r}. Nothing to change.`;
    case "SLOW_LOSS":
      return `Weight is trending down slowly${r}.`;
    case "PLATEAU":
      return "Weight has been roughly flat over the last two weeks.";
    case "GAINING":
      return `Weight is trending up${r}. Single-day jumps are mostly water; this is the two-week trend.`;
    default:
      return "Not enough weigh-ins yet for a reliable trend — aim for 5+ across two weeks.";
  }
}

function round(n: number | null, dp = 1): number {
  if (n == null) return NaN;
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
