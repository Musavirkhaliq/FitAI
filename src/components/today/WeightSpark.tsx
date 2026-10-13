"use client";
import { Area, AreaChart, CartesianGrid, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartFrame, chartColors, tooltipStyle } from "@/components/ui";
import { fmtDay, fmtNum, kgToLb, type UnitSystem } from "@/lib/client/format";
import type { DailyPointDto } from "@/lib/client/types";

/**
 * Small 7-day weight chart (single series: brand colour, no legend, no second axis). 2 px line, ~10% area wash, hairline
 * grid, one labelled end-dot with a surface ring. The text summary leads with the average, not a single day.
 */
export function WeightSpark({ days, units }: { days: DailyPointDto[]; units: UnitSystem }) {
  const pts = days.filter((d) => d.weightKg != null).map((d) => ({ date: d.date, w: units === "IMPERIAL" ? kgToLb(d.weightKg!) : d.weightKg! }));
  if (pts.length < 2) return null;
  const unit = units === "IMPERIAL" ? "lb" : "kg";
  const lo = Math.min(...pts.map((p) => p.w));
  const hi = Math.max(...pts.map((p) => p.w));
  const pad = Math.max(0.4, (hi - lo) * 0.3);
  const avg = pts.reduce((s, p) => s + p.w, 0) / pts.length;
  const first = pts[0];
  const last = pts[pts.length - 1];
  const short = (d: string) => fmtDay(d, { day: "numeric", month: "short" });
  return (
    <ChartFrame
      title="Weight, last 7 days"
      height={150}
      summary={`${pts.length} weigh-ins this week, averaging ${fmtNum(avg, 1)} ${unit} (from ${fmtNum(first.w, 1)} to ${fmtNum(last.w, 1)} ${unit}). Daily changes are mostly water; watch the trend, not single days.`}
      table={{ columns: ["Date", `Weight (${unit})`], rows: pts.map((p) => [fmtDay(p.date), fmtNum(p.w, 1)]) }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={pts} margin={{ top: 22, right: 26, bottom: 0, left: 26 }}>
          <CartesianGrid vertical={false} stroke={chartColors.grid} strokeWidth={1} strokeDasharray="" />
          <XAxis dataKey="date" ticks={[first.date, last.date]} interval={0} tickFormatter={short} axisLine={false} tickLine={false} tickMargin={8} tick={{ fontSize: 11, fill: chartColors.muted }} />
          <YAxis domain={[lo - pad, hi + pad]} tickCount={3} hide />
          <Tooltip {...tooltipStyle} cursor={{ stroke: chartColors.grid }} labelFormatter={(d) => fmtDay(String(d))} formatter={(v: number) => [`${fmtNum(v, 1)} ${unit}`, "Weight"]} />
          <Area
            type="monotone"
            dataKey="w"
            stroke={chartColors.brand}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={chartColors.brand}
            fillOpacity={0.1}
            dot={false}
            activeDot={{ r: 5, fill: chartColors.brand, stroke: chartColors.surface, strokeWidth: 2 }}
            isAnimationActive={false}
          />
          <ReferenceDot
            x={last.date}
            y={last.w}
            r={5}
            fill={chartColors.brand}
            stroke={chartColors.surface}
            strokeWidth={2}
            ifOverflow="visible"
            label={{ value: `${fmtNum(last.w, 1)} ${unit}`, position: "top", fill: "rgb(var(--fg))", fontSize: 12, fontWeight: 600 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
