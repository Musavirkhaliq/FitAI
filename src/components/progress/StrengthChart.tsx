"use client";
import { useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Chip, ChartFrame, chartColors, EmptyState } from "@/components/ui";
import { fmtDay, fmtNum, type UnitSystem } from "@/lib/client/format";
import { toDisplay, unitLabel } from "@/components/weight/trend";
import type { StrengthSeriesDto } from "./types";

interface Pt { date: string; est: number }

/** Estimated 1RM over time for one exercise, chosen from a row of chips. One series, so no legend. */
export function StrengthChart({ strength, units }: { strength: StrengthSeriesDto[]; units: UnitSystem }) {
  const [picked, setPicked] = useState<string | null>(null);
  const options = strength.filter((s) => s.points.length > 0);
  if (!options.length) {
    return <EmptyState title="No strength data yet" body="Log a few sets in a workout (weight and reps) and your estimated 1RM will show up here." />;
  }
  const fallback = options.reduce((a, b) => (b.points.length > a.points.length ? b : a));
  const current = options.find((o) => o.exercise === picked) ?? fallback;
  const unit = unitLabel(units);
  const pts: Pt[] = current.points.map((p) => ({ date: p.date, est: toDisplay(p.est1rm, units) }));
  const first = pts[0];
  const last = pts[pts.length - 1];
  const best = pts.reduce((a, b) => (b.est > a.est ? b : a));
  const change = last.est - first.est;

  return (
    <div className="space-y-3">
      <div role="group" aria-label="Exercise" className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {options.map((o) => (
          <span key={o.exercise} className="shrink-0">
            <Chip active={o.exercise === current.exercise} onClick={() => setPicked(o.exercise)}>{o.exercise}</Chip>
          </span>
        ))}
      </div>

      <ChartFrame
        title={`${current.exercise}: estimated 1RM (${unit})`}
        height={220}
        summary={
          pts.length < 2
            ? `One session so far: estimated 1RM about ${fmtNum(first.est, 1)} ${unit}. Log another session to see progress.`
            : `Estimated one-rep max went from about ${fmtNum(first.est, 1)} ${unit} to ${fmtNum(last.est, 1)} ${unit} across ${pts.length} sessions. Best so far ${fmtNum(best.est, 1)} ${unit} on ${fmtDay(best.date)}. These are estimates from your sets, not tested maxes.`
        }
        table={{ columns: ["Date", `Est. 1RM (${unit})`], rows: [...pts].reverse().map((p) => [fmtDay(p.date), fmtNum(p.est, 1)]) }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={pts} margin={{ top: 4, right: 28, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={chartColors.grid} vertical={false} />
            <XAxis dataKey="date" tickFormatter={(d: string) => fmtDay(d, { day: "numeric", month: "short" })} tick={{ fontSize: 11, fill: chartColors.muted }} minTickGap={44} tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis domain={[(min: number) => Math.floor(min * 0.95), (max: number) => Math.ceil(max * 1.03)]} width={36} tickCount={4} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtNum(v, 0)} tick={{ fontSize: 11, fill: chartColors.muted }} />
            <Tooltip
              cursor={{ stroke: chartColors.muted, strokeWidth: 1, strokeOpacity: 0.5 }}
              wrapperStyle={{ outline: "none" }}
              content={({ active, payload }) => {
                const p = active ? (payload?.[0]?.payload as Pt | undefined) : undefined;
                if (!p) return null;
                return (
                  <div className="glass rounded-2xl border border-border px-3 py-2 text-xs shadow-float">
                    <p className="font-semibold text-muted">{fmtDay(p.date)}</p>
                    <p className="num mt-1 !text-base">{fmtNum(p.est, 1)} <span className="text-xs font-medium text-muted">{unit} est. 1RM</span></p>
                  </div>
                );
              }}
            />
            <Area type="monotone" dataKey="est" stroke="none" fill={chartColors.brand} fillOpacity={0.1} isAnimationActive={false} activeDot={false} />
            <Line type="monotone" dataKey="est" stroke={chartColors.brand} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dot={pts.length <= 3 ? { r: 3, fill: chartColors.brand, strokeWidth: 0 } : false} activeDot={{ r: 5, fill: chartColors.brand, stroke: chartColors.surface, strokeWidth: 2 }} isAnimationActive={false} />
            <ReferenceDot
              x={last.date} y={last.est} r={5} fill={chartColors.brand} stroke={chartColors.surface} strokeWidth={2} ifOverflow="extendDomain"
              label={{ value: fmtNum(last.est, 1), position: "top", fill: "rgb(var(--fg))", fontSize: 12, fontWeight: 700 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartFrame>

      {pts.length >= 2 && (
        <p className="px-1 text-sm text-muted">
          {change > 0.05
            ? `Up about ${fmtNum(change, 1)} ${unit} since your first logged session. That is built one session at a time.`
            : change < -0.05
              ? `Down about ${fmtNum(Math.abs(change), 1)} ${unit} from your first session. Sleep, stress and the rep range you chose all move this estimate, so look at the long run.`
              : "Holding steady since your first session. Steady is a fine place to build from."}
          {" "}Estimates from your sets, not tested maxes.
        </p>
      )}
    </div>
  );
}
