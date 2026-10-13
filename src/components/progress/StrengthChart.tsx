"use client";
import { useId, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartFrame, chartColors, EmptyState, tooltipStyle } from "@/components/ui";
import { fmtDay, fmtNum, type UnitSystem } from "@/lib/client/format";
import { toDisplay, unitLabel } from "@/components/weight/trend";
import type { StrengthSeriesDto } from "./types";

/** Estimated 1RM over time for one exercise, chosen from a labelled picker. */
export function StrengthChart({ strength, units }: { strength: StrengthSeriesDto[]; units: UnitSystem }) {
  const selectId = useId();
  const [picked, setPicked] = useState<string | null>(null);
  const options = strength.filter((s) => s.points.length > 0);
  if (!options.length) {
    return <EmptyState title="No strength data yet" body="Log a few sets in a workout (weight and reps) and your estimated 1RM will show up here." />;
  }
  const fallback = options.reduce((a, b) => (b.points.length > a.points.length ? b : a));
  const current = options.find((o) => o.exercise === picked) ?? fallback;
  const unit = unitLabel(units);
  const pts = current.points.map((p) => ({ date: p.date, est: toDisplay(p.est1rm, units) }));
  const first = pts[0];
  const last = pts[pts.length - 1];
  const best = pts.reduce((a, b) => (b.est > a.est ? b : a));

  return (
    <div className="space-y-3">
      <div className="max-w-xs">
        <label className="label" htmlFor={selectId}>Exercise</label>
        <select id={selectId} className="input" value={current.exercise} onChange={(e) => setPicked(e.target.value)}>
          {options.map((o) => (
            <option key={o.exercise} value={o.exercise}>{o.exercise}</option>
          ))}
        </select>
      </div>
      <ChartFrame
        title={`${current.exercise}: estimated 1RM (${unit})`}
        height={240}
        summary={
          pts.length < 2
            ? `One session so far: estimated 1RM about ${fmtNum(first.est, 1)} ${unit}. Log another session to see progress.`
            : `Estimated one-rep max went from about ${fmtNum(first.est, 1)} ${unit} to ${fmtNum(last.est, 1)} ${unit} across ${pts.length} sessions. Best so far ${fmtNum(best.est, 1)} ${unit} on ${fmtDay(best.date)}. These are estimates from your sets, not tested maxes.`
        }
        table={{ columns: ["Date", `Est. 1RM (${unit})`], rows: [...pts].reverse().map((p) => [fmtDay(p.date), fmtNum(p.est, 1)]) }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={pts} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tickFormatter={(d: string) => fmtDay(d, { day: "numeric", month: "short" })} tick={{ fontSize: 11, fill: chartColors.muted }} minTickGap={32} stroke={chartColors.grid} />
            <YAxis domain={[(min: number) => Math.floor(min * 0.95), (max: number) => Math.ceil(max * 1.03)]} width={40} tick={{ fontSize: 11, fill: chartColors.muted }} stroke={chartColors.grid} />
            <Tooltip {...tooltipStyle} labelFormatter={(d) => fmtDay(String(d))} formatter={(v: number) => [`${fmtNum(v, 1)} ${unit}`, "Estimated 1RM"]} />
            <Line type="monotone" dataKey="est" stroke={chartColors.brand} strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}
