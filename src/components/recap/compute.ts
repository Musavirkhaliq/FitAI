import { mean } from "@/components/analytics/util";
import type { PrDto } from "@/components/workouts/types";
import { fmtDay, fmtNum, kgToLb, type UnitSystem } from "@/lib/client/format";
import type { DailyPointDto } from "@/lib/client/types";
import { dateRange } from "@/lib/dates";

export interface RecapTargets { calories: number; protein: number; steps: number; sleepH: number }
export type FocusKey = "logging" | "protein" | "steps" | "sleep" | "training";

export interface RecapDay { date: string; weekday: string; initial: string; showed: boolean }

export interface Recap {
  from: string;
  to: string;
  days: RecapDay[];
  daysShowed: number;
  prevDaysShowed: number | null;
  fuel: { avgCalories: number; avgProtein: number | null; loggedDays: number; proteinHitDays: number | null; deltaCalories: number | null } | null;
  move: { avgSteps: number; best: { date: string; steps: number }; daysAtGoal: number | null } | null;
  train: { sessions: number; volumeKg: number; prs: PrDto[] } | null;
  recover: { avgSleep: number; best: { date: string; hours: number }; nightsAtTarget: number | null } | null;
  weight: { avgKg: number; deltaKg: number | null; weighIns: number } | null;
  targets: RecapTargets | null;
  focus: FocusKey;
}

const showedUp = (d: DailyPointDto) => d.calories != null || d.weightKg != null || (d.steps ?? 0) > 0 || d.sleepH != null || d.trainingMin > 0 || d.volume > 0;
const nums = (xs: (number | null)[]) => xs.filter((x): x is number => x != null);

/** Pure maths for the weekly recap. Averages only use days that have data, and "est." is applied by the caller. */
export function buildRecap(input: {
  from: string; to: string; days: DailyPointDto[]; prevDays: DailyPointDto[] | null; targets: RecapTargets | null; prs: PrDto[]; plannedSessions: number;
}): Recap {
  const { from, to, targets } = input;
  const byDate = new Map(input.days.map((d) => [d.date, d]));
  const empty = (date: string): DailyPointDto => ({ date, calories: null, protein: null, fiber: null, steps: null, sleepH: null, weightKg: null, trainingMin: 0, volume: 0, hardSets: 0 });
  const days = dateRange(from, to).map((date) => byDate.get(date) ?? empty(date));
  const info: RecapDay[] = days.map((d) => ({ date: d.date, weekday: fmtDay(d.date, { weekday: "long" }), initial: fmtDay(d.date, { weekday: "narrow" }), showed: showedUp(d) }));
  const daysShowed = info.filter((d) => d.showed).length;
  const prev = input.prevDays;

  // Fuel
  const cal = days.filter((d) => d.calories != null);
  const avgCal = mean(cal.map((d) => d.calories));
  const prevAvgCal = prev ? mean(prev.map((d) => d.calories)) : null;
  const proteinDays = days.filter((d) => d.protein != null);
  const fuel: Recap["fuel"] = avgCal == null ? null : {
    avgCalories: Math.round(avgCal),
    avgProtein: proteinDays.length ? Math.round(mean(proteinDays.map((d) => d.protein)) ?? 0) : null,
    loggedDays: cal.length,
    proteinHitDays: targets ? proteinDays.filter((d) => (d.protein ?? 0) >= targets.protein * 0.9).length : null,
    deltaCalories: prevAvgCal == null ? null : Math.round(avgCal - prevAvgCal),
  };

  // Move
  const stepDays = days.filter((d) => (d.steps ?? 0) > 0);
  const bestSteps = stepDays.reduce<DailyPointDto | null>((b, d) => (!b || (d.steps ?? 0) > (b.steps ?? 0) ? d : b), null);
  const move: Recap["move"] = bestSteps ? {
    avgSteps: Math.round(mean(stepDays.map((d) => d.steps)) ?? 0),
    best: { date: bestSteps.date, steps: bestSteps.steps ?? 0 },
    daysAtGoal: targets ? stepDays.filter((d) => (d.steps ?? 0) >= targets.steps).length : null,
  } : null;

  // Train
  const trained = days.filter((d) => d.trainingMin > 0 || d.volume > 0);
  const prsInWeek = input.prs.filter((p) => p.date.slice(0, 10) >= from && p.date.slice(0, 10) <= to);
  const train: Recap["train"] = trained.length || prsInWeek.length ? { sessions: trained.length, volumeKg: days.reduce((t, d) => t + d.volume, 0), prs: prsInWeek } : null;

  // Recover
  const sleepDays = days.filter((d) => d.sleepH != null);
  const bestSleep = sleepDays.reduce<DailyPointDto | null>((b, d) => (!b || (d.sleepH ?? 0) > (b.sleepH ?? 0) ? d : b), null);
  const recover: Recap["recover"] = bestSleep ? {
    avgSleep: Math.round((mean(sleepDays.map((d) => d.sleepH)) ?? 0) * 10) / 10,
    best: { date: bestSleep.date, hours: bestSleep.sleepH ?? 0 },
    nightsAtTarget: targets ? sleepDays.filter((d) => (d.sleepH ?? 0) >= targets.sleepH * 0.95).length : null,
  } : null;

  // Weight: the weekly average against last week's average (never a single day)
  const wNow = nums(days.map((d) => d.weightKg));
  const wPrev = prev ? nums(prev.map((d) => d.weightKg)) : [];
  const avgNow = mean(wNow);
  const weight: Recap["weight"] = avgNow == null ? null : { avgKg: avgNow, deltaKg: wPrev.length ? avgNow - (mean(wPrev) ?? avgNow) : null, weighIns: wNow.length };

  // Focus: the habit with the most room, offered as an invitation (never a verdict)
  const scores: { key: FocusKey; score: number }[] = [{ key: "logging", score: cal.length / Math.max(1, days.length) }];
  if (fuel?.proteinHitDays != null && proteinDays.length) scores.push({ key: "protein", score: fuel.proteinHitDays / proteinDays.length });
  if (targets && stepDays.length) scores.push({ key: "steps", score: Math.min(1, (move?.avgSteps ?? 0) / targets.steps) });
  else if (targets) scores.push({ key: "steps", score: 0 });
  if (targets && recover) scores.push({ key: "sleep", score: Math.min(1, recover.avgSleep / targets.sleepH) });
  scores.push({ key: "training", score: Math.min(1, trained.length / Math.max(1, input.plannedSessions)) });
  const focus = scores.reduce((lo, s) => (s.score < lo.score ? s : lo)).key;

  return { from, to, days: info, daysShowed, prevDaysShowed: prev ? prev.filter(showedUp).length : null, fuel, move, train, recover, weight, targets, focus };
}

/** Warm, specific sentence for the "days you showed up" card. Never shames a quiet week. */
export function showedUpLine(n: number, total: number): string {
  if (n >= total) return `Every single day. That kind of consistency is the whole game.`;
  if (n >= 5) return `You showed up ${n} days this week. That's a real rhythm.`;
  if (n >= 3) return `A steady week. You logged ${n} days, and that counts.`;
  if (n >= 1) return `A quieter week. You still logged ${n} ${n === 1 ? "day" : "days"}, and that counts.`;
  return `A rest week, and that's okay. One tiny log is all it takes to start again.`;
}

export const FOCUS_TEXT: Record<FocusKey, { title: string; body: string }> = {
  logging: { title: "Log one meal a day", body: "Next week, would you like to try logging just one meal a day, the easiest one? Small and steady beats perfect." },
  protein: { title: "Add a protein snack", body: "Next week, would you like to try adding one protein-rich snack on three days, like Greek yoghurt, eggs or cottage cheese?" },
  steps: { title: "A walk after dinner", body: "Next week, would you like to try a 10-minute walk after dinner on three evenings? It adds up faster than it sounds." },
  sleep: { title: "One steady bedtime", body: "Next week, would you like to try the same bedtime on three nights? A little regularity goes a long way." },
  training: { title: "One session you'll keep", body: "Next week, would you like to pencil in one session you're certain you'll do? Anything beyond it is a bonus." },
};

const w = (kg: number, u: UnitSystem) => (u === "IMPERIAL" ? kgToLb(kg) : kg);

/** Plain-text summary for the Copy button. */
export function recapText(r: Recap, units: UnitSystem): string {
  const u = units === "IMPERIAL" ? "lb" : "kg";
  const range = `${fmtDay(r.from, { day: "numeric", month: "short" })} to ${fmtDay(r.to, { day: "numeric", month: "short" })}`;
  const lines = [`My week, wrapped (${range})`, `Showed up: ${r.daysShowed} of ${r.days.length} days.`];
  if (r.fuel) lines.push(`Fuel: about ${fmtNum(r.fuel.avgCalories)} kcal a day (est.)${r.fuel.avgProtein != null ? `, ${fmtNum(r.fuel.avgProtein)} g protein` : ""}.`);
  if (r.move) lines.push(`Move: ${fmtNum(r.move.avgSteps)} steps a day on average, best day ${fmtDay(r.move.best.date, { weekday: "long" })} with ${fmtNum(r.move.best.steps)}.`);
  if (r.train) lines.push(`Train: ${r.train.sessions} ${r.train.sessions === 1 ? "session" : "sessions"}, ${fmtNum(Math.round(w(r.train.volumeKg, units)))} ${u} lifted${r.train.prs.length ? `, ${r.train.prs.length} new personal ${r.train.prs.length === 1 ? "best" : "bests"}` : ""}.`);
  if (r.recover) lines.push(`Recover: ${fmtNum(r.recover.avgSleep, 1)} h of sleep a night on average.`);
  if (r.weight) lines.push(`Weight: ${fmtNum(w(r.weight.avgKg, units), 1)} ${u} average${r.weight.deltaKg != null ? ` (${r.weight.deltaKg > 0 ? "+" : r.weight.deltaKg < 0 ? "−" : ""}${fmtNum(Math.abs(w(r.weight.deltaKg, units)), 1)} ${u} vs last week)` : ""}.`);
  lines.push(`Next week: ${FOCUS_TEXT[r.focus].title}.`);
  return lines.join("\n");
}
