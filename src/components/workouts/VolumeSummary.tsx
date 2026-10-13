"use client";
import { AlertTriangle, ArrowDownToLine, CheckCircle2, type LucideIcon } from "lucide-react";
import { clsx } from "@/components/ui";
import type { VolumeRowDto, VolumeStatusDto } from "./types";
import { MUSCLE_LABEL } from "./util";

const STATUS: Record<VolumeStatusDto, { text: string; icon: LucideIcon; badge: string; bar: string }> = {
  BELOW_MEV: { text: "Below the minimum that drives growth", icon: ArrowDownToLine, badge: "bg-warn/15 text-warn", bar: "bg-warn" },
  PRODUCTIVE: { text: "In the productive range", icon: CheckCircle2, badge: "bg-good/15 text-good", bar: "bg-good" },
  NEAR_MRV: { text: "Near your upper limit, watch recovery", icon: AlertTriangle, badge: "bg-warn/15 text-warn", bar: "bg-warn" },
  OVER_MRV: { text: "Above what most people recover from", icon: AlertTriangle, badge: "bg-bad/15 text-bad", bar: "bg-bad" },
};

/** Hard sets this week against MEV (minimum effective) and MRV (maximum recoverable) landmarks. */
export function VolumeSummary({ rows }: { rows: VolumeRowDto[] }) {
  return (
    <section className="card rise" aria-labelledby="vol-h">
      <h2 id="vol-h" className="display text-lg font-extrabold">Weekly volume</h2>
      <p className="mt-0.5 text-sm text-muted">Hard sets (effort of RPE 6 or more) in the last 7 days. The tick marks the minimum effective volume (MEV); the full bar is the maximum recoverable volume (MRV).</p>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Log a few sets this week and your volume per muscle will show up here.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {rows.map((r) => {
            const s = STATUS[r.status];
            const Icon = s.icon;
            const max = Math.max(r.mrv, r.hardSets, 1);
            return (
              <li key={r.muscle}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{MUSCLE_LABEL(r.muscle)}</span>
                  <span className="text-sm tabular-nums text-muted"><span className="num !text-lg text-fg">{r.hardSets}</span> sets · MEV {r.mev} · MRV {r.mrv}</span>
                </div>
                <div className="relative mt-1.5">
                  <div
                    role="progressbar"
                    aria-label={`${MUSCLE_LABEL(r.muscle)} hard sets this week`}
                    aria-valuemin={0}
                    aria-valuemax={max}
                    aria-valuenow={r.hardSets}
                    aria-valuetext={`${r.hardSets} sets. ${s.text}`}
                    className="h-3 w-full overflow-hidden rounded-full bg-surface-2"
                  >
                    <div className={clsx("h-full rounded-full transition-[width] duration-700 ease-out", s.bar)} style={{ width: `${(r.hardSets / max) * 100}%` }} />
                  </div>
                  {r.mev > 0 && <span aria-hidden className="absolute -top-1 h-5 w-0.5 rounded bg-fg/60" style={{ left: `${(r.mev / max) * 100}%` }} />}
                </div>
                <p className={clsx("mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", s.badge)}>
                  <Icon className="h-3.5 w-3.5" aria-hidden /> {s.text}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
