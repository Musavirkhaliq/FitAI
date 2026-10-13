"use client";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartFrame, chartColors, tooltipStyle } from "@/components/ui";
import { fmtDay, fmtNum } from "@/lib/client/format";
import type { DailyPointDto } from "@/lib/client/types";

/** Seven daily bars against a target line. Days without data are left empty rather than drawn as zero. */
export function DayBars({
  days, field, target, unit, title, color, note,
}: {
  days: DailyPointDto[]; field: "calories" | "protein"; target: number | null; unit: string; title: string; color: string; note?: string;
}) {
  const pts = days.map((d) => ({ date: d.date, v: d[field] == null ? null : Math.round(d[field] as number) }));
  const logged = pts.filter((p) => p.v != null) as { date: string; v: number }[];
  const avg = logged.length ? logged.reduce((s, p) => s + p.v, 0) / logged.length : null;
  const summary = logged.length
    ? `Average ${fmtNum(avg)} ${unit} over ${logged.length} logged ${logged.length === 1 ? "day" : "days"}${target ? `, against a target of ${fmtNum(target)} ${unit}` : ""}. ${note ?? ""}`.trim()
    : `Nothing logged in the last 7 days.${target ? ` Target is ${fmtNum(target)} ${unit}.` : ""}`;

  return (
    <ChartFrame
      title={title}
      height={200}
      summary={summary}
      table={{ columns: ["Day", unit, "Target"], rows: pts.map((p) => [fmtDay(p.date), p.v == null ? null : fmtNum(p.v), target ? fmtNum(target) : null]) }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={pts} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tickFormatter={(d: string) => fmtDay(d, { weekday: "short" })} tick={{ fontSize: 11, fill: chartColors.muted }} stroke={chartColors.grid} />
          <YAxis width={42} tick={{ fontSize: 11, fill: chartColors.muted }} stroke={chartColors.grid} />
          <Tooltip {...tooltipStyle} cursor={{ fill: "rgb(var(--surface-2))" }} labelFormatter={(d) => fmtDay(String(d))} formatter={(v: number) => [`${fmtNum(v)} ${unit}`, title]} />
          {target ? <ReferenceLine y={target} stroke={chartColors.muted} strokeDasharray="5 4" ifOverflow="extendDomain" label={{ value: "Target", fill: chartColors.muted, fontSize: 11, position: "insideTopRight" }} /> : null}
          <Bar dataKey="v" fill={color} radius={[6, 6, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
