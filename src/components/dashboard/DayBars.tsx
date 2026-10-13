"use client";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartFrame, chartColors } from "@/components/ui";
import { fmtDay, fmtNum } from "@/lib/client/format";
import type { DailyPointDto } from "@/lib/client/types";

interface Pt { date: string; v: number | null }

/** Seven daily bars (one measure, one colour) against a target line. Days without data are left empty rather than drawn as zero. */
export function DayBars({
  days, field, target, unit, title, color, note,
}: {
  days: DailyPointDto[]; field: "calories" | "protein"; target: number | null; unit: string; title: string; color: string; note?: string;
}) {
  const pts: Pt[] = days.map((d) => ({ date: d.date, v: d[field] == null ? null : Math.round(d[field] as number) }));
  const logged = pts.filter((p): p is { date: string; v: number } => p.v != null);
  const avg = logged.length ? logged.reduce((s, p) => s + p.v, 0) / logged.length : null;
  const summary = logged.length
    ? `Average ${fmtNum(avg)} ${unit} over ${logged.length} logged ${logged.length === 1 ? "day" : "days"}${target ? `, against a target of ${fmtNum(target)} ${unit}` : ""}. ${note ?? ""}`.trim()
    : `Nothing logged in the last 7 days.${target ? ` Target is ${fmtNum(target)} ${unit}.` : ""}`;

  return (
    <ChartFrame
      title={title}
      height={170}
      summary={summary}
      table={{ columns: ["Day", unit, "Target"], rows: pts.map((p) => [fmtDay(p.date), p.v == null ? null : fmtNum(p.v), target ? fmtNum(target) : null]) }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={pts} margin={{ top: 8, right: 44, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid stroke={chartColors.grid} vertical={false} />
          <XAxis dataKey="date" tickFormatter={(d: string) => fmtDay(d, { weekday: "narrow" })} tick={{ fontSize: 11, fill: chartColors.muted }} tickLine={false} axisLine={false} tickMargin={6} interval={0} />
          <YAxis width={38} tickCount={3} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: chartColors.muted }} tickFormatter={(v: number) => fmtNum(v)} />
          <Tooltip
            cursor={{ fill: "rgb(var(--surface-2))", fillOpacity: 0.7 }}
            wrapperStyle={{ outline: "none" }}
            content={({ active, payload }) => {
              const p = active ? (payload?.[0]?.payload as Pt | undefined) : undefined;
              if (!p) return null;
              return (
                <div className="glass rounded-2xl border border-border px-3 py-2 text-xs shadow-float">
                  <p className="font-semibold text-muted">{fmtDay(p.date)}</p>
                  <p className="num mt-1 !text-base">{p.v == null ? "Not logged" : <>{fmtNum(p.v)} <span className="text-xs font-medium text-muted">{unit}</span></>}</p>
                </div>
              );
            }}
          />
          {target ? (
            <ReferenceLine y={target} stroke={chartColors.muted} strokeDasharray="4 4" ifOverflow="extendDomain" label={{ value: fmtNum(target), fill: "rgb(var(--muted))", fontSize: 11, position: "right" }} />
          ) : null}
          <Bar dataKey="v" fill={color} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
