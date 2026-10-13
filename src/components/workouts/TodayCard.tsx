"use client";
import { CheckCircle2, Dumbbell, Play } from "lucide-react";
import Link from "next/link";
import { Badge, Notice } from "@/components/ui";
import { fmtDay, type UnitSystem } from "@/lib/client/format";
import type { TodayWorkoutDto } from "./types";
import { localizeKg } from "./util";

/** "Today" card: the next day in the rotation with the progression engine's prescription per exercise. */
export function TodayCard({ today, units }: { today: TodayWorkoutDto; units: UnitSystem }) {
  const { day, exercises } = today;
  return (
    <section className="card space-y-4" aria-labelledby="today-wk-h">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand"><Dumbbell className="h-6 w-6" aria-hidden /></span>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Today · {today.plan.name}</p>
            <h2 id="today-wk-h" className="text-xl font-semibold leading-tight">{day.name}</h2>
            <p className="text-sm text-muted">{day.focus}{today.lastSessionDate ? ` · last session ${fmtDay(today.lastSessionDate)}` : ""}</p>
          </div>
        </div>
        {today.completedToday ? (
          <Badge tone="good" className="!px-3 !py-1.5 !text-sm"><CheckCircle2 className="mr-1.5 h-4 w-4" aria-hidden /> Done today</Badge>
        ) : (
          <Link href="/workouts/session" className="btn btn-primary !min-h-[52px] px-6 text-base">
            <Play className="h-5 w-5" aria-hidden /> {today.inProgress ? "Continue workout" : "Start workout"}
          </Link>
        )}
      </div>

      {today.completedToday && (
        <Notice tone="good">Nice work, today&apos;s session is logged. Rest, eat well and your next session will be ready when you are.</Notice>
      )}
      {today.deloadSuggested && !today.completedToday && (
        <Notice tone="info">
          <strong>Deload suggested.</strong> Your recent efforts have been very high, so some lifts are prescribed lighter today. Easy weeks help you come back stronger.
        </Notice>
      )}

      <ol className="divide-y divide-border">
        {exercises.map((e) => (
          <li key={e.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="font-medium">{e.name}</p>
              <p className="text-sm tabular-nums text-muted">{e.sets} × {e.repMin}–{e.repMax} · rest {e.restSec}s · RPE {e.targetRpe}</p>
            </div>
            <p className="mt-0.5 text-sm text-muted">{localizeKg(e.prescription.text, units)}</p>
            {e.prescription.deload && <Badge tone="warn" className="mt-1">Deload</Badge>}
          </li>
        ))}
      </ol>
    </section>
  );
}
