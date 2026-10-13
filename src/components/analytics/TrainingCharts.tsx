"use client";
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartFrame, chartColors, tooltipStyle } from "@/components/ui";
import { fmtDay, fmtNum, type UnitSystem } from "@/lib/client/format";
import { corrLabel, mean, padDomain, round1, shortDay, wUnit, wv, weekEnd } from "./util";
import type { StrengthSeriesDto, WeeklyDto } from "./types";
import { ChartEmpty } from "./WeightCharts";

const AXIS = { fontSize: 11, fill: chartColors.muted };

/** Weekly sessions (bars) against the selected lift's best estimated 1RM that week (line). */
export function FrequencyStrengthChart({ weekly, series, from, to, units, correlation }: { weekly: WeeklyDto[]; series: StrengthSeriesDto | undefined; from: string; to: string; units: UnitSystem; correlation: number | null }) {
  const title = "Training frequency vs strength";
  const u = wUnit(units);
  const pts = (series?.points ?? []).filter((p) => p.date >= from && p.date <= to);
  const rows = weekly.map((w) => {
    const inWeek = pts.filter((p) => p.date >= w.week && p.date <= weekEnd(w.week)).map((p) => p.est1rm);
    return { date: w.week, sessions: w.sessions, e1rm: inWeek.length ? round1(wv(Math.max(...inWeek), units)) : null };
  });
  if (!series || pts.length < 2 || rows.length < 2) return <ChartEmpty title={title}>Log at least two sessions of the same lift to compare how often you train with how strong you get.</ChartEmpty>;
  const avgSessions = mean(rows.map((r) => r.sessions)) ?? 0;
  return (
    <ChartFrame
      title={`${title}: ${series.exercise}`}
      height={260}
      summary={`You trained on average ${fmtNum(avgSessions, 1)} days per week. The line shows your best estimated 1RM for ${series.exercise} each week, in ${u}. Link between weekly sessions and total volume: ${corrLabel(correlation)}. Strength also depends on sleep, food and plain luck, so treat this as a hint.`}
      table={{ columns: ["Week starting", "Sessions", `Best est. 1RM (${u})`], rows: rows.map((r) => [fmtDay(r.date), r.sessions, r.e1rm]) }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: -4, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDay} tick={AXIS} minTickGap={28} />
          <YAxis yAxisId="l" allowDecimals={false} tick={AXIS} width={40} />
          <YAxis yAxisId="r" orientation="right" domain={padDomain} tick={AXIS} width={44} />
          <Tooltip {...tooltipStyle} labelFormatter={(d) => `Week of ${fmtDay(String(d), { day: "numeric", month: "short" })}`} formatter={(v, name) => (name === "Sessions" ? String(v) : `${fmtNum(Number(v), 1)} ${u}`)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="l" name="Sessions" dataKey="sessions" fill={chartColors.brand} fillOpacity={0.55} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Line yAxisId="r" name="Best est. 1RM" type="monotone" dataKey="e1rm" stroke={chartColors.series[1]} strokeWidth={2.5} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
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
      height={240}
      summary={`Volume is weight × reps added up over all sets. You trained in ${active.length} of ${rows.length} weeks here, averaging ${fmtNum(mean(active.map((r) => r.volume)), 0)} ${u} in those weeks. Your biggest week started ${fmtDay(best.date)} at ${fmtNum(best.volume)} ${u}.`}
      table={{ columns: ["Week starting", `Volume (${u})`, "Training days"], rows: rows.map((r) => [fmtDay(r.date), fmtNum(r.volume), r.sessions]) }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -4 }}>
          <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDay} tick={AXIS} minTickGap={28} />
          <YAxis tick={AXIS} width={52} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v))} />
          <Tooltip {...tooltipStyle} labelFormatter={(d) => `Week of ${fmtDay(String(d), { day: "numeric", month: "short" })}`} formatter={(v) => `${fmtNum(Number(v))} ${u}`} />
          <Bar name="Volume" dataKey="volume" fill={chartColors.brand} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
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
      height={240}
      summary={`Estimated one-rep max for ${series.exercise} over ${rows.length} sessions: from ${fmtNum(first.e1rm, 1)} to ${fmtNum(last.e1rm, 1)} ${u} (${diff > 0 ? "+" : diff < 0 ? "−" : ""}${fmtNum(Math.abs(diff), 1)} ${u}). These are formula estimates from your sets, not tested maxes.`}
      table={{ columns: ["Date", `Est. 1RM (${u})`], rows: rows.map((r) => [fmtDay(r.date), r.e1rm]) }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDay} tick={AXIS} minTickGap={28} />
          <YAxis domain={padDomain} tick={AXIS} width={48} />
          <Tooltip {...tooltipStyle} labelFormatter={(d) => fmtDay(String(d))} formatter={(v) => `${fmtNum(Number(v), 1)} ${u}`} />
          <Line name="Estimated 1RM" type="monotone" dataKey="e1rm" stroke={chartColors.series[1]} strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
