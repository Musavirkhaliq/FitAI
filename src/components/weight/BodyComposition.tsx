"use client";
import { Ruler, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { Notice, Sheet } from "@/components/ui";
import { fmtDay, fmtNum, type UnitSystem } from "@/lib/client/format";
import { BodyFatEstimate } from "./BodyFatEstimate";
import { MeasurementForm } from "./MeasurementForm";
import { WaistChart } from "./WaistChart";
import type { MeasurementDto, WeightDto } from "./types";

/** Optional body-composition section: estimate (ranges), waist trend, recent readings; the tape-measure form opens in a sheet. */
export function BodyComposition({
  data, units, sex, onAdded, onRemove,
}: {
  data: WeightDto; units: UnitSystem; sex: "FEMALE" | "MALE" | null;
  onAdded: (m: Omit<MeasurementDto, "id" | "notes">) => void; onRemove: (id: string) => Promise<void>;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<{ tone: "good" | "warn"; text: string } | null>(null);
  const close = useCallback(() => setOpen(false), []);
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
    <>
    <section className="card rise space-y-4" aria-labelledby="bc-h">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="bc-h" className="display text-lg font-extrabold">Body composition</h2>
          <p className="mt-1 text-sm text-muted">Optional. Tape measurements give a rough estimate; waist change over time is often more useful than any single number.</p>
        </div>
        <button className="btn shrink-0" onClick={() => { setSaved(null); setOpen(true); }}>
          <Ruler className="h-4 w-4" aria-hidden /> Add
        </button>
      </div>
      <div aria-live="polite">{saved && <Notice tone={saved.tone}>{saved.text}</Notice>}</div>
      <BodyFatEstimate bodyFat={data.bodyFat} date={data.bodyFatDate} fatLost={data.fatLostEstimate} units={units} />
      <WaistChart measurements={data.measurements} />
      {recent.length > 0 && (
        <div>
          <h3 className="eyebrow mb-1">Recent measurements</h3>
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
                  <button className="btn btn-ghost !min-h-[48px] !min-w-[48px] !px-2" disabled={m.id.startsWith("tmp-")} onClick={() => void remove(m.id)} aria-label={`Delete measurements from ${fmtDay(m.date)}`}>
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
      <Sheet open={open} onClose={close} title="Log measurements">
        <MeasurementForm
          showHip={sex !== "MALE"}
          onSaved={(m, queued) => {
            onAdded(m);
            setSaved(queued ? { tone: "warn", text: "You're offline. Your measurements are queued and will sync later." } : { tone: "good", text: "Measurements saved." });
            setOpen(false);
          }}
        />
      </Sheet>
    </>
  );
}
