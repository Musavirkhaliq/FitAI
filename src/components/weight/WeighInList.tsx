"use client";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { EmptyState, Notice } from "@/components/ui";
import { fmtDay, fmtWeight, type UnitSystem } from "@/lib/client/format";
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
    <section className="card" aria-labelledby="wl-h">
      <h2 id="wl-h" className="mb-2 text-sm font-semibold">Recent weigh-ins</h2>
      {entries.length === 0 ? (
        <EmptyState title="No weigh-ins in this range" body="Log your first one above. Same time, same scale, after the bathroom works best." />
      ) : (
        <>
          <ul className="divide-y divide-border">
            {entries.slice(0, shown).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="font-medium tabular-nums">{fmtWeight(e.weightKg, units, 1)}</p>
                  <p className="truncate text-xs text-muted">{fmtDay(e.date)}{e.time ? ` · ${e.time}` : ""}{e.conditions ? ` · ${e.conditions}` : ""}</p>
                </div>
                <button
                  className="btn btn-ghost !min-w-[44px] !px-2"
                  onClick={() => void remove(e.id)}
                  disabled={busyId === e.id || e.id.startsWith("tmp-")}
                  aria-label={`Delete weigh-in of ${fmtWeight(e.weightKg, units, 1)} on ${fmtDay(e.date)}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          {entries.length > shown && (
            <button className="btn mt-2 w-full sm:w-auto" onClick={() => setShown((n) => n + PAGE)}>Show more ({entries.length - shown} older)</button>
          )}
        </>
      )}
      <div aria-live="polite" className="mt-2">{err && <Notice tone="warn">{err}</Notice>}</div>
    </section>
  );
}
