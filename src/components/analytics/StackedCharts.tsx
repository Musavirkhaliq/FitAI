"use client";
import { useId, useState } from "react";
import { Area, Bar, CartesianGrid, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartFrame, chartColors } from "@/components/ui";
import { fmtNum } from "@/lib/client/format";
import { compactNum, padDomain, shortDay } from "./util";

/**
 * Small multiples that share one x-axis. This replaces dual-axis charts: two measures on different scales each get their
 * own panel (own y-axis, own colour), stacked and aligned, with a single crosshair readout so values are easy to compare in time.
 */
export interface StackPanel {
  key: string;
  label: string;
  unit: string;
  color: string;
  kind: "line" | "bar";
  dp?: number;
  /** Optional goal drawn as a dashed reference line (bars only). */
  target?: number | null;
  height?: number;
}
export type StackRow = { date: string } & Record<string, string | number | null>;

const AXIS = { fontSize: 11, fill: chartColors.muted };
const READOUT_H = 76;
const LABEL_H = 24;
const X_AXIS_H = 24;

export function StackedCharts({ title, rows, panels, summary, table, readoutDate }: {
  title: string; rows: StackRow[]; panels: StackPanel[]; summary: string;
  table: { columns: string[]; rows: (string | number | null)[][] }; readoutDate: (date: string) => string;
}) {
  const sync = useId();
  const [hover, setHover] = useState<number | null>(null);
  const idx = hover != null && hover >= 0 && hover < rows.length ? hover : rows.length - 1;
  const at = rows[idx];
  const height = READOUT_H + panels.reduce((t, p) => t + (p.height ?? (p.kind === "line" ? 120 : 88)) + LABEL_H, 0) + X_AXIS_H;
  const track = (s: { activeTooltipIndex?: number }) => {
    if (typeof s.activeTooltipIndex === "number") setHover(s.activeTooltipIndex);
  };

  return (
    <ChartFrame title={title} summary={summary} table={table} height={height}>
      <div className="flex h-full flex-col">
        {/* One readout for every panel: the crosshair moves through all of them together. */}
        <div className="flex flex-col justify-center" style={{ height: READOUT_H }} aria-hidden>
          <p className="display text-sm font-bold">{at ? readoutDate(at.date) : ""}</p>
          <p className="mt-1 flex flex-wrap gap-x-3.5 gap-y-1 text-xs">
            {panels.map((p) => {
              const v = at?.[p.key];
              return (
                <span key={p.key} className="inline-flex items-center gap-1.5 tabular-nums">
                  <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                  {typeof v === "number" ? `${fmtNum(v, p.dp ?? 0)} ${p.unit}` : <span className="text-muted">—</span>}
                </span>
              );
            })}
          </p>
        </div>

        {panels.map((p, i) => {
          const isLast = i === panels.length - 1;
          const h = p.height ?? (p.kind === "line" ? 120 : 88);
          const end = [...rows].reverse().find((r) => typeof r[p.key] === "number");
          const endV = end ? (end[p.key] as number) : null;
          return (
            <div key={p.key}>
              <p className="flex items-center gap-2 text-xs font-semibold text-muted" style={{ height: LABEL_H }}>
                <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                {p.label}
              </p>
              <ResponsiveContainer width="100%" height={h + (isLast ? X_AXIS_H : 0)}>
                <ComposedChart data={rows} syncId={sync} syncMethod="index" margin={{ top: p.kind === "line" ? 16 : 6, right: 10, bottom: 0, left: 0 }} onMouseMove={track} onClick={track}>
                  <CartesianGrid stroke={chartColors.grid} strokeWidth={1} vertical={false} />
                  <XAxis dataKey="date" hide={!isLast} tickFormatter={shortDay} tick={AXIS} tickLine={false} axisLine={{ stroke: chartColors.grid }} minTickGap={32} height={X_AXIS_H} />
                  <YAxis
                    width={44}
                    tick={AXIS}
                    tickLine={false}
                    axisLine={false}
                    tickCount={3}
                    tickFormatter={compactNum}
                    domain={p.kind === "bar" ? [0, (m: number) => Math.max(m, p.target ?? 0) * 1.08] : padDomain}
                  />
                  <Tooltip content={() => null} cursor={{ stroke: chartColors.muted, strokeWidth: 1 }} isAnimationActive={false} />
                  {p.kind === "bar" && p.target != null && (
                    <ReferenceLine y={p.target} stroke={chartColors.muted} strokeWidth={1} strokeDasharray="4 4" label={{ value: "target", position: "insideTopRight", fontSize: 11, fill: chartColors.muted }} />
                  )}
                  {p.kind === "bar" ? (
                    <Bar dataKey={p.key} fill={p.color} maxBarSize={24} radius={[4, 4, 0, 0]} stroke={chartColors.surface} strokeWidth={1} isAnimationActive={false} />
                  ) : (
                    <>
                      <Area type="monotone" dataKey={p.key} stroke="none" fill={p.color} fillOpacity={0.1} connectNulls isAnimationActive={false} />
                      <Line type="monotone" dataKey={p.key} stroke={p.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dot={false} activeDot={{ r: 4, fill: p.color, stroke: chartColors.surface, strokeWidth: 2 }} connectNulls isAnimationActive={false} />
                      {end && endV != null && (
                        <ReferenceDot x={end.date} y={endV} r={4} fill={p.color} stroke={chartColors.surface} strokeWidth={2} ifOverflow="extendDomain" label={{ value: fmtNum(endV, p.dp ?? 0), position: "top", fontSize: 11, fill: chartColors.muted }} />
                      )}
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          );
        })}
      </div>
    </ChartFrame>
  );
}

type Row = Record<string, string | number | null>;

/** A single-series line with a 10% wash and an end-dot ringed in the surface colour. Hover or tap for exact values. */
export function SingleLine({ rows, dataKey, color, unit, dp = 1, height = 200, dots = false }: {
  rows: Row[]; dataKey: string; color: string; unit: string; dp?: number; height?: number; dots?: boolean;
}) {
  const end = [...rows].reverse().find((r) => typeof r[dataKey] === "number");
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 16, right: 10, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={chartColors.grid} strokeWidth={1} vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDay} tick={AXIS} tickLine={false} axisLine={{ stroke: chartColors.grid }} minTickGap={32} />
        <YAxis width={44} tick={AXIS} tickLine={false} axisLine={false} tickCount={4} tickFormatter={compactNum} domain={padDomain} />
        <Tooltip content={<TinyTooltip unit={unit} dp={dp} />} cursor={{ stroke: chartColors.muted, strokeWidth: 1 }} isAnimationActive={false} />
        <Area type="monotone" dataKey={dataKey} stroke="none" fill={color} fillOpacity={0.1} connectNulls isAnimationActive={false} />
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dot={dots ? { r: 3, fill: color, stroke: chartColors.surface, strokeWidth: 1 } : false} activeDot={{ r: 5, fill: color, stroke: chartColors.surface, strokeWidth: 2 }} connectNulls isAnimationActive={false} />
        {end && <ReferenceDot x={end.date as string} y={end[dataKey] as number} r={4} fill={color} stroke={chartColors.surface} strokeWidth={2} ifOverflow="extendDomain" label={{ value: fmtNum(end[dataKey] as number, dp), position: "top", fontSize: 11, fill: chartColors.muted }} />}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Single-series bars: ≤ 24 px wide, 4 px rounded data end, 2 px gaps (a surface-coloured hairline either side). */
export function SingleBars({ rows, dataKey, color, unit, dp = 0, height = 200 }: {
  rows: Row[]; dataKey: string; color: string; unit: string; dp?: number; height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={chartColors.grid} strokeWidth={1} vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDay} tick={AXIS} tickLine={false} axisLine={{ stroke: chartColors.grid }} minTickGap={32} />
        <YAxis width={44} tick={AXIS} tickLine={false} axisLine={false} tickCount={4} tickFormatter={compactNum} domain={[0, (m: number) => m * 1.08]} />
        <Tooltip content={<TinyTooltip unit={unit} dp={dp} weekOf />} cursor={{ fill: "rgb(var(--surface-2))", opacity: 0.7 }} isAnimationActive={false} />
        <Bar dataKey={dataKey} fill={color} maxBarSize={24} radius={[4, 4, 0, 0]} stroke={chartColors.surface} strokeWidth={1} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

interface TipProps {
  /** Injected by Recharts. */
  active?: boolean;
  payload?: { value?: number | string | null }[];
  label?: string | number;
  /** Ours. */
  unit: string;
  dp: number;
  weekOf?: boolean;
}

/** Tooltip card in the app's glass style. Recharts injects active/payload/label; we add the unit. */
function TinyTooltip({ active, payload, label, unit, dp, weekOf }: TipProps) {
  const v = payload?.[0]?.value;
  if (!active || typeof v !== "number") return null;
  return (
    <div className="glass rounded-2xl border border-border px-3 py-2 text-xs shadow-float">
      <p className="text-muted">{weekOf ? "Week of " : ""}{typeof label === "string" ? shortDay(label) : label}</p>
      <p className="num !text-sm">{fmtNum(v, dp)} {unit}</p>
    </div>
  );
}
