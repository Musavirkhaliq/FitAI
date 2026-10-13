"use client";
import { Flame } from "lucide-react";
import { clsx } from "@/components/ui";
import type { DailyPointDto } from "@/lib/client/types";
import { bestRun, currentRun, STREAK_HABITS, trained, type StreakTargets } from "./streaks";

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** 28-day strip: filled = met, outline = not recorded. Shape (not colour) carries the meaning; sr-only text gives the same facts. */
function DotStrip({ days, pass, label }: { days: DailyPointDto[]; pass: (d: DailyPointDto) => boolean; label: string }) {
  const last = days.slice(-28);
  const met = last.filter(pass).length;
  return (
    <>
      <div aria-hidden className="mt-2.5 flex w-full gap-[3px]">
        {last.map((d) => (
          <span key={d.date} className={clsx("h-3.5 min-w-0 flex-1 rounded-[4px] border", pass(d) ? "grad-brand border-transparent" : "border-border bg-transparent")} />
        ))}
      </div>
      <span className="sr-only">{label}: met on {met} of the last {last.length} days.</span>
    </>
  );
}

function Run({ n, best, unit = "day" }: { n: number; best: number; unit?: string }) {
  return (
    <>
      <p className="num text-[1.5rem]">
        {n > 0 ? plural(n, unit) : <span className="display text-base font-semibold tracking-normal">Start any day. It counts.</span>}
      </p>
      <p className="mt-1 text-xs text-muted">
        {best > 0 ? `Best run in the last 90 days: ${plural(best, unit)}` : "Your best run will show up here."}
      </p>
    </>
  );
}

/**
 * Forgiving streaks: one missed day inside a run is forgiven, so runs bounce back instead of resetting to zero.
 * Neutral/brand styling only. Training is shown as sessions this week because the plan's weekly schedule isn't known here.
 */
export function StreaksCard({ days, today, targets, plannedPerWeek }: {
  days: DailyPointDto[];
  today: string;
  targets: StreakTargets | null;
  plannedPerWeek: number | null;
}) {
  const asc = [...days].filter((d) => d.date <= today).sort((a, b) => (a.date < b.date ? -1 : 1));
  const week = asc.slice(-7);
  const sessions = week.filter(trained).length;

  return (
    <section className="card rise space-y-4" aria-labelledby="streaks-h">
      <div>
        <h2 id="streaks-h" className="display flex items-center gap-2 text-lg font-extrabold">
          <Flame className="h-5 w-5 text-muted" aria-hidden /> Streaks
        </h2>
        <p className="mt-1 text-sm text-muted">One missed day is forgiven. Streaks bounce back, they don&apos;t reset to zero.</p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {STREAK_HABITS.map((h) => {
          const unavailable = h.needsTarget && !targets;
          const pass = (d: DailyPointDto) => h.pass(d, targets);
          return (
            <li key={h.key} className="rounded-2xl bg-surface-2 p-3.5">
              <p className="eyebrow">{h.label}</p>
              {unavailable ? (
                <p className="mt-1.5 text-sm text-muted">Set a goal in Settings to see this one.</p>
              ) : (
                <div className="mt-1.5">
                  <Run n={currentRun(asc, today, pass)} best={bestRun(asc, today, pass)} />
                  <DotStrip days={asc} pass={pass} label={`${h.label}, last 28 days`} />
                </div>
              )}
            </li>
          );
        })}

        <li className="rounded-2xl bg-surface-2 p-3.5">
          <p className="eyebrow">Training</p>
          <div className="mt-1.5">
            <p className="num text-[1.5rem]">
              {sessions > 0 ? plural(sessions, "session") : <span className="display text-base font-semibold tracking-normal">No sessions yet this week</span>}
              <span className="ml-1.5 text-sm font-normal tracking-normal text-muted">in the last 7 days</span>
            </p>
            <p className="mt-1 text-xs text-muted">
              {plannedPerWeek ? `Your plan has ${plannedPerWeek} sessions a week. Rest days are part of it.` : "Rest days are part of training too."}
            </p>
            <DotStrip days={asc} pass={trained} label="Training sessions, last 28 days" />
          </div>
        </li>
      </ul>

      <p className="text-xs text-muted">Counts days the habit was met. Today is added once it&apos;s met and never counts against you while unfinished. Filled squares are days met; outlines are days not recorded.</p>
    </section>
  );
}
