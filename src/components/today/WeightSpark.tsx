"use client";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartFrame, chartColors, tooltipStyle } from "@/components/ui";
import { fmtDay, fmtNum, kgToLb, type UnitSystem } from "@/lib/client/format";
import type { DailyPointDto } from "@/lib/client/types";

/** Tiny 7-day weight chart with a text alternative. Raw points only; averages are shown as numbers beside it. */
export function WeightSpark({ days, units }: { days: DailyPointDto[]; units: UnitSystem }) {
  const pts = days.filter((d) => d.weightKg != null).map((d) => ({ date: d.date, w: units === "IMPERIAL" ? kgToLb(d.weightKg!) : d.weightKg! }));
  if (pts.length < 2) return null;
  const unit = units === "IMPERIAL" ? "lb" : "kg";
  const lo = Math.min(...pts.map((p) => p.w));
  const hi = Math.max(...pts.map((p) => p.w));
  return (
    <ChartFrame
      title="Weight, last 7 days"
      height={110}
      summary={`${pts.length} weigh-ins this week, from ${fmtNum(pts[0].w, 1)} ${unit} to ${fmtNum(pts[pts.length - 1].w, 1)} ${unit}. Daily changes are mostly water; watch the trend, not single days.`}
      table={{ columns: ["Date", `Weight (${unit})`], rows: pts.map((p) => [fmtDay(p.date), fmtNum(p.w, 1)]) }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={pts} margin={{ top: 6, right: 8, bottom: 0, left: 8 }}>
          <XAxis dataKey="date" hide />
          <YAxis domain={[lo - 0.4, hi + 0.4]} hide />
          <Tooltip {...tooltipStyle} labelFormatter={(d) => fmtDay(String(d))} formatter={(v: number) => [`${fmtNum(v, 1)} ${unit}`, "Weight"]} />
          <Line type="monotone" dataKey="w" stroke={chartColors.brand} strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
