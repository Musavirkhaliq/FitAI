"use client";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AnimatedNumber, ChartFrame, Tile, chartColors, tooltipStyle } from "@/components/ui";
import { fmtDay, fmtNum, type UnitSystem } from "@/lib/client/format";
import { SingleLine } from "./StackedCharts";
import type { WeightPointDto } from "./types";
import { compactNum, padDomain, round1, shortDay, signed, wUnit, wv } from "./util";

export function ChartEmpty({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card rise">
      <h3 className="display text-base font-bold">{title}</h3>
      <p className="mt-2 text-sm text-muted">{children}</p>
    </section>
  );
}

const AXIS = { fontSize: 11, fill: chartColors.muted };

/**
 * Weight leads with the 7-day average (the trend), never a single day. Raw weigh-ins sit behind it as faint dots.
 * One series of one measure: a single axis, no second scale.
 */
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
  const Icon = diff < -0.05 ? ArrowDownRight : diff > 0.05 ? ArrowUpRight : ArrowRight;
  const summary = `${rows.length} weigh-ins from ${fmtDay(first.date)} to ${fmtDay(last.date)}. Your 7-day average moved from ${fmtNum(b, 1)} to ${fmtNum(a, 1)} ${u} (${diff > 0 ? "+" : diff < 0 ? "−" : ""}${fmtNum(Math.abs(diff), 1)} ${u}). Daily numbers bounce with water and food; the average shows the real direction.`;

  return (
    <div className="space-y-3">
      <Tile className="!p-5" style={{ background: "linear-gradient(150deg, rgb(var(--brand-a) / 0.14), transparent 65%), rgb(var(--surface))" }}>
        <p className="eyebrow">Weight · 7-day average</p>
        <p className="num mt-2 text-[3rem]">
          <AnimatedNumber value={a} format={(n) => fmtNum(n, 1)} fromZero />
          <span className="ml-1.5 text-lg font-medium text-muted">{u}</span>
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
          <Icon className="h-4 w-4" aria-hidden /> {signed(diff)} {u} across this range. Daily numbers bounce; this is the direction.
        </p>
      </Tile>

      <ChartFrame
        title={`${title} (${u})`}
        height={252}
        summary={summary}
        table={{ columns: ["Date", `Weight (${u})`, "7-day avg", "14-day avg"], rows: rows.map((r) => [fmtDay(r.date), r.weight, r.ma7, r.ma14]) }}
      >
        <div className="flex h-full flex-col">
          <p className="flex items-center gap-4 text-xs text-muted" style={{ height: 28 }}>
            <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2 w-2 rounded-full" style={{ background: chartColors.muted, opacity: 0.55 }} /> Daily weigh-in</span>
            <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-0.5 w-4 rounded-full" style={{ background: chartColors.brand }} /> 7-day average</span>
          </p>
          <ResponsiveContainer width="100%" height={224}>
            <ComposedChart data={rows} margin={{ top: 16, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={chartColors.grid} strokeWidth={1} vertical={false} />
              <XAxis dataKey="date" tickFormatter={shortDay} tick={AXIS} tickLine={false} axisLine={{ stroke: chartColors.grid }} minTickGap={32} />
              <YAxis width={44} domain={padDomain} tick={AXIS} tickLine={false} axisLine={false} tickCount={4} tickFormatter={compactNum} />
              <Tooltip {...tooltipStyle} cursor={{ stroke: chartColors.muted, strokeWidth: 1 }} labelFormatter={(d) => fmtDay(String(d))} formatter={(v) => `${fmtNum(Number(v), 1)} ${u}`} isAnimationActive={false} />
              <Line name="Daily weigh-in" type="linear" dataKey="weight" stroke="none" dot={{ r: 2.5, fill: chartColors.muted, fillOpacity: 0.55, stroke: "none" }} activeDot={{ r: 4, fill: chartColors.muted }} isAnimationActive={false} />
              <Area name="7-day average wash" type="monotone" dataKey="ma7" stroke="none" fill={chartColors.brand} fillOpacity={0.1} connectNulls isAnimationActive={false} tooltipType="none" />
              <Line name="7-day average" type="monotone" dataKey="ma7" stroke={chartColors.brand} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dot={false} activeDot={{ r: 4, fill: chartColors.brand, stroke: chartColors.surface, strokeWidth: 2 }} connectNulls isAnimationActive={false} />
              {last.ma7 != null && (
                <ReferenceDot x={last.date} y={last.ma7} r={4} fill={chartColors.brand} stroke={chartColors.surface} strokeWidth={2} ifOverflow="extendDomain" label={{ value: fmtNum(last.ma7, 1), position: "top", fontSize: 11, fill: chartColors.muted }} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </ChartFrame>
    </div>
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
      height={224}
      summary={`${rows.length} measurements. Waist went from ${fmtNum(first.waist, 1)} to ${fmtNum(last.waist, 1)} ${unit} (${diff > 0 ? "+" : diff < 0 ? "−" : ""}${fmtNum(Math.abs(diff), 1)} ${unit}). Tape measurements vary by a centimetre or so, so look for the overall direction.`}
      table={{ columns: ["Date", `Waist (${unit})`], rows: rows.map((r) => [fmtDay(r.date), r.waist]) }}
    >
      <SingleLine rows={rows} dataKey="waist" color={chartColors.brand} unit={unit} dots height={216} />
    </ChartFrame>
  );
}
