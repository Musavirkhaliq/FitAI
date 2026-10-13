"use client";
import { useId, useMemo, useState } from "react";
import { CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartFrame, chartColors, tooltipStyle } from "@/components/ui";
import { fmtDay, fmtNum, type UnitSystem } from "@/lib/client/format";
import { toDisplay, unitLabel } from "./trend";
import type { SeriesPointDto } from "./types";

/** Daily weigh-ins (thin line + dots) with 7- and 14-day averages; the averages are the signal. */
export function WeightChart({ series, units, targetKg, days }: { series: SeriesPointDto[]; units: UnitSystem; targetKg: number | null; days: number }) {
  const [showTarget, setShowTarget] = useState(false);
  const toggleId = useId();
  const unit = unitLabel(units);
  const pts = useMemo(
    () =>
      series.map((s) => ({
        date: s.date,
        raw: toDisplay(s.weight, units),
        ma7: s.ma7 == null ? null : toDisplay(s.ma7, units),
        ma14: s.ma14 == null ? null : toDisplay(s.ma14, units),
      })),
    [series, units],
  );
  const last = pts[pts.length - 1];
  const target = targetKg != null ? toDisplay(targetKg, units) : null;

  return (
    <div className="space-y-2">
      <ChartFrame
        title={`Weight, last ${days} days`}
        height={280}
        summary={`${pts.length} weigh-ins in the last ${days} days. Latest 7-day average ${fmtNum(last?.ma7, 1)} ${unit}, 14-day average ${fmtNum(last?.ma14, 1)} ${unit}. Daily dots move with water, salt and digestion; the two average lines show the real direction.`}
        table={{
          columns: ["Date", `Weight (${unit})`, "7-day avg", "14-day avg"],
          rows: [...pts].reverse().map((p) => [fmtDay(p.date), fmtNum(p.raw, 1), fmtNum(p.ma7, 1), fmtNum(p.ma14, 1)]),
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={pts} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tickFormatter={(d: string) => fmtDay(d, { day: "numeric", month: "short" })} tick={{ fontSize: 11, fill: chartColors.muted }} minTickGap={32} stroke={chartColors.grid} />
            <YAxis domain={[(min: number) => Math.floor(min - 0.5), (max: number) => Math.ceil(max + 0.5)]} width={40} tick={{ fontSize: 11, fill: chartColors.muted }} stroke={chartColors.grid} />
            <Tooltip {...tooltipStyle} labelFormatter={(d) => fmtDay(String(d))} formatter={(v: number, name: string) => [`${fmtNum(v, 1)} ${unit}`, name]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {showTarget && target != null && (
              <ReferenceLine y={target} stroke={chartColors.good} strokeDasharray="2 4" ifOverflow="extendDomain" label={{ value: "Target", fill: chartColors.good, fontSize: 11, position: "insideTopRight" }} />
            )}
            <Line name="Daily weigh-in" type="linear" dataKey="raw" stroke={chartColors.muted} strokeWidth={1} dot={{ r: 2.5, fill: chartColors.muted, strokeWidth: 0 }} activeDot={{ r: 4 }} isAnimationActive={false} />
            <Line name="7-day average" type="monotone" dataKey="ma7" stroke={chartColors.brand} strokeWidth={2.5} dot={false} isAnimationActive={false} connectNulls />
            <Line name="14-day average" type="monotone" dataKey="ma14" stroke={chartColors.series[1]} strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartFrame>
      {target != null && (
        <label htmlFor={toggleId} className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm">
          <input id={toggleId} type="checkbox" className="h-5 w-5 accent-[rgb(var(--brand))]" checked={showTarget} onChange={(e) => setShowTarget(e.target.checked)} />
          Show target weight ({fmtNum(target, 1)} {unit})
        </label>
      )}
    </div>
  );
}
