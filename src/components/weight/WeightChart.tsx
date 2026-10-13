"use client";
import { useMemo, useState, type ReactNode } from "react";
import { Area, CartesianGrid, ComposedChart, Legend, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Chip, ChartFrame, chartColors } from "@/components/ui";
import { fmtDay, fmtNum, type UnitSystem } from "@/lib/client/format";
import { toDisplay, unitLabel } from "./trend";
import type { SeriesPointDto } from "./types";

interface Pt { date: string; raw: number; ma7: number | null; ma14: number | null }

const TEXT = "rgb(var(--fg))";

function LegendRow() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-1 text-xs text-muted">
      <li className="flex items-center gap-1.5"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-muted/70" />Daily weigh-in</li>
      <li className="flex items-center gap-1.5"><span aria-hidden className="h-[3px] w-4 rounded-full bg-brand" />7-day average</li>
      <li className="flex items-center gap-1.5"><span aria-hidden className="h-[3px] w-4 rounded-full bg-muted/60" />14-day average</li>
    </ul>
  );
}

/** Daily weigh-ins (thin dots) with 7- and 14-day averages; the averages are the signal. Tap or hover for the day's numbers. */
export function WeightChart({ series, units, targetKg, days, controls }: { series: SeriesPointDto[]; units: UnitSystem; targetKg: number | null; days: number; controls?: ReactNode }) {
  const [showTarget, setShowTarget] = useState(false);
  const unit = unitLabel(units);
  const pts: Pt[] = useMemo(
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
  const lastAvg = [...pts].reverse().find((p) => p.ma7 != null);
  const target = targetKg != null ? toDisplay(targetKg, units) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {controls}
        {target != null && (
          <Chip active={showTarget} onClick={() => setShowTarget((s) => !s)} aria-label={`Show target weight, ${fmtNum(target, 1)} ${unit}`}>
            Target {fmtNum(target, 1)} {unit}
          </Chip>
        )}
      </div>
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
          <ComposedChart data={pts} margin={{ top: 4, right: 28, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={chartColors.grid} vertical={false} />
            <XAxis dataKey="date" tickFormatter={(d: string) => fmtDay(d, { day: "numeric", month: "short" })} tick={{ fontSize: 11, fill: chartColors.muted }} minTickGap={44} tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis
              domain={[(min: number) => Math.floor(min - 0.5), (max: number) => Math.ceil(max + 0.5)]}
              width={36} tickCount={4} tickLine={false} axisLine={false}
              tickFormatter={(v: number) => fmtNum(v, 0)} tick={{ fontSize: 11, fill: chartColors.muted }}
            />
            <Tooltip
              cursor={{ stroke: chartColors.muted, strokeWidth: 1, strokeOpacity: 0.5 }}
              wrapperStyle={{ outline: "none" }}
              content={({ active, payload }) => {
                const p = active ? (payload?.[0]?.payload as Pt | undefined) : undefined;
                if (!p) return null;
                return (
                  <div className="glass rounded-2xl border border-border px-3 py-2 text-xs shadow-float">
                    <p className="font-semibold text-muted">{fmtDay(p.date)}</p>
                    <p className="num mt-1 !text-base">{fmtNum(p.raw, 1)} <span className="text-xs font-medium text-muted">{unit}</span></p>
                    <p className="mt-1 text-muted">7-day avg {fmtNum(p.ma7, 1)} · 14-day avg {fmtNum(p.ma14, 1)}</p>
                  </div>
                );
              }}
            />
            <Legend verticalAlign="top" align="left" height={26} content={() => <LegendRow />} />
            {showTarget && target != null && (
              <ReferenceLine y={target} stroke={chartColors.muted} strokeDasharray="2 4" ifOverflow="extendDomain" label={{ value: "Target", fill: TEXT, fontSize: 11, position: "insideTopRight" }} />
            )}
            <Area type="monotone" dataKey="ma7" stroke="none" fill={chartColors.brand} fillOpacity={0.1} connectNulls isAnimationActive={false} activeDot={false} legendType="none" />
            <Line type="linear" dataKey="raw" stroke="none" dot={{ r: 2, fill: chartColors.muted, fillOpacity: 0.65, strokeWidth: 0 }} activeDot={{ r: 4, fill: chartColors.muted, stroke: chartColors.surface, strokeWidth: 2 }} isAnimationActive={false} />
            <Line type="monotone" dataKey="ma14" stroke={chartColors.muted} strokeOpacity={0.7} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dot={false} activeDot={false} isAnimationActive={false} connectNulls />
            <Line type="monotone" dataKey="ma7" stroke={chartColors.brand} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dot={false} activeDot={{ r: 5, fill: chartColors.brand, stroke: chartColors.surface, strokeWidth: 2 }} isAnimationActive={false} connectNulls />
            {lastAvg && lastAvg.ma7 != null && (
              <ReferenceDot
                x={lastAvg.date} y={lastAvg.ma7} r={5} fill={chartColors.brand} stroke={chartColors.surface} strokeWidth={2} ifOverflow="extendDomain"
                label={{ value: fmtNum(lastAvg.ma7, 1), position: "top", fill: TEXT, fontSize: 12, fontWeight: 700 }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}
