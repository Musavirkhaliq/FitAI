"use client";
import { chartColors } from "@/components/ui";
import { fmtDay, fmtNum, type UnitSystem } from "@/lib/client/format";
import type { DailyPointDto } from "@/lib/client/types";
import { StackedCharts, type StackPanel, type StackRow } from "./StackedCharts";
import type { AnalyticsDto, Granularity, WeeklyDto, WeightPointDto } from "./types";
import { describeCorr, mean, round1, wUnit, wv } from "./util";
import { ChartEmpty } from "./WeightCharts";

/**
 * Habits and weight on a shared time axis, as stacked small multiples: weight (7-day average) on top, then calories, protein,
 * steps and sleep. Each measure has its own scale, so there is no dual-axis chart. Read the shapes over time, not the heights.
 */
export function HabitsVsWeightChart({ gran, days, weekly, weightSeries, units, targets, correlations }: {
  gran: Granularity; days: DailyPointDto[]; weekly: WeeklyDto[]; weightSeries: WeightPointDto[]; units: UnitSystem;
  targets: AnalyticsDto["targets"]; correlations: AnalyticsDto["correlations"];
}) {
  const wu = wUnit(units);
  const ma = new Map(weightSeries.map((p) => [p.date, p.ma7]));
  const conv = (kg: number | null | undefined) => (kg == null ? null : round1(wv(kg, units)));
  const rows: StackRow[] =
    gran === "daily"
      ? days.map((d) => ({ date: d.date, w: conv(ma.get(d.date)), cal: d.calories, pro: d.protein, steps: d.steps, sleep: d.sleepH }))
      : weekly.map((w) => ({ date: w.week, w: conv(w.weightAvg), cal: w.avgCalories, pro: w.avgProtein, steps: w.avgSteps, sleep: w.avgSleep }));

  const count = (k: string) => rows.filter((r) => r[k] != null).length;
  const all: (StackPanel & { need: boolean })[] = [
    { key: "w", label: `Weight, 7-day average (${wu})`, unit: wu, color: chartColors.brand, kind: "line", dp: 1, need: count("w") >= 2 },
    { key: "cal", label: gran === "daily" ? "Calories eaten (est.)" : "Calories eaten (est., average per day)", unit: "kcal", color: chartColors.cal, kind: "bar", target: targets?.calories, need: count("cal") >= 2 },
    { key: "pro", label: gran === "daily" ? "Protein" : "Protein (average per day)", unit: "g", color: chartColors.protein, kind: "bar", target: targets?.protein, need: count("pro") >= 2 },
    { key: "steps", label: gran === "daily" ? "Steps" : "Steps (average per day)", unit: "steps", color: chartColors.steps, kind: "bar", target: targets?.steps, need: count("steps") >= 2 },
    { key: "sleep", label: gran === "daily" ? "Sleep" : "Sleep (average per night)", unit: "h", color: chartColors.sleep, kind: "bar", dp: 1, target: targets?.sleepH, need: count("sleep") >= 2 },
  ];
  const panels: StackPanel[] = all.filter((p) => p.need);
  const habitPanels = panels.filter((p) => p.key !== "w");
  const title = "Habits and weight";
  if (habitPanels.length === 0) {
    return <ChartEmpty title={title}>I need at least two {gran === "daily" ? "days" : "weeks"} of calories, protein, steps or sleep in this range. Log meals on most days so the averages mean something, and tell me about your steps and sleep.</ChartEmpty>;
  }

  const avgs = habitPanels.map((p) => `${p.label.split(" (")[0].toLowerCase()} averaged ${fmtNum(mean(rows.map((r) => (typeof r[p.key] === "number" ? (r[p.key] as number) : null))), p.dp ?? 0)} ${p.unit}`);
  const wRows = rows.filter((r) => typeof r.w === "number");
  const weightText = wRows.length >= 2 ? ` Your weight (7-day average) went from ${fmtNum(wRows[0].w as number, 1)} to ${fmtNum(wRows[wRows.length - 1].w as number, 1)} ${wu}.` : "";
  const c = correlations;
  const summary = `Over this range, ${avgs.join(", ")}.${weightText} Each panel has its own scale, so compare shapes over time, not heights. Patterns between weeks: calories ${describeCorr(c.caloriesVsWeightChange)}, protein ${describeCorr(c.proteinVsWeightChange)}, steps ${describeCorr(c.stepsVsWeightChange)}, sleep ${describeCorr(c.sleepVsWeightChange)}. This shows association, not cause.`;

  return (
    <StackedCharts
      title={`${title} (${gran})`}
      rows={rows}
      panels={panels}
      summary={summary}
      readoutDate={(d) => (gran === "daily" ? fmtDay(d) : `Week of ${fmtDay(d, { day: "numeric", month: "short" })}`)}
      table={{
        columns: [gran === "daily" ? "Date" : "Week starting", `Weight 7-day avg (${wu})`, "Calories (kcal)", "Protein (g)", "Steps", "Sleep (h)"],
        rows: rows.map((r) => [fmtDay(r.date), r.w, r.cal, r.pro, r.steps, r.sleep]),
      }}
    />
  );
}
