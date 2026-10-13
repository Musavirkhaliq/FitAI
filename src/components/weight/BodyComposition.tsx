"use client";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Notice } from "@/components/ui";
import { fmtDay, fmtNum, type UnitSystem } from "@/lib/client/format";
import { BodyFatEstimate } from "./BodyFatEstimate";
import { MeasurementForm } from "./MeasurementForm";
import { WaistChart } from "./WaistChart";
import type { MeasurementDto, WeightDto } from "./types";

/** Optional body-composition section: estimate (ranges), tape measurements form, waist trend, recent readings. */
export function BodyComposition({
  data, units, sex, onAdded, onRemove,
}: {
  data: WeightDto; units: UnitSystem; sex: "FEMALE" | "MALE" | null;
  onAdded: (m: Omit<MeasurementDto, "id" | "notes">) => void; onRemove: (id: string) => Promise<void>;
}) {
  const [err, setErr] = useState<string | null>(null);
  const recent = [...data.measurements].reverse().slice(0, 5);

  const remove = async (id: string) => {
    setErr(null);
    try {
      await onRemove(id);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <section className="card space-y-5" aria-labelledby="bc-h">
      <div>
        <h2 id="bc-h" className="text-sm font-semibold">Body composition (optional)</h2>
        <p className="text-xs text-muted">Tape measurements give a rough estimate. Waist change over time is often more useful than any single number. Progress photos can be added later.</p>
      </div>
      <BodyFatEstimate bodyFat={data.bodyFat} date={data.bodyFatDate} fatLost={data.fatLostEstimate} units={units} />
      <WaistChart measurements={data.measurements} />
      <MeasurementForm showHip={sex !== "MALE"} onSaved={onAdded} />
      {recent.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-semibold">Recent measurements</h3>
          <ul className="divide-y divide-border">
            {recent.map((m) => {
              const parts = [
                m.waistCm != null && `waist ${fmtNum(m.waistCm, 1)} cm`,
                m.neckCm != null && `neck ${fmtNum(m.neckCm, 1)} cm`,
                m.hipCm != null && `hip ${fmtNum(m.hipCm, 1)} cm`,
                m.bodyFatPct != null && `body fat ${fmtNum(m.bodyFatPct, 1)}% (entered by you)`,
              ].filter(Boolean);
              return (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0 text-sm">
                    <p className="font-medium">{fmtDay(m.date)}</p>
                    <p className="text-xs text-muted">{parts.join(" · ")}</p>
                  </div>
                  <button className="btn btn-ghost !min-w-[44px] !px-2" disabled={m.id.startsWith("tmp-")} onClick={() => void remove(m.id)} aria-label={`Delete measurements from ${fmtDay(m.date)}`}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <div aria-live="polite">{err && <Notice tone="warn">{err}</Notice>}</div>
    </section>
  );
}
