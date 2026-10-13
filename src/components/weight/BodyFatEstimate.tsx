import { Info } from "lucide-react";
import { fmtNum, fmtDay, type UnitSystem } from "@/lib/client/format";
import { RangeBar } from "./RangeBar";
import { fmtWeightRange, toDisplay } from "./trend";
import type { BodyFatDto } from "./types";

/** Estimated body composition, always as ranges on a bar and always labelled an estimate. */
export function BodyFatEstimate({ bodyFat, date, fatLost, units }: { bodyFat: BodyFatDto | null; date: string | null; fatLost: { lowKg: number; highKg: number } | null; units: UnitSystem }) {
  const total = bodyFat ? toDisplay(bodyFat.fatMassKg.high + bodyFat.leanMassKg.high, units) : 0;
  return (
    <div className="space-y-3">
      {bodyFat ? (
        <>
          <div className="grid gap-2.5 sm:grid-cols-3">
            <RangeBar label="Body fat" low={bodyFat.low} mid={bodyFat.mid} high={bodyFat.high} domain={[0, 50]} text={`≈ ${fmtNum(bodyFat.low, 0)}–${fmtNum(bodyFat.high, 0)}%`} />
            <RangeBar
              label="Fat mass"
              low={toDisplay(bodyFat.fatMassKg.low, units)}
              mid={toDisplay((bodyFat.fatMassKg.low + bodyFat.fatMassKg.high) / 2, units)}
              high={toDisplay(bodyFat.fatMassKg.high, units)}
              domain={[0, total]}
              text={`≈ ${fmtWeightRange(bodyFat.fatMassKg.low, bodyFat.fatMassKg.high, units)}`}
            />
            <RangeBar
              label="Lean mass"
              low={toDisplay(bodyFat.leanMassKg.low, units)}
              mid={toDisplay((bodyFat.leanMassKg.low + bodyFat.leanMassKg.high) / 2, units)}
              high={toDisplay(bodyFat.leanMassKg.high, units)}
              domain={[0, total]}
              text={`≈ ${fmtWeightRange(bodyFat.leanMassKg.low, bodyFat.leanMassKg.high, units)}`}
            />
          </div>
          <p className="flex items-start gap-2 text-xs text-muted">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{bodyFat.method}{date ? ` Based on your ${fmtDay(date, { day: "numeric", month: "short" })} measurements.` : ""} Ranges are wide on purpose; use them to compare over time, not as a verdict.</span>
          </p>
        </>
      ) : (
        <p className="rounded-2xl bg-surface-2 px-3.5 py-3 text-sm text-muted">No body-fat estimate yet. Log waist and neck together (plus hip if you&apos;re female) and make sure your height is in your profile.</p>
      )}
      {fatLost && (
        <div className="rounded-2xl bg-brand/10 px-3.5 py-3">
          <p className="eyebrow">Fat lost so far (est.)</p>
          <p className="num mt-1.5 text-[1.4rem]">≈ {fmtWeightRange(fatLost.lowKg, fatLost.highKg, units)}</p>
          <p className="mt-1 text-xs text-muted">An estimate: roughly 60–90% of lost weight is fat, the rest is water and lean tissue.</p>
        </div>
      )}
    </div>
  );
}
