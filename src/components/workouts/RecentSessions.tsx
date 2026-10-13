"use client";
import { Badge } from "@/components/ui";
import { fmtDay, fmtNum, fmtWeight, type UnitSystem } from "@/lib/client/format";
import type { SessionRowDto } from "./types";

const STATUS_TONE = { COMPLETED: "good", IN_PROGRESS: "brand", SKIPPED: "neutral" } as const;
const STATUS_TEXT = { COMPLETED: "Completed", IN_PROGRESS: "In progress", SKIPPED: "Skipped" } as const;

export function RecentSessions({ sessions, units }: { sessions: SessionRowDto[]; units: UnitSystem }) {
  const rows = sessions.filter((s) => s.status !== "SKIPPED" || s.sets.length > 0).slice(0, 10);
  return (
    <section className="card" aria-labelledby="recent-h">
      <h2 id="recent-h" className="text-sm font-semibold">Recent sessions</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No sessions yet. Your first one will appear here.</p>
      ) : (
        <ul className="mt-2 divide-y divide-border">
          {rows.map((s) => {
            const volume = s.sets.reduce((t, x) => t + x.volume, 0);
            return (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-3">
                <div>
                  <p className="font-medium">{s.day?.name ?? "Workout"}</p>
                  <p className="text-sm text-muted">{fmtDay(s.date)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm tabular-nums text-muted">
                  <span>{s.sets.length} sets</span>
                  <span>{fmtWeight(volume, units, 0)} total</span>
                  <span>{s.durationMin != null ? `${fmtNum(s.durationMin)} min` : "—"}</span>
                  <Badge tone={STATUS_TONE[s.status]}>{STATUS_TEXT[s.status]}</Badge>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
