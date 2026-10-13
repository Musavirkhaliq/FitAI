"use client";
import { Trophy } from "lucide-react";
import { Notice, Ring, clsx, type RingColor } from "@/components/ui";
import { fmtDay, fmtWeight, type UnitSystem } from "@/lib/client/format";
import type { PrDto } from "@/components/workouts/types";
import { localizeKg } from "@/components/workouts/util";
import type { AnalyticsDto, CorrelationsDto } from "./types";

function AdherenceTile({ label, pct, detail, color, index }: { label: string; pct: number | null; detail: string; color: RingColor; index: number }) {
  const aria = pct == null ? `${label}: no estimate yet` : `${label}: ${pct} percent, estimated adherence. ${detail}`;
  return (
    <div className="tile rise flex flex-col items-center text-center" role="group" aria-label={aria} style={{ ["--i" as string]: index }}>
      <Ring ratio={pct == null ? 0 : pct / 100} size={88} stroke={9} color={color}>
        <span className="num text-[1.35rem]" aria-hidden>{pct == null ? "—" : <>{pct}<span className="text-xs font-semibold text-muted">%</span></>}</span>
      </Ring>
      <p className="eyebrow mt-3">{label}</p>
      <p className="mt-1 text-xs leading-snug text-muted">{pct == null ? "Needs a goal (Settings) and some logged days." : detail}</p>
    </div>
  );
}

export function AdherenceTiles({ adherence }: { adherence: AnalyticsDto["adherence"] }) {
  return (
    <section aria-labelledby="adh-h" className="space-y-3">
      <div className="rise">
        <h2 id="adh-h" className="display text-xl font-extrabold">Estimated adherence</h2>
        <p className="text-sm text-muted">Rough guides to how consistent you&apos;ve been. Missed days happen; progress comes from the overall pattern.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <AdherenceTile index={1} label="Logging" pct={adherence.loggingPct} detail="of days with food logged" color="brand" />
        <AdherenceTile index={2} label="Calories" pct={adherence.calorieTargetPct} detail="of logged days within 10% of target" color="cal" />
        <AdherenceTile index={3} label="Protein" pct={adherence.proteinTargetPct} detail="of logged days at 90% or more of target" color="protein" />
        <AdherenceTile index={4} label="Steps" pct={adherence.stepTargetPct} detail="of days at 80% or more of target" color="steps" />
      </div>
    </section>
  );
}

const WEEKS_MORE = (r: number) => (r > 0 ? "weight to rise a little more (or fall a little less)" : "weight to fall a little more (or rise a little less)");
const ROWS: { key: keyof Omit<CorrelationsDto, "note">; label: string; meaning: (r: number) => string }[] = [
  { key: "caloriesVsWeightChange", label: "Calories and weight", meaning: (r) => `In weeks you ate more, I tended to see your ${WEEKS_MORE(r)}.` },
  { key: "proteinVsWeightChange", label: "Protein and weight", meaning: (r) => `In weeks with more protein, I tended to see your ${WEEKS_MORE(r)}.` },
  { key: "stepsVsWeightChange", label: "Steps and weight", meaning: (r) => `In weeks you walked more, I tended to see your ${WEEKS_MORE(r)}.` },
  { key: "sleepVsWeightChange", label: "Sleep and weight", meaning: (r) => `In weeks you slept more, I tended to see your ${WEEKS_MORE(r)}.` },
  { key: "sessionsVsVolume", label: "Training days and volume", meaning: (r) => `Weeks with more training days tended to have ${r > 0 ? "more" : "less"} total volume.` },
];

/** 0 = nothing clear, 1 = weak, 2 = moderate, 3 = strong. */
const level = (r: number | null) => (r == null ? 0 : Math.abs(r) < 0.2 ? 0 : Math.abs(r) < 0.4 ? 1 : Math.abs(r) < 0.6 ? 2 : 3);
const LEVEL_TEXT = ["No clear pattern", "A weak pattern", "A moderate pattern", "A strong pattern"];

export function CorrelationPanel({ c }: { c: CorrelationsDto }) {
  return (
    <section className="card rise space-y-3" aria-labelledby="corr-h">
      <div>
        <h2 id="corr-h" className="display text-lg font-extrabold">How things move together</h2>
        <p className="text-sm text-muted">Patterns in your own weeks. They are hints, not proof that one thing causes another.</p>
      </div>
      <ul className="divide-y divide-border">
        {ROWS.map((r) => {
          const v = c[r.key];
          const lv = level(v);
          return (
            <li key={r.key} className="py-3 text-sm">
              <p className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span className="font-semibold">{r.label}</span>
                <span className="flex items-center gap-2 text-xs text-muted">
                  <span aria-hidden className="flex gap-1">
                    {[1, 2, 3].map((n) => <span key={n} className={clsx("h-1.5 w-4 rounded-full", n <= lv ? "bg-fg/70" : "bg-surface-3")} />)}
                  </span>
                  {v == null ? "Not enough data yet" : LEVEL_TEXT[lv]}
                  {v != null && <span className="sr-only"> (r = {v.toFixed(2)})</span>}
                </span>
              </p>
              {v != null && lv > 0 && <p className="mt-1 text-muted">{r.meaning(v)}</p>}
            </li>
          );
        })}
      </ul>
      <Notice tone="info">{c.note} A link between two things is not the same as one causing the other.</Notice>
    </section>
  );
}

export function PrList({ prs, units }: { prs: PrDto[]; units: UnitSystem }) {
  return (
    <section className="card rise" aria-labelledby="pr-h">
      <h2 id="pr-h" className="display flex items-center gap-2 text-lg font-extrabold"><Trophy className="h-5 w-5 text-brand" aria-hidden /> Personal records</h2>
      {prs.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No records yet. Log a few sessions and every new best (by estimated 1RM) will be saved here.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {prs.map((p) => (
            <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-3 text-sm">
              <span className="font-semibold">{localizeKg(p.title, units)}</span>
              <span className="tabular-nums text-muted">{p.data?.est1rm != null ? `est. 1RM ${fmtWeight(p.data.est1rm, units)} · ` : ""}{fmtDay(p.date)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
