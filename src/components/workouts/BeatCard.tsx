"use client";
import { Lightbulb, Target } from "lucide-react";
import { fmtDay, fmtNum, type UnitSystem } from "@/lib/client/format";
import type { ExerciseBriefDto } from "./types";
import { formatSets, localizeKg, toDisplay, unitLabel } from "./util";

/** Compact "beat this" card: what you did last time next to what today's set is aiming for, plus the tip and the why. */
export function BeatCard({ ex, target, units }: { ex: ExerciseBriefDto; target: number | undefined; units: UnitSystem }) {
  const w = ex.prescription.weightKg;
  return (
    <section aria-label="Beat this: previous performance and target" className="tile !p-4" style={{ background: "linear-gradient(150deg, rgb(var(--brand-a) / 0.12), transparent 70%), rgb(var(--surface))" }}>
      <p className="eyebrow flex items-center gap-1.5"><Target className="h-3.5 w-3.5" aria-hidden /> Beat this</p>
      <dl className="mt-2.5 grid grid-cols-2 gap-4">
        <div className="min-w-0">
          <dt className="text-xs text-muted">Last time{ex.previous ? ` · ${fmtDay(ex.previous.date, { day: "numeric", month: "short" })}` : ""}</dt>
          <dd className="mt-1 text-sm font-semibold leading-snug tabular-nums">{ex.previous ? formatSets(ex.previous.sets, units) : "No history yet"}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs text-muted">Today&apos;s target</dt>
          <dd className="mt-1">
            <span className="num text-[1.6rem]">{target ?? `${ex.repMin}–${ex.repMax}`}</span>
            <span className="ml-1 text-sm font-semibold"> reps</span>
            {w != null && <span className="block text-sm font-semibold tabular-nums">at {fmtNum(toDisplay(w, units), 1)} {unitLabel(units)}</span>}
          </dd>
        </div>
      </dl>
      {w == null && <p className="mt-2 text-xs text-muted">First time: pick a weight with 2–3 reps left in the tank.</p>}

      <details className="mt-3 text-sm">
        <summary className="flex min-h-[44px] cursor-pointer items-center text-muted hover:text-fg">Form tip and why this target</summary>
        {ex.technique && (
          <p className="flex gap-2"><Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden /><span><span className="font-medium">Tip:</span> {ex.technique}</span></p>
        )}
        <p className="mt-2 text-muted">{localizeKg(ex.prescription.text, units)} <span className="block pt-1 text-xs">{ex.prescription.reason}</span></p>
        {ex.progression && <p className="mt-1 text-xs text-muted">Progression rule: {ex.progression}</p>}
      </details>
    </section>
  );
}
