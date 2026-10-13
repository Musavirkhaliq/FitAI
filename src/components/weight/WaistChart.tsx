"use client";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartFrame, chartColors } from "@/components/ui";
import { fmtDay, fmtNum } from "@/lib/client/format";
import type { MeasurementDto } from "./types";

/** Waist over time from tape measurements (cm). Needs two readings to draw a line. */
export function WaistChart({ measurements }: { measurements: MeasurementDto[] }) {
  const pts = measurements.filter((m) => m.waistCm != null).map((m) => ({ date: m.date, waist: m.waistCm as number }));
  if (pts.length < 2) {
    return (
      <p className="rounded-2xl bg-surface-2 px-3.5 py-3 text-sm text-muted">
        {pts.length === 1 ? "One waist reading so far. Add another in a week or two to see a trend." : "No waist measurements yet."}
      </p>
    );
  }
  const first = pts[0];
  const last = pts[pts.length - 1];
  const change = last.waist - first.waist;
  return (
    <ChartFrame
      title="Waist trend (cm)"
      height={170}
      summary={`${pts.length} waist measurements, from ${fmtNum(first.waist, 1)} cm to ${fmtNum(last.waist, 1)} cm (${change > 0 ? "+" : change < 0 ? "−" : ""}${fmtNum(Math.abs(change), 1)} cm). Tape measurements vary a little with posture and time of day.`}
      table={{ columns: ["Date", "Waist (cm)"], rows: [...pts].reverse().map((p) => [fmtDay(p.date), fmtNum(p.waist, 1)]) }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={pts} margin={{ top: 4, right: 28, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={chartColors.grid} vertical={false} />
          <XAxis dataKey="date" tickFormatter={(d: string) => fmtDay(d, { day: "numeric", month: "short" })} tick={{ fontSize: 11, fill: chartColors.muted }} minTickGap={44} tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis domain={[(min: number) => Math.floor(min - 1), (max: number) => Math.ceil(max + 1)]} width={36} tickCount={3} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtNum(v, 0)} tick={{ fontSize: 11, fill: chartColors.muted }} />
          <Tooltip
            cursor={{ stroke: chartColors.muted, strokeWidth: 1, strokeOpacity: 0.5 }}
            wrapperStyle={{ outline: "none" }}
            content={({ active, payload }) => {
              const p = active ? (payload?.[0]?.payload as { date: string; waist: number } | undefined) : undefined;
              if (!p) return null;
              return (
                <div className="glass rounded-2xl border border-border px-3 py-2 text-xs shadow-float">
                  <p className="font-semibold text-muted">{fmtDay(p.date)}</p>
                  <p className="num mt-1 !text-base">{fmtNum(p.waist, 1)} <span className="text-xs font-medium text-muted">cm</span></p>
                </div>
              );
            }}
          />
          <Area type="monotone" dataKey="waist" stroke="none" fill={chartColors.brand} fillOpacity={0.1} isAnimationActive={false} activeDot={false} />
          <Line type="monotone" dataKey="waist" stroke={chartColors.brand} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dot={false} activeDot={{ r: 5, fill: chartColors.brand, stroke: chartColors.surface, strokeWidth: 2 }} isAnimationActive={false} />
          <ReferenceDot
            x={last.date} y={last.waist} r={5} fill={chartColors.brand} stroke={chartColors.surface} strokeWidth={2} ifOverflow="extendDomain"
            label={{ value: fmtNum(last.waist, 1), position: "top", fill: "rgb(var(--fg))", fontSize: 12, fontWeight: 700 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
