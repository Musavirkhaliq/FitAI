"use client";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartFrame, chartColors, tooltipStyle } from "@/components/ui";
import { fmtDay, fmtNum, type UnitSystem } from "@/lib/client/format";
import type { DailyPointDto } from "@/lib/client/types";
import type { Granularity, WeeklyDto, WeightPointDto } from "./types";
import { corrLabel, mean, padDomain, round1, shortDay, wUnit, wv } from "./util";
import { ChartEmpty } from "./WeightCharts";

export type DriverKey = "calories" | "protein" | "steps" | "sleep";

interface Metric {
  title: string;
  label: string;
  unit: string;
  dp: number;
  daily: (d: DailyPointDto) => number | null;
  weekly: (w: WeeklyDto) => number | null;
  hint: string;
}

export const METRICS: Record<DriverKey, Metric> = {
  calories: { title: "Calories vs weight", label: "Calories", unit: "kcal", dp: 0, daily: (d) => d.calories, weekly: (w) => w.avgCalories, hint: "Log meals on most days so the averages mean something." },
  protein: { title: "Protein vs weight", label: "Protein", unit: "g", dp: 0, daily: (d) => d.protein, weekly: (w) => w.avgProtein, hint: "Log meals on most days so the averages mean something." },
  steps: { title: "Steps vs weight", label: "Steps", unit: "steps", dp: 0, daily: (d) => d.steps, weekly: (w) => w.avgSteps, hint: "Log your steps (or connect a tracker) on most days." },
  sleep: { title: "Sleep vs weight", label: "Sleep", unit: "h", dp: 1, daily: (d) => d.sleepH, weekly: (w) => w.avgSleep, hint: "Log your sleep most mornings, e.g. “I slept 7 hours”." },
};

interface Props {
  metricKey: DriverKey;
  gran: Granularity;
  days: DailyPointDto[];
  weekly: WeeklyDto[];
  weightSeries: WeightPointDto[];
  units: UnitSystem;
  correlation: number | null;
}

/** Bars for a daily/weekly habit metric with the weight moving average on a second axis, to eyeball how they move together. */
export function DriverChart({ metricKey, gran, days, weekly, weightSeries, units, correlation }: Props) {
  const m = METRICS[metricKey];
  const wu = wUnit(units);
  const ma = new Map(weightSeries.map((p) => [p.date, p.ma7]));
  const rows =
    gran === "daily"
      ? days.map((d) => ({ date: d.date, v: m.daily(d), w: ma.get(d.date) != null ? round1(wv(ma.get(d.date)!, units)) : null }))
      : weekly.map((w) => ({ date: w.week, v: m.weekly(w), w: w.weightAvg != null ? round1(wv(w.weightAvg, units)) : null }));

  const withV = rows.filter((r) => r.v != null);
  const withW = rows.filter((r) => r.w != null);
  if (withV.length < 2 || withW.length < 2) return <ChartEmpty title={m.title}>I need at least two {gran === "daily" ? "days" : "weeks"} of both {m.label.toLowerCase()} and weigh-ins in this range. {m.hint}</ChartEmpty>;

  const avg = mean(withV.map((r) => r.v));
  const wFirst = withW[0].w!;
  const wLast = withW[withW.length - 1].w!;
  const per = gran === "daily" ? "per day" : "per week (average of each day)";
  const summary = `${m.label} averaged ${fmtNum(avg, m.dp)} ${m.unit} ${per} over ${withV.length} ${gran === "daily" ? "days" : "weeks"} with data. Weight (7-day average) went from ${fmtNum(wFirst, 1)} to ${fmtNum(wLast, 1)} ${wu}. Link between weekly ${m.label.toLowerCase()} and weekly weight change: ${corrLabel(correlation)}. This shows association, not cause.`;
  const fmtLabel = (d: string) => (gran === "daily" ? fmtDay(d) : `Week of ${fmtDay(d, { day: "numeric", month: "short" })}`);

  return (
    <ChartFrame
      title={`${m.title} (${gran})`}
      height={260}
      summary={summary}
      table={{ columns: [gran === "daily" ? "Date" : "Week starting", `${m.label} (${m.unit})`, `Weight 7-day avg (${wu})`], rows: rows.map((r) => [fmtDay(r.date), r.v == null ? null : fmtNum(r.v, m.dp), r.w]) }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: -4, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDay} tick={{ fontSize: 11, fill: chartColors.muted }} minTickGap={28} />
          <YAxis yAxisId="l" tick={{ fontSize: 11, fill: chartColors.muted }} width={48} />
          <YAxis yAxisId="r" orientation="right" domain={padDomain} tick={{ fontSize: 11, fill: chartColors.muted }} width={44} />
          <Tooltip {...tooltipStyle} labelFormatter={(d) => fmtLabel(String(d))} formatter={(v, name) => (name === "Weight (7-day avg)" ? `${fmtNum(Number(v), 1)} ${wu}` : `${fmtNum(Number(v), m.dp)} ${m.unit}`)} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="l" name={m.label} dataKey="v" fill={chartColors.brand} fillOpacity={0.55} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Line yAxisId="r" name="Weight (7-day avg)" type="monotone" dataKey="w" stroke={chartColors.series[2]} strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
