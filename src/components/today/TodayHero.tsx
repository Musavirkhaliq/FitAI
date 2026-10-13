"use client";
import { Check } from "lucide-react";
import { AnimatedNumber, RingCluster, Tile, colorVar, type RingColor } from "@/components/ui";
import { fmtNum } from "@/lib/client/format";

interface Row { label: string; color: RingColor; value: number; target: number | null; unit: string }

/**
 * The hero: three concentric rings (calories, protein, steps) and the ONE big number on the screen: what's left today.
 * Calories over target are shown calmly ("it's one day"), never as a failure.
 */
export function TodayHero({ calories, caloriesTarget, caloriesRange, protein, proteinTarget, steps, stepsTarget, isToday }: {
  calories: number; caloriesTarget: number | null; caloriesRange: [number, number] | null;
  protein: number; proteinTarget: number | null; steps: number; stepsTarget: number | null; isToday: boolean;
}) {
  const ratio = (v: number, t: number | null) => (t ? v / t : 0);
  const rows: Row[] = [
    { label: "Calories", color: "cal", value: calories, target: caloriesTarget, unit: "kcal" },
    { label: "Protein", color: "protein", value: protein, target: proteinTarget, unit: "g" },
    { label: "Steps", color: "steps", value: steps, target: stepsTarget, unit: "" },
  ];
  const left = caloriesTarget != null ? Math.round(caloriesTarget - calories) : null;
  const summary = rows.map((r) => `${r.label} ${fmtNum(r.value)}${r.target ? ` of ${fmtNum(r.target)}` : ""} ${r.unit}`.trim()).join(". ");

  return (
    <Tile span={2} className="!p-5">
      <div className="flex items-center gap-4">
        <RingCluster
          size={148}
          stroke={13}
          gap={4}
          summary={`Today's rings. ${summary}.`}
          rings={rows.map((r) => ({ ratio: ratio(r.value, r.target), color: r.color }))}
        />
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{isToday ? "Left today" : "Left that day"}</p>
          {left == null ? (
            <p className="num mt-1 text-[2.4rem]">—</p>
          ) : left >= 0 ? (
            <p className="num mt-1 text-[3rem] leading-none"><AnimatedNumber value={left} fromZero /></p>
          ) : (
            <p className="num mt-1 text-[3rem] leading-none text-warn"><span className="text-[1.6rem]">+</span><AnimatedNumber value={-left} fromZero /></p>
          )}
          <p className="mt-1 text-xs text-muted">
            {left == null ? "Set a calorie target in Settings" : left >= 0 ? "kcal · estimate" : "kcal over. It's one day, no big deal."}
          </p>
          {caloriesRange && calories > 0 && <p className="text-xs text-muted">eaten est. {fmtNum(caloriesRange[0])}–{fmtNum(caloriesRange[1])}</p>}
        </div>
      </div>

      <ul className="mt-4 grid grid-cols-3 gap-2">
        {rows.map((r) => {
          const done = r.target ? r.value >= r.target * (r.label === "Calories" ? 1.1 : 0.98) && r.label !== "Calories" : false;
          return (
            <li key={r.label} className="rounded-2xl bg-surface-2 px-3 py-2.5">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
                <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: colorVar(r.color) }} />
                {r.label}
                {done && <Check className="ml-auto h-3.5 w-3.5 text-good" aria-label="Target reached" />}
              </p>
              <p className="num mt-1 text-lg">
                <AnimatedNumber value={r.value} fromZero />
                {r.unit && <span className="ml-0.5 text-xs font-medium text-muted">{r.unit}</span>}
              </p>
              <p className="text-[11px] text-muted">{r.target ? `of ${fmtNum(r.target)}` : "no target"}</p>
            </li>
          );
        })}
      </ul>
    </Tile>
  );
}
