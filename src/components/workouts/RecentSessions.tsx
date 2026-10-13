"use client";
import { Badge } from "@/components/ui";
import { fmtDay, fmtNum, fmtWeight, type UnitSystem } from "@/lib/client/format";
import type { SessionRowDto } from "./types";

const STATUS_TONE = { COMPLETED: "good", IN_PROGRESS: "brand", SKIPPED: "neutral" } as const;
const STATUS_TEXT = { COMPLETED: "Completed", IN_PROGRESS: "In progress", SKIPPED: "Skipped" } as const;

export function RecentSessions({ sessions, units }: { sessions: SessionRowDto[]; units: UnitSystem }) {
  const rows = sessions.filter((s) => s.status !== "SKIPPED" || s.sets.length > 0).slice(0, 10);
  return (
    <section className="card rise" aria-labelledby="recent-h">
      <h2 id="recent-h" className="display text-lg font-extrabold">Recent sessions</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No sessions yet. Your first one will appear here.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {rows.map((s) => {
            const volume = s.sets.reduce((t, x) => t + x.volume, 0);
            return (
              <li key={s.id} className="flex items-center gap-3 py-3">
                <span aria-hidden className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-surface-2 leading-none">
                  <span className="num text-lg">{fmtDay(s.date, { day: "numeric" })}</span>
                  <span className="mt-0.5 text-[10px] font-semibold uppercase text-muted">{fmtDay(s.date, { month: "short" })}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-semibold">{s.day?.name ?? "Workout"}</span>
                    <Badge tone={STATUS_TONE[s.status]}>{STATUS_TEXT[s.status]}</Badge>
                  </p>
                  <p className="text-sm tabular-nums text-muted">
                    <span className="sr-only">{fmtDay(s.date)}. </span>
                    {s.sets.length} sets · {fmtWeight(volume, units, 0)} total · {s.durationMin != null ? `${fmtNum(s.durationMin)} min` : "—"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
