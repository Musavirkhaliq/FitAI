"use client";
import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartFrame, chartColors, tooltipStyle } from "@/components/ui";
import { fmtDay, fmtNum, type UnitSystem } from "@/lib/client/format";
import type { WeightPointDto } from "./types";
import { padDomain, round1, shortDay, wUnit, wv } from "./util";

export function ChartEmpty({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted">{children}</p>
    </section>
  );
}

/** Raw weigh-ins as faint dots with the 7- and 14-day moving averages as lines: the trend matters, single days don't. */
export function WeightTrendChart({ series, units }: { series: WeightPointDto[]; units: UnitSystem }) {
  const title = "Weight trend";
  const u = wUnit(units);
  if (series.length < 2) return <ChartEmpty title={title}>Log at least two weigh-ins in this range to see your trend. Say “I weighed 84.5 this morning”.</ChartEmpty>;
  const rows = series.map((p) => ({ date: p.date, weight: round1(wv(p.weight, units)), ma7: p.ma7 == null ? null : round1(wv(p.ma7, units)), ma14: p.ma14 == null ? null : round1(wv(p.ma14, units)) }));
  const first = rows[0];
  const last = rows[rows.length - 1];
  const a = last.ma7 ?? last.weight;
  const b = first.ma7 ?? first.weight;
  const diff = round1(a - b);
  const summary = `${rows.length} weigh-ins from ${fmtDay(first.date)} to ${fmtDay(last.date)}. Your 7-day average moved from ${fmtNum(b, 1)} to ${fmtNum(a, 1)} ${u} (${diff > 0 ? "+" : diff < 0 ? "−" : ""}${fmtNum(Math.abs(diff), 1)} ${u}). Daily numbers bounce with water and food; the averages show the real direction.`;
  return (
    <ChartFrame
      title={`${title} (${u})`}
      height={260}
      summary={summary}
      table={{ columns: ["Date", `Weight (${u})`, "7-day avg", "14-day avg"], rows: rows.map((r) => [fmtDay(r.date), r.weight, r.ma7, r.ma14]) }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDay} tick={{ fontSize: 11, fill: chartColors.muted }} minTickGap={28} />
          <YAxis domain={padDomain} tick={{ fontSize: 11, fill: chartColors.muted }} width={44} />
          <Tooltip {...tooltipStyle} labelFormatter={(d) => fmtDay(String(d))} formatter={(v) => `${fmtNum(Number(v), 1)} ${u}`} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line name="Daily weight" type="linear" dataKey="weight" stroke={chartColors.muted} strokeWidth={0} dot={{ r: 2.5, fill: chartColors.muted }} activeDot={{ r: 4 }} isAnimationActive={false} />
          <Line name="7-day average" type="monotone" dataKey="ma7" stroke={chartColors.brand} strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />
          <Line name="14-day average" type="monotone" dataKey="ma14" stroke={chartColors.series[1]} strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function WaistChart({ waist, units }: { waist: { date: string; waistCm: number | null }[]; units: UnitSystem }) {
  const title = "Waist trend";
  const pts = waist.filter((w): w is { date: string; waistCm: number } => w.waistCm != null);
  const unit = units === "IMPERIAL" ? "in" : "cm";
  if (pts.length < 2) return <ChartEmpty title={title}>Log your waist at least twice (for example “my waist is 86 cm”) to see how it changes. Measure at the same time of day, relaxed.</ChartEmpty>;
  const rows = pts.map((p) => ({ date: p.date, waist: round1(units === "IMPERIAL" ? p.waistCm / 2.54 : p.waistCm) }));
  const first = rows[0];
  const last = rows[rows.length - 1];
  const diff = round1(last.waist - first.waist);
  return (
    <ChartFrame
      title={`${title} (${unit})`}
      height={220}
      summary={`${rows.length} measurements. Waist went from ${fmtNum(first.waist, 1)} to ${fmtNum(last.waist, 1)} ${unit} (${diff > 0 ? "+" : diff < 0 ? "−" : ""}${fmtNum(Math.abs(diff), 1)} ${unit}). Tape measurements vary by a centimetre or so, so look for the overall direction.`}
      table={{ columns: ["Date", `Waist (${unit})`], rows: rows.map((r) => [fmtDay(r.date), r.waist]) }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tickFormatter={shortDay} tick={{ fontSize: 11, fill: chartColors.muted }} minTickGap={28} />
          <YAxis domain={padDomain} tick={{ fontSize: 11, fill: chartColors.muted }} width={44} />
          <Tooltip {...tooltipStyle} labelFormatter={(d) => fmtDay(String(d))} formatter={(v) => `${fmtNum(Number(v), 1)} ${unit}`} />
          <Line name="Waist" type="monotone" dataKey="waist" stroke={chartColors.series[3]} strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
