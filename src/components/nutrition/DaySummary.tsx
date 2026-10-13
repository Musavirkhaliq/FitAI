"use client";
import { AnimatedNumber, RingCluster, Tile, colorVar, type RingColor } from "@/components/ui";
import { fmtNum } from "@/lib/client/format";
import type { DaySummaryDto } from "@/lib/client/types";

function MiniStat({ label, color, value, unit, of }: { label: string; color: RingColor; value: number; unit: string; of: number | null }) {
  return (
    <li className="rounded-2xl bg-surface-2 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
        <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: colorVar(color) }} />
        {label}
      </p>
      <p className="num mt-1 text-lg">
        {fmtNum(value)}
        <span className="ml-0.5 text-xs font-medium text-muted">{unit}</span>
      </p>
      <p className="text-[11px] text-muted">{of ? `of ${fmtNum(of)}` : "no target"}</p>
    </li>
  );
}

/**
 * The day at a glance: two rings (calories outer, protein inner) and the single big number, what's left.
 * Over target is said calmly. Everything calorie-related is an estimate and shows its range.
 */
export function DaySummary({ s, isToday }: { s: DaySummaryDto; isToday: boolean }) {
  const t = s.targets;
  const kcal = Math.round(s.totals.calories);
  const protein = Math.round(s.totals.protein);
  const fiber = Math.round(s.totals.fiber);
  const ratio = (v: number, target: number | null | undefined) => (target ? v / target : 0);
  const left = t ? Math.round(t.calories - kcal) : null;
  const range = kcal > 0 ? ([Math.round(s.totals.minKcal), Math.round(s.totals.maxKcal)] as const) : null;
  const pctDone = t ? Math.round(Math.min(ratio(kcal, t.calories), 9.99) * 100) : null;

  const summary = `Calories ${fmtNum(kcal)}${t ? ` of ${fmtNum(t.calories)}` : ""} kcal, estimated. Protein ${fmtNum(protein)}${t ? ` of ${fmtNum(t.proteinG)}` : ""} g.`;

  return (
    <Tile className="!p-5">
      <div className="flex items-center gap-4">
        <RingCluster
          size={136}
          stroke={13}
          gap={4}
          summary={`${isToday ? "Today" : "That day"}'s rings. ${summary}`}
          rings={[{ ratio: ratio(kcal, t?.calories), color: "cal" }, { ratio: ratio(protein, t?.proteinG), color: "protein" }]}
        >
          {pctDone != null && <span className="text-xs font-bold tabular-nums text-muted">{pctDone}%</span>}
        </RingCluster>
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
          {range && <p className="text-xs text-muted">eaten est. {fmtNum(range[0])}–{fmtNum(range[1])} kcal</p>}
        </div>
      </div>

      <ul className="mt-4 grid grid-cols-3 gap-2">
        <MiniStat label="Calories" color="cal" value={kcal} unit="kcal" of={t?.calories ?? null} />
        <MiniStat label="Protein" color="protein" value={protein} unit="g" of={t?.proteinG ?? null} />
        <MiniStat label="Fiber" color="fiber" value={fiber} unit="g" of={t?.fiberG ?? null} />
      </ul>

      <dl className="mt-3 grid grid-cols-3 gap-2 px-1 text-sm">
        <div><dt className="text-xs text-muted">Carbs</dt><dd className="font-semibold tabular-nums">{fmtNum(s.totals.carbs)} g</dd></div>
        <div><dt className="text-xs text-muted">Fat</dt><dd className="font-semibold tabular-nums">{fmtNum(s.totals.fat)} g</dd></div>
        <div><dt className="text-xs text-muted">Sodium</dt><dd className="font-semibold tabular-nums">{fmtNum(s.totals.sodium)} mg</dd></div>
      </dl>
    </Tile>
  );
}
