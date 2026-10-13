"use client";
import { Trophy } from "lucide-react";
import { Notice, ProgressBar } from "@/components/ui";
import { fmtDay, fmtWeight, type UnitSystem } from "@/lib/client/format";
import type { PrDto } from "@/components/workouts/types";
import { localizeKg } from "@/components/workouts/util";
import type { AnalyticsDto, CorrelationsDto } from "./types";
import { corrLabel } from "./util";

const tone = (p: number) => (p >= 80 ? "good" : p >= 50 ? "brand" : "warn") as "good" | "brand" | "warn";

function Tile({ label, pct, detail }: { label: string; pct: number | null; detail: string }) {
  return (
    <div className="card !p-3 sm:!p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      {pct == null ? (
        <>
          <p className="mt-1 text-2xl font-semibold">—</p>
          <p className="mt-1 text-xs text-muted">Needs a goal (Settings) and some logged days.</p>
        </>
      ) : (
        <>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{pct}%</p>
          <div className="mt-2"><ProgressBar value={pct} max={100} label={`${label}, estimated adherence`} tone={tone(pct)} /></div>
          <p className="mt-2 text-xs text-muted">{detail}</p>
        </>
      )}
    </div>
  );
}

export function AdherenceTiles({ adherence }: { adherence: AnalyticsDto["adherence"] }) {
  return (
    <section aria-labelledby="adh-h" className="space-y-2">
      <div>
        <h2 id="adh-h" className="text-lg font-semibold">Estimated adherence</h2>
        <p className="text-sm text-muted">Rough guides to how consistent you&apos;ve been. Missed days happen; progress comes from the overall pattern.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Logging" pct={adherence.loggingPct} detail="of days with food logged" />
        <Tile label="Calories" pct={adherence.calorieTargetPct} detail="of logged days within 10% of target" />
        <Tile label="Protein" pct={adherence.proteinTargetPct} detail="of logged days at 90% or more of target" />
        <Tile label="Steps" pct={adherence.stepTargetPct} detail="of days at 80% or more of target" />
      </div>
    </section>
  );
}

const ROWS: { key: keyof Omit<CorrelationsDto, "note">; label: string; meaning: (r: number) => string }[] = [
  { key: "caloriesVsWeightChange", label: "Calories and weight change", meaning: (r) => `Weeks with more calories tended to see ${r > 0 ? "more weight gain (or less loss)" : "less weight gain (or more loss)"}.` },
  { key: "proteinVsWeightChange", label: "Protein and weight change", meaning: (r) => `Weeks with more protein tended to see ${r > 0 ? "more weight gain (or less loss)" : "less weight gain (or more loss)"}.` },
  { key: "stepsVsWeightChange", label: "Steps and weight change", meaning: (r) => `Weeks with more steps tended to see ${r > 0 ? "more weight gain (or less loss)" : "less weight gain (or more loss)"}.` },
  { key: "sleepVsWeightChange", label: "Sleep and weight change", meaning: (r) => `Weeks with more sleep tended to see ${r > 0 ? "more weight gain (or less loss)" : "less weight gain (or more loss)"}.` },
  { key: "sessionsVsVolume", label: "Training days and volume", meaning: (r) => `Weeks with more training days tended to have ${r > 0 ? "more" : "less"} total volume.` },
];

export function CorrelationPanel({ c }: { c: CorrelationsDto }) {
  return (
    <section className="card space-y-3" aria-labelledby="corr-h">
      <h2 id="corr-h" className="text-sm font-semibold">How things move together</h2>
      <ul className="divide-y divide-border">
        {ROWS.map((r) => {
          const v = c[r.key];
          return (
            <li key={r.key} className="py-2 text-sm">
              <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-medium">{r.label}</span>
                <span className="text-muted">{corrLabel(v)}</span>
              </p>
              {v != null && Math.abs(v) >= 0.2 && <p className="text-xs text-muted">{r.meaning(v)}</p>}
            </li>
          );
        })}
      </ul>
      <Notice tone="info">{c.note}</Notice>
    </section>
  );
}

export function PrList({ prs, units }: { prs: PrDto[]; units: UnitSystem }) {
  return (
    <section className="card" aria-labelledby="pr-h">
      <h2 id="pr-h" className="flex items-center gap-2 text-sm font-semibold"><Trophy className="h-4 w-4 text-warn" aria-hidden /> Personal records</h2>
      {prs.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No records yet. Log a few sessions and every new best (by estimated 1RM) will be saved here.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {prs.map((p) => (
            <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-x-3 py-2 text-sm">
              <span className="font-medium">{localizeKg(p.title, units)}</span>
              <span className="tabular-nums text-muted">{p.data?.est1rm != null ? `est. 1RM ${fmtWeight(p.data.est1rm, units)} · ` : ""}{fmtDay(p.date)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
