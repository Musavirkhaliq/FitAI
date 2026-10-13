"use client";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { EmptyState, Notice } from "@/components/ui";
import { fmtDay, fmtDelta, fmtWeight, type UnitSystem } from "@/lib/client/format";
import type { WeightEntryDto } from "./types";

const PAGE = 10;

/** Recent weigh-ins (newest first) with delete. Rows with a temporary id are still saving. */
export function WeighInList({ entries, units, onRemove }: { entries: WeightEntryDto[]; units: UnitSystem; onRemove: (id: string) => Promise<void> }) {
  const [shown, setShown] = useState(PAGE);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const remove = async (id: string) => {
    setErr(null);
    setBusyId(id);
    try {
      await onRemove(id);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="card rise" aria-labelledby="wl-h">
      <h2 id="wl-h" className="display mb-1 text-lg font-extrabold">Recent weigh-ins</h2>
      {entries.length === 0 ? (
        <EmptyState title="No weigh-ins in this range" body="Log your first one above. Same time, same scale, after the bathroom works best." />
      ) : (
        <>
          <ul className="divide-y divide-border">
            {entries.slice(0, shown).map((e, i) => {
              const prev = entries[i + 1];
              const step = prev ? e.weightKg - prev.weightKg : null;
              return (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="flex items-baseline gap-2">
                      <span className="num !text-[1.25rem]">{fmtWeight(e.weightKg, units, 1)}</span>
                      {step != null && Math.abs(step) >= 0.05 && <span className="text-xs text-muted">{fmtDelta(step, units)} vs previous</span>}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted">{fmtDay(e.date)}{e.time ? ` · ${e.time}` : ""}{e.conditions ? ` · ${e.conditions}` : ""}</p>
                  </div>
                  <button
                    className="btn btn-ghost !min-h-[48px] !min-w-[48px] !px-2"
                    onClick={() => void remove(e.id)}
                    disabled={busyId === e.id || e.id.startsWith("tmp-")}
                    aria-label={`Delete weigh-in of ${fmtWeight(e.weightKg, units, 1)} on ${fmtDay(e.date)}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
          {entries.length > shown && (
            <button className="btn mt-2 w-full" onClick={() => setShown((n) => n + PAGE)}>Show more ({entries.length - shown} older)</button>
          )}
        </>
      )}
      <div aria-live="polite" className="mt-2">{err && <Notice tone="warn">{err}</Notice>}</div>
    </section>
  );
}
