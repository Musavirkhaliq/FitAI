"use client";
import { ChevronDown, Repeat } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Badge, clsx, haptic } from "@/components/ui";
import { ApiError, post } from "@/lib/client/api";
import type { PlanDto } from "./types";
import { MUSCLE_LABEL, muscleDot } from "./util";

/** The whole plan: expandable day cards, each exercise with its prescription, technique and progression rule. */
export function PlanView({ plan, todayDayId, onChanged, action }: { plan: PlanDto; todayDayId?: string; onChanged: () => void; action?: ReactNode }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Record<string, string>>({});

  const swap = async (exerciseId: string) => {
    setBusy(exerciseId);
    setMsg((m) => ({ ...m, [exerciseId]: "" }));
    try {
      await post("/api/workouts", { action: "swap", exerciseId });
      onChanged();
    } catch (e) {
      const text = e instanceof ApiError ? e.message : "I couldn't swap that. Check your connection and try again.";
      setMsg((m) => ({ ...m, [exerciseId]: text }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-labelledby="plan-h" className="space-y-3">
      <div className="rise flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="plan-h" className="display text-xl font-extrabold">{plan.name}</h2>
          <p className="text-sm text-muted">{plan.daysPerWeek} days per week · tap a day to see its exercises</p>
        </div>
        {action}
      </div>
      {plan.days.map((d, di) => {
        const isOpen = !!open[d.id];
        const panelId = `plan-day-${d.id}`;
        const isNext = d.id === todayDayId;
        return (
          <div key={d.id} className={clsx("card rise !p-0 overflow-hidden", isNext && "!border-brand/40")} style={{ ["--i" as string]: Math.min(di, 7) }}>
            <button
              type="button"
              className="press flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => { haptic(); setOpen((o) => ({ ...o, [d.id]: !o[d.id] })); }}
            >
              <span aria-hidden className={clsx("num flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg", isNext ? "btn-primary" : "bg-surface-2 text-muted")}>{di + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="display font-bold leading-tight">{d.name}</span>
                  {isNext && <Badge tone="brand">Up next</Badge>}
                </span>
                <span className="block text-sm text-muted">{d.focus} · {d.exercises.length} exercises</span>
              </span>
              <ChevronDown className={clsx("h-5 w-5 shrink-0 text-muted transition-transform duration-300", isOpen && "rotate-180")} aria-hidden />
            </button>
            {isOpen && (
              <ul id={panelId} className="divide-y divide-border border-t border-border px-4">
                {d.exercises.map((e) => (
                  <li key={e.id} className="space-y-1.5 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2.5">
                        <span aria-hidden className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: muscleDot(e.muscleGroup) }} />
                        <div className="min-w-0">
                          <p className="font-semibold leading-snug">{e.name}</p>
                          <p className="text-xs text-muted">{MUSCLE_LABEL(e.muscleGroup)}</p>
                        </div>
                      </div>
                      <button type="button" className="btn shrink-0" disabled={busy === e.id} onClick={() => void swap(e.id)} aria-label={`Swap ${e.name} for an alternative`}>
                        <Repeat className="h-4 w-4" aria-hidden /> {busy === e.id ? "Swapping…" : "Swap"}
                      </button>
                    </div>
                    <p className="text-sm font-medium tabular-nums">{e.sets} sets × {e.repMin}–{e.repMax} reps · rest {e.restSec}s · target RPE {e.targetRpe}</p>
                    {e.technique && <p className="text-sm text-muted"><span className="font-medium text-fg">Technique:</span> {e.technique}</p>}
                    {e.progression && <p className="text-sm text-muted"><span className="font-medium text-fg">Progression:</span> {e.progression}</p>}
                    {msg[e.id] && <p role="alert" className="text-sm text-warn">{msg[e.id]}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </section>
  );
}
