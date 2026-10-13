"use client";
import { CheckCircle2, Sparkles, Trophy } from "lucide-react";
import Link from "next/link";
import { AnimatedNumber, Tile } from "@/components/ui";
import { fmtNum, kgToLb, type UnitSystem } from "@/lib/client/format";
import { unitLabel } from "./util";

export interface Summary { sets: number; volume: number; minutes: number | null }

/** Finish screen: one calm hero number (total volume), two supporting tiles, any personal bests, and where to go next. */
export function SessionSummary({ summary, units, prNames }: { summary: Summary; units: UnitSystem; prNames: string[] }) {
  const vol = Math.round(units === "IMPERIAL" ? kgToLb(summary.volume) : summary.volume);
  return (
    <div className="mx-auto max-w-xl space-y-3">
      <header className="rise pt-2">
        <p className="eyebrow flex items-center gap-1.5 !text-good"><CheckCircle2 className="h-4 w-4" aria-hidden /> Workout complete</p>
        <h1 className="display mt-1 text-[1.9rem] font-extrabold leading-tight">That&apos;s a wrap. Nice work.</h1>
        <p className="mt-1 text-sm text-muted">Recovery is part of the plan. Eat well, sleep well, and your next session will be waiting.</p>
      </header>

      <section aria-label="Workout summary" className="space-y-3">
        <Tile index={1} className="!rounded-[2rem] !p-6" style={{ background: "linear-gradient(150deg, rgb(var(--brand-a) / 0.22), rgb(var(--brand-b) / 0.08) 60%, transparent), rgb(var(--surface))" }}>
          <p className="eyebrow">Total volume</p>
          <p className="num mt-2 text-[3.5rem]">
            <AnimatedNumber value={vol} fromZero />
            <span className="ml-1.5 text-xl font-medium text-muted">{unitLabel(units)}</span>
          </p>
          <p className="mt-2 text-sm text-muted">Weight × reps added up across every set.</p>
        </Tile>
        <dl className="grid grid-cols-2 gap-3">
          <Tile index={2}>
            <dt className="eyebrow">Sets</dt>
            <dd className="num mt-1.5 text-[2rem]"><AnimatedNumber value={summary.sets} fromZero /></dd>
          </Tile>
          <Tile index={3}>
            <dt className="eyebrow">Duration</dt>
            <dd className="num mt-1.5 text-[2rem]">{summary.minutes != null ? <>{fmtNum(summary.minutes)}<span className="ml-1 text-sm font-medium text-muted">min</span></> : "—"}</dd>
          </Tile>
        </dl>
        {prNames.length > 0 && (
          <Tile index={4} className="!border-brand/40 shadow-glow" style={{ background: "linear-gradient(150deg, rgb(var(--brand-a) / 0.16), transparent 70%), rgb(var(--surface))" }}>
            <p className="flex items-center gap-2 font-bold"><Trophy className="h-5 w-5 text-brand" aria-hidden /> {prNames.length === 1 ? "A new personal best" : `${prNames.length} new personal bests`}</p>
            <p className="mt-1 text-sm text-muted">{prNames.join(", ")}. Estimated 1RM, well earned.</p>
          </Tile>
        )}
      </section>

      <div className="rise space-y-2 pt-2" style={{ ["--i" as string]: 5 }}>
        <Link href="/workouts" className="btn btn-primary !min-h-[64px] w-full !rounded-2xl text-lg">Back to workouts</Link>
        <div className="grid grid-cols-2 gap-2">
          <Link href="/analytics" className="btn !min-h-[56px]">See your progress</Link>
          <Link href="/recap" className="btn !min-h-[56px]"><Sparkles className="h-4 w-4 text-brand" aria-hidden /> Your week</Link>
        </div>
      </div>
    </div>
  );
}
