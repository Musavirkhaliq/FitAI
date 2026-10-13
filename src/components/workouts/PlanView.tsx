"use client";
import { ChevronDown, Repeat } from "lucide-react";
import { useState } from "react";
import { Badge, clsx } from "@/components/ui";
import { ApiError, post } from "@/lib/client/api";
import type { PlanDto } from "./types";

/** The whole plan: expandable day cards, each exercise with its prescription, technique and progression rule. */
export function PlanView({ plan, todayDayId, onChanged }: { plan: PlanDto; todayDayId?: string; onChanged: () => void }) {
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
      <div>
        <h2 id="plan-h" className="text-lg font-semibold">{plan.name}</h2>
        <p className="text-sm text-muted">{plan.daysPerWeek} days per week · tap a day to see its exercises</p>
      </div>
      {plan.days.map((d) => {
        const isOpen = !!open[d.id];
        const panelId = `plan-day-${d.id}`;
        return (
          <div key={d.id} className="card !p-0">
            <button
              className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-xl2 px-4 py-3 text-left hover:bg-surface-2"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpen((o) => ({ ...o, [d.id]: !o[d.id] }))}
            >
              <span>
                <span className="block font-semibold">{d.name}{d.id === todayDayId && <Badge tone="brand" className="ml-2 align-middle">Up next</Badge>}</span>
                <span className="block text-sm text-muted">{d.focus} · {d.exercises.length} exercises</span>
              </span>
              <ChevronDown className={clsx("h-5 w-5 shrink-0 text-muted transition-transform", isOpen && "rotate-180")} aria-hidden />
            </button>
            {isOpen && (
              <ul id={panelId} className="divide-y divide-border border-t border-border px-4">
                {d.exercises.map((e) => (
                  <li key={e.id} className="space-y-1 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{e.name}</p>
                        <p className="text-xs capitalize text-muted">{e.muscleGroup}</p>
                      </div>
                      <button className="btn" disabled={busy === e.id} onClick={() => void swap(e.id)} aria-label={`Swap ${e.name} for an alternative`}>
                        <Repeat className="h-4 w-4" aria-hidden /> {busy === e.id ? "Swapping…" : "Swap"}
                      </button>
                    </div>
                    <p className="text-sm tabular-nums">{e.sets} sets × {e.repMin}–{e.repMax} reps · rest {e.restSec}s · target RPE {e.targetRpe}</p>
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
