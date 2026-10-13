"use client";
import { CheckCircle2, Dumbbell, Play } from "lucide-react";
import Link from "next/link";
import { Badge, Notice, haptic } from "@/components/ui";
import { fmtDay, type UnitSystem } from "@/lib/client/format";
import type { TodayWorkoutDto } from "./types";
import { MUSCLE_LABEL, localizeKg, muscleDot } from "./util";

/** Today's workout as the hero of the page: the next day in the rotation, each lift with the progression engine's prescription. */
export function TodayCard({ today, units }: { today: TodayWorkoutDto; units: UnitSystem }) {
  const { day, exercises } = today;
  const totalSets = exercises.reduce((t, e) => t + e.sets, 0);
  return (
    <section
      aria-labelledby="today-wk-h"
      className="tile rise !rounded-[2rem] !p-5"
      style={{ background: "linear-gradient(150deg, rgb(var(--brand-a) / 0.22), rgb(var(--brand-b) / 0.08) 55%, transparent), rgb(var(--surface))" }}
    >
      <Dumbbell aria-hidden className="pointer-events-none absolute -right-4 -top-3 h-32 w-32 rotate-12 text-brand opacity-[0.07]" strokeWidth={1.25} />

      <p className="eyebrow">{today.completedToday ? "Done today" : "Today"} · {today.plan.name}</p>
      <h2 id="today-wk-h" className="display mt-1.5 text-[2rem] font-extrabold leading-[1.1]">{day.name}</h2>
      <p className="mt-1 text-sm text-muted">{day.focus}{today.lastSessionDate ? ` · last session ${fmtDay(today.lastSessionDate)}` : ""}</p>
      <p className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full bg-surface/70 px-3 py-1.5 ring-1 ring-border">{exercises.length} exercises</span>
        <span className="rounded-full bg-surface/70 px-3 py-1.5 ring-1 ring-border">{totalSets} working sets</span>
      </p>

      {today.completedToday && (
        <div className="mt-4"><Notice tone="good">Nice work, today&apos;s session is logged. Rest, eat well and your next session will be ready when you are.</Notice></div>
      )}
      {today.deloadSuggested && !today.completedToday && (
        <div className="mt-4">
          <Notice tone="info">
            <strong>Deload suggested.</strong> Your recent efforts have been very high, so some lifts are prescribed lighter today. Easy weeks help you come back stronger.
          </Notice>
        </div>
      )}

      <ol className="mt-4 divide-y divide-border/70" aria-label="Today's exercises">
        {exercises.map((e) => (
          <li key={e.id} className="flex items-start gap-3 py-3 first:pt-1">
            <span aria-hidden className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: muscleDot(e.muscleGroup) }} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="font-semibold leading-snug">{e.name}</p>
                <p className="text-sm font-semibold tabular-nums">{e.sets} × {e.repMin}–{e.repMax}</p>
              </div>
              <p className="text-xs text-muted">{MUSCLE_LABEL(e.muscleGroup)} · rest {e.restSec}s · RPE {e.targetRpe}</p>
              <p className="mt-0.5 text-sm text-muted">{localizeKg(e.prescription.text, units)}</p>
              {e.prescription.deload && <Badge tone="warn" className="mt-1">Deload</Badge>}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-5">
        {today.completedToday ? (
          <Badge tone="good" className="!px-3.5 !py-2 !text-sm"><CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden /> Done today</Badge>
        ) : (
          <Link href="/workouts/session" onClick={() => haptic()} className="btn btn-primary !min-h-[64px] w-full !rounded-2xl text-lg">
            <Play className="h-5 w-5" aria-hidden /> {today.inProgress ? "Continue workout" : "Start workout"}
          </Link>
        )}
      </div>
    </section>
  );
}
