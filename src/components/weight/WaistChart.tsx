"use client";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartFrame, chartColors, tooltipStyle } from "@/components/ui";
import { fmtDay, fmtNum } from "@/lib/client/format";
import type { MeasurementDto } from "./types";

/** Waist over time from tape measurements (cm). Needs two readings to draw a line. */
export function WaistChart({ measurements }: { measurements: MeasurementDto[] }) {
  const pts = measurements.filter((m) => m.waistCm != null).map((m) => ({ date: m.date, waist: m.waistCm as number }));
  if (pts.length < 2) {
    return <p className="text-sm text-muted">{pts.length === 1 ? "One waist reading so far. Add another in a week or two to see a trend." : "No waist measurements yet."}</p>;
  }
  const change = pts[pts.length - 1].waist - pts[0].waist;
  return (
    <ChartFrame
      title="Waist trend (cm)"
      height={170}
      summary={`${pts.length} waist measurements, from ${fmtNum(pts[0].waist, 1)} cm to ${fmtNum(pts[pts.length - 1].waist, 1)} cm (${change > 0 ? "+" : change < 0 ? "−" : ""}${fmtNum(Math.abs(change), 1)} cm). Tape measurements vary a little with posture and time of day.`}
      table={{ columns: ["Date", "Waist (cm)"], rows: [...pts].reverse().map((p) => [fmtDay(p.date), fmtNum(p.waist, 1)]) }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={pts} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tickFormatter={(d: string) => fmtDay(d, { day: "numeric", month: "short" })} tick={{ fontSize: 11, fill: chartColors.muted }} minTickGap={32} stroke={chartColors.grid} />
          <YAxis domain={[(min: number) => Math.floor(min - 1), (max: number) => Math.ceil(max + 1)]} width={36} tick={{ fontSize: 11, fill: chartColors.muted }} stroke={chartColors.grid} />
          <Tooltip {...tooltipStyle} labelFormatter={(d) => fmtDay(String(d))} formatter={(v: number) => [`${fmtNum(v, 1)} cm`, "Waist"]} />
          <Line type="monotone" dataKey="waist" stroke={chartColors.brand} strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
