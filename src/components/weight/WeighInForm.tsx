"use client";
import { Check, Scale } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { clsx, Field, haptic, Notice } from "@/components/ui";
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

/**
 * Weigh-in form, designed to live inside a bottom Sheet: one big number field, then date/time, then condition chips.
 * Saving on a date that already has one replaces it (the API upserts by day).
 */
export function WeighInForm({ units, onSaved }: { units: UnitSystem; onSaved: (w: WeighInSaved) => void }) {
  const [date, setDate] = useState(todayLocal);
  const [weight, setWeight] = useState("");
  const [time, setTime] = useState("");
  const [conds, setConds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "good" | "warn"; text: string } | null>(null);
  const unit = units === "IMPERIAL" ? "lb" : "kg";
  const weightRef = useRef<HTMLInputElement>(null);

  // The sheet focuses itself first; move focus to the weight field right after so the number pad opens.
  useEffect(() => {
    const t = window.setTimeout(() => weightRef.current?.focus(), 80);
    return () => window.clearTimeout(t);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const v = Number(weight.replace(",", "."));
    const kg = Math.round((units === "IMPERIAL" ? lbToKg(v) : v) * 100) / 100;
    if (!Number.isFinite(v) || v <= 0 || kg < 25 || kg > 400) {
      setMsg({ tone: "warn", text: `Enter a weight in ${unit} that looks right, for example ${units === "IMPERIAL" ? "186.5" : "84.5"}.` });
      haptic("warn");
      return;
    }
    const conditions = conds.length ? conds.join(", ").toLowerCase() : null;
    setBusy(true);
    try {
      const r = await logTool("log_weight", { date, weightKg: kg, ...(time ? { time } : {}), ...(conditions ? { conditions } : {}) });
      haptic("success");
      setWeight("");
      setConds([]);
      setMsg(r.queued ? { tone: "warn", text: "You're offline. Your weigh-in is queued and will sync when you're back online." } : { tone: "good", text: "Weigh-in saved. One day is a data point; the averages tell the story." });
      onSaved({ date, weightKg: kg, time: time || null, conditions, queued: r.queued });
    } catch (err) {
      setMsg({ tone: "warn", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-4" aria-label="Log a weigh-in">
      <div>
        <label className="label" htmlFor="wi-weight">Weight ({unit})</label>
        <div className="relative">
          <input
            ref={weightRef} id="wi-weight" inputMode="decimal" autoComplete="off"
            className="input display !min-h-[68px] !pr-14 text-center !text-[2.25rem] font-extrabold tracking-tight"
            value={weight} onChange={(e) => setWeight(e.target.value)} placeholder={units === "IMPERIAL" ? "186.5" : "84.5"}
          />
          <span aria-hidden className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted">{unit}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
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
                onClick={() => { haptic(); setConds((p) => (on ? p.filter((x) => x !== c) : [...p, c])); }}
                className={clsx("chip !min-h-[48px] !px-4", on && "!border-brand !bg-brand/10 text-brand")}
              >
                {on && <Check className="h-4 w-4" aria-hidden />}
                {c}
              </button>
            );
          })}
        </div>
      </fieldset>
      <button className="btn btn-primary w-full !min-h-[52px] text-base" disabled={busy || !weight.trim()}>
        <Scale className="h-5 w-5" aria-hidden /> {busy ? "Saving…" : "Save weigh-in"}
      </button>
      <div aria-live="polite">{msg && <Notice tone={msg.tone}>{msg.text}</Notice>}</div>
    </form>
  );
}
