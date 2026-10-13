"use client";
import { Scale } from "lucide-react";
import { useState, type FormEvent } from "react";
import { clsx, Field, Notice } from "@/components/ui";
import { logTool } from "@/lib/client/api";
import { lbToKg, todayLocal, type UnitSystem } from "@/lib/client/format";

const CONDITIONS = ["Fasted", "After bathroom", "Same scale", "Light clothing"];

export interface WeighInSaved {
  date: string;
  weightKg: number;
  time: string | null;
  conditions: string | null;
  queued: boolean;
}

/** Weigh-in form. Saving on a date that already has one replaces it (the API upserts by day). */
export function WeighInForm({ units, onSaved }: { units: UnitSystem; onSaved: (w: WeighInSaved) => void }) {
  const [date, setDate] = useState(todayLocal);
  const [weight, setWeight] = useState("");
  const [time, setTime] = useState("");
  const [conds, setConds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "good" | "warn"; text: string } | null>(null);
  const unit = units === "IMPERIAL" ? "lb" : "kg";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const v = Number(weight.replace(",", "."));
    const kg = Math.round((units === "IMPERIAL" ? lbToKg(v) : v) * 100) / 100;
    if (!Number.isFinite(v) || v <= 0 || kg < 25 || kg > 400) {
      setMsg({ tone: "warn", text: `Enter a weight in ${unit} that looks right, for example ${units === "IMPERIAL" ? "186.5" : "84.5"}.` });
      return;
    }
    const conditions = conds.length ? conds.join(", ").toLowerCase() : null;
    setBusy(true);
    try {
      const r = await logTool("log_weight", { date, weightKg: kg, ...(time ? { time } : {}), ...(conditions ? { conditions } : {}) });
      onSaved({ date, weightKg: kg, time: time || null, conditions, queued: r.queued });
      setWeight("");
      setConds([]);
      setMsg(r.queued ? { tone: "warn", text: "You're offline. Your weigh-in is queued and will sync when you're back online." } : { tone: "good", text: "Weigh-in saved. One day is a data point; the averages tell the story." });
    } catch (err) {
      setMsg({ tone: "warn", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="card space-y-3" aria-labelledby="wi-h">
      <h2 id="wi-h" className="text-sm font-semibold">Log a weigh-in</h2>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Weight (${unit})`} htmlFor="wi-weight">
          <input id="wi-weight" inputMode="decimal" className="input" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder={units === "IMPERIAL" ? "186.5" : "84.5"} autoComplete="off" />
        </Field>
        <Field label="Date" htmlFor="wi-date">
          <input id="wi-date" type="date" className="input" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Time (optional)" htmlFor="wi-time">
          <input id="wi-time" type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>
      <fieldset>
        <legend className="label">Conditions (optional)</legend>
        <div className="flex flex-wrap gap-2">
          {CONDITIONS.map((c) => {
            const on = conds.includes(c);
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                onClick={() => setConds((p) => (on ? p.filter((x) => x !== c) : [...p, c]))}
                className={clsx("min-h-[44px] rounded-full border px-4 text-sm font-medium transition-colors", on ? "border-brand bg-brand/15 text-brand" : "border-border bg-surface hover:bg-surface-2")}
              >
                {on ? "✓ " : ""}{c}
              </button>
            );
          })}
        </div>
      </fieldset>
      <button className="btn btn-primary w-full sm:w-auto" disabled={busy || !weight.trim()}>
        <Scale className="h-4 w-4" aria-hidden /> {busy ? "Saving…" : "Save weigh-in"}
      </button>
      <div aria-live="polite">{msg && <Notice tone={msg.tone}>{msg.text}</Notice>}</div>
    </form>
  );
}
