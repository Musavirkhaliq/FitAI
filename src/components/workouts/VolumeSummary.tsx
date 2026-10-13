"use client";
import { Badge } from "@/components/ui";
import type { VolumeRowDto, VolumeStatusDto } from "./types";
import { MUSCLE_LABEL } from "./util";

const STATUS: Record<VolumeStatusDto, { text: string; tone: "warn" | "good" | "bad"; bar: string }> = {
  BELOW_MEV: { text: "Below the minimum that drives growth", tone: "warn", bar: "bg-warn" },
  PRODUCTIVE: { text: "In the productive range", tone: "good", bar: "bg-good" },
  NEAR_MRV: { text: "Near your upper limit, watch recovery", tone: "warn", bar: "bg-warn" },
  OVER_MRV: { text: "Above what most people recover from", tone: "bad", bar: "bg-bad" },
};

/** Hard sets this week against MEV (minimum effective) and MRV (maximum recoverable) landmarks. */
export function VolumeSummary({ rows }: { rows: VolumeRowDto[] }) {
  return (
    <section className="card" aria-labelledby="vol-h">
      <h2 id="vol-h" className="text-sm font-semibold">Weekly volume</h2>
      <p className="text-xs text-muted">Hard sets (effort of RPE 6 or more) in the last 7 days. The tick marks the minimum effective volume (MEV); the full bar is the maximum recoverable volume (MRV).</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Log a few sets this week and your volume per muscle will show up here.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {rows.map((r) => {
            const s = STATUS[r.status];
            const max = Math.max(r.mrv, r.hardSets, 1);
            return (
              <li key={r.muscle}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium">{MUSCLE_LABEL(r.muscle)}</span>
                  <span className="tabular-nums text-muted">{r.hardSets} sets · MEV {r.mev} · MRV {r.mrv}</span>
                </div>
                <div className="relative mt-1">
                  <div
                    role="progressbar"
                    aria-label={`${MUSCLE_LABEL(r.muscle)} hard sets this week`}
                    aria-valuemin={0}
                    aria-valuemax={max}
                    aria-valuenow={r.hardSets}
                    aria-valuetext={`${r.hardSets} sets. ${s.text}`}
                    className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2"
                  >
                    <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${(r.hardSets / max) * 100}%` }} />
                  </div>
                  {r.mev > 0 && <span aria-hidden className="absolute -top-0.5 h-3.5 w-0.5 rounded bg-fg/60" style={{ left: `${(r.mev / max) * 100}%` }} />}
                </div>
                <div className="mt-1"><Badge tone={s.tone}>{s.text}</Badge></div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
