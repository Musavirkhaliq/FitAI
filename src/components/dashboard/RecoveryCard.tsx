"use client";
import { BedDouble } from "lucide-react";
import { AnimatedNumber, clsx, Ring } from "@/components/ui";
import { fmtDay, fmtNum } from "@/lib/client/format";
import type { DailyPointDto, TodayDto } from "@/lib/client/types";

/** Sleep ring, training/rest pips for the week, and the coach's recovery notes. Suggestions, never rules. */
export function RecoveryCard({ recovery, week, sleepTargetH }: { recovery: TodayDto["recovery"]; week: DailyPointDto[]; sleepTargetH: number | null }) {
  const trainedDay = (d: DailyPointDto) => d.trainingMin > 0 || d.volume > 0;
  return (
    <section className="card rise space-y-4" aria-labelledby="rec-h">
      <h2 id="rec-h" className="display text-lg font-extrabold">Recovery</h2>

      <div className="flex items-center gap-4">
        <Ring ratio={recovery.avgSleepH != null && sleepTargetH ? recovery.avgSleepH / sleepTargetH : 0} size={88} stroke={10} color="sleep">
          <BedDouble className="h-5 w-5 text-muted" aria-hidden />
        </Ring>
        <div className="min-w-0">
          <p className="eyebrow">Sleep average</p>
          <p className="num mt-1 text-[2rem]">
            {recovery.avgSleepH == null ? "—" : <><AnimatedNumber value={recovery.avgSleepH} format={(n) => fmtNum(n, 1)} fromZero /><span className="ml-1 text-sm font-medium text-muted">h</span></>}
          </p>
          <p className="mt-1 text-xs text-muted">
            {sleepTargetH ? `Target ${fmtNum(sleepTargetH, 1)} h. ` : ""}
            {recovery.sleepConsistencySdH == null ? "Consistency needs 3+ nights." : `Nightly hours vary by about ±${fmtNum(recovery.sleepConsistencySdH, 1)} h (lower is steadier).`}
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-surface-2 p-3.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="eyebrow">Training and rest, last 7 days</p>
          <p className="text-xs font-semibold tabular-nums text-muted">{recovery.trainingDays} trained · {recovery.restDays} rest</p>
        </div>
        <ul className="mt-2.5 grid grid-cols-7 gap-1.5" aria-label="Training days this week">
          {week.map((d) => {
            const on = trainedDay(d);
            return (
              <li key={d.date} className="flex flex-col items-center gap-1">
                <span className={clsx("h-6 w-full max-w-[2.25rem] rounded-lg", on ? "grad-brand" : "border border-border")} aria-hidden />
                <span className="text-[10px] font-medium text-muted" aria-hidden>{fmtDay(d.date, { weekday: "narrow" })}</span>
                <span className="sr-only">{fmtDay(d.date, { weekday: "long" })}: {on ? "trained" : "rest"}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-2.5 text-xs text-muted">Average steps: <span className="font-semibold text-fg">{recovery.avgSteps == null ? "—" : fmtNum(recovery.avgSteps)}</span></p>
      </div>

      {recovery.notes.length > 0 ? (
        <ul className="space-y-1.5 text-sm">
          {recovery.notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
      ) : (
        <p className="text-sm text-muted">Log your sleep and I&apos;ll add a recovery note here.</p>
      )}
      <p className="text-xs text-muted">These are suggestions, not rules. Rest days are part of training.</p>
    </section>
  );
}
