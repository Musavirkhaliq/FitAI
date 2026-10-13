"use client";
import { ChartFrame, chartColors } from "@/components/ui";
import { fmtDay, fmtNum, type UnitSystem } from "@/lib/client/format";
import { SingleBars, SingleLine, StackedCharts, type StackRow } from "./StackedCharts";
import type { StrengthSeriesDto, WeeklyDto } from "./types";
import { corrLabel, mean, round1, wUnit, wv, weekEnd } from "./util";
import { ChartEmpty } from "./WeightCharts";

/**
 * How often you trained and how strong the selected lift got, week by week. Two measures, so two stacked panels that share
 * the x-axis (no second y-axis): estimated 1RM on top, training days below.
 */
export function FrequencyStrengthChart({ weekly, series, from, to, units, correlation }: { weekly: WeeklyDto[]; series: StrengthSeriesDto | undefined; from: string; to: string; units: UnitSystem; correlation: number | null }) {
  const title = "Training frequency and strength";
  const u = wUnit(units);
  const pts = (series?.points ?? []).filter((p) => p.date >= from && p.date <= to);
  const rows: StackRow[] = weekly.map((w) => {
    const inWeek = pts.filter((p) => p.date >= w.week && p.date <= weekEnd(w.week)).map((p) => p.est1rm);
    return { date: w.week, e1rm: inWeek.length ? round1(wv(Math.max(...inWeek), units)) : null, sessions: w.sessions };
  });
  if (!series || pts.length < 2 || rows.length < 2) return <ChartEmpty title={title}>Log at least two sessions of the same lift to compare how often you train with how strong you get.</ChartEmpty>;
  const avgSessions = mean(rows.map((r) => r.sessions as number)) ?? 0;
  return (
    <StackedCharts
      title={`${title}: ${series.exercise}`}
      rows={rows}
      panels={[
        { key: "e1rm", label: `Best estimated 1RM that week (${u})`, unit: u, color: chartColors.brand, kind: "line", dp: 1 },
        { key: "sessions", label: "Training days that week", unit: "days", color: chartColors.brand, kind: "bar", height: 80 },
      ]}
      summary={`You trained on average ${fmtNum(avgSessions, 1)} days per week. The top panel shows your best estimated 1RM for ${series.exercise} each week, in ${u}; the bottom panel shows how many days you trained. Link between weekly training days and total volume: ${corrLabel(correlation)}. Strength also depends on sleep, food and plain luck, so treat this as a hint, not a cause.`}
      readoutDate={(d) => `Week of ${fmtDay(d, { day: "numeric", month: "short" })}`}
      table={{ columns: ["Week starting", "Sessions", `Best est. 1RM (${u})`], rows: rows.map((r) => [fmtDay(r.date), r.sessions, r.e1rm]) }}
    />
  );
}

export function VolumeChart({ weekly, units }: { weekly: WeeklyDto[]; units: UnitSystem }) {
  const title = "Workout volume per week";
  const u = wUnit(units);
  const rows = weekly.map((w) => ({ date: w.week, volume: Math.round(wv(w.volume, units)), sessions: w.sessions }));
  const active = rows.filter((r) => r.volume > 0);
  if (active.length < 1) return <ChartEmpty title={title}>Log some sets in a workout and your weekly volume (weight × reps) will appear here.</ChartEmpty>;
  const best = active.reduce((a, b) => (b.volume > a.volume ? b : a));
  return (
    <ChartFrame
      title={`${title} (${u})`}
      height={216}
      summary={`Volume is weight × reps added up over all sets. You trained in ${active.length} of ${rows.length} weeks here, averaging ${fmtNum(mean(active.map((r) => r.volume)), 0)} ${u} in those weeks. Your biggest week started ${fmtDay(best.date)} at ${fmtNum(best.volume)} ${u}.`}
      table={{ columns: ["Week starting", `Volume (${u})`, "Training days"], rows: rows.map((r) => [fmtDay(r.date), fmtNum(r.volume), r.sessions]) }}
    >
      <SingleBars rows={rows} dataKey="volume" color={chartColors.brand} unit={u} height={208} />
    </ChartFrame>
  );
}

export function StrengthChart({ series, from, to, units }: { series: StrengthSeriesDto | undefined; from: string; to: string; units: UnitSystem }) {
  const title = "Strength progression";
  const u = wUnit(units);
  const pts = (series?.points ?? []).filter((p) => p.date >= from && p.date <= to);
  if (!series || pts.length < 2) return <ChartEmpty title={title}>Log the same exercise on two different days to see your estimated 1RM change.</ChartEmpty>;
  const rows = pts.map((p) => ({ date: p.date, e1rm: round1(wv(p.est1rm, units)) }));
  const first = rows[0];
  const last = rows[rows.length - 1];
  const diff = round1(last.e1rm - first.e1rm);
  return (
    <ChartFrame
      title={`${title}: ${series.exercise} (${u})`}
      height={216}
      summary={`Estimated one-rep max for ${series.exercise} over ${rows.length} sessions: from ${fmtNum(first.e1rm, 1)} to ${fmtNum(last.e1rm, 1)} ${u} (${diff > 0 ? "+" : diff < 0 ? "−" : ""}${fmtNum(Math.abs(diff), 1)} ${u}). These are formula estimates from your sets, not tested maxes.`}
      table={{ columns: ["Date", `Est. 1RM (${u})`], rows: rows.map((r) => [fmtDay(r.date), r.e1rm]) }}
    >
      <SingleLine rows={rows} dataKey="e1rm" color={chartColors.brand} unit={u} dots height={208} />
    </ChartFrame>
  );
}
