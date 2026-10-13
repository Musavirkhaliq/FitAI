import { fmtNum, fmtDay, type UnitSystem } from "@/lib/client/format";
import { fmtWeightRange } from "./trend";
import type { BodyFatDto } from "./types";

/** Estimated body composition, always as ranges and always labelled an estimate. */
export function BodyFatEstimate({ bodyFat, date, fatLost, units }: { bodyFat: BodyFatDto | null; date: string | null; fatLost: { lowKg: number; highKg: number } | null; units: UnitSystem }) {
  return (
    <div className="space-y-3">
      {bodyFat ? (
        <>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted">Body fat (estimate)</dt>
              <dd className="text-xl font-semibold tabular-nums">≈ {fmtNum(bodyFat.low, 0)}–{fmtNum(bodyFat.high, 0)}%</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Fat mass (estimate)</dt>
              <dd className="text-xl font-semibold tabular-nums">≈ {fmtWeightRange(bodyFat.fatMassKg.low, bodyFat.fatMassKg.high, units)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Lean mass (estimate)</dt>
              <dd className="text-xl font-semibold tabular-nums">≈ {fmtWeightRange(bodyFat.leanMassKg.low, bodyFat.leanMassKg.high, units)}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted">{bodyFat.method}{date ? ` Based on your ${fmtDay(date, { day: "numeric", month: "short" })} measurements.` : ""} Ranges are wide on purpose; use them to compare over time, not as a verdict.</p>
        </>
      ) : (
        <p className="text-sm text-muted">No body-fat estimate yet. Log waist and neck together (plus hip if you're female) and make sure your height is in your profile.</p>
      )}
      {fatLost && (
        <p className="text-sm">
          Estimated fat lost so far ≈ <span className="font-semibold tabular-nums">{fmtWeightRange(fatLost.lowKg, fatLost.highKg, units)}</span>
          <span className="text-muted"> (an estimate: roughly 60–90% of lost weight is fat, the rest is water and lean tissue).</span>
        </p>
      )}
    </div>
  );
}
