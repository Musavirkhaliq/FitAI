"use client";
import { Droplets, Footprints, Moon, Scale } from "lucide-react";
import { useState } from "react";
import { Field, Notice } from "@/components/ui";
import { logTool } from "@/lib/client/api";
import { lbToKg, type UnitSystem } from "@/lib/client/format";

/**
 * Fast, form-light logging for the four things that are quickest to type: weigh-in, water, steps, sleep.
 * Goes through the same validated tool endpoint as the AI; offline writes are queued (optimistic UI).
 */
export function QuickLog({ date, units, onLogged }: { date: string; units: UnitSystem; onLogged?: (kind: string, value: number) => void }) {
  const [weight, setWeight] = useState("");
  const [steps, setSteps] = useState("");
  const [sleep, setSleep] = useState("");
  const [msg, setMsg] = useState<{ tone: "good" | "warn"; text: string } | null>(null);

  const run = async (fn: () => Promise<{ queued: boolean }>, ok: string, after: () => void) => {
    setMsg(null);
    try {
      const r = await fn();
      after();
      setMsg(r.queued ? { tone: "warn", text: "I couldn't save that. Your entry is queued and will sync when you're back online." } : { tone: "good", text: ok });
    } catch (e) {
      setMsg({ tone: "warn", text: (e as Error).message });
    }
  };

  const num = (s: string) => Number(s.replace(",", "."));

  return (
    <section className="card space-y-3" aria-labelledby="quick-h">
      <h2 id="quick-h" className="text-sm font-semibold">Quick log</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = num(weight);
            if (!v) return;
            const kg = units === "IMPERIAL" ? lbToKg(v) : v;
            void run(() => logTool("log_weight", { date, weightKg: Math.round(kg * 10) / 10 }), "Weigh-in saved.", () => { setWeight(""); onLogged?.("weight", kg); });
          }}
        >
          <Field label={`Morning weight (${units === "IMPERIAL" ? "lb" : "kg"})`} htmlFor="q-weight">
            <input id="q-weight" inputMode="decimal" className="input" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder={units === "IMPERIAL" ? "186.5" : "84.5"} />
          </Field>
          <button className="btn btn-primary shrink-0" aria-label="Save weight"><Scale className="h-4 w-4" aria-hidden /> Save</button>
        </form>

        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = Math.round(num(steps));
            if (!v) return;
            void run(() => logTool("log_activity", { date, type: "STEPS", steps: v }), "Steps saved.", () => { setSteps(""); onLogged?.("steps", v); });
          }}
        >
          <Field label="Steps today" htmlFor="q-steps">
            <input id="q-steps" inputMode="numeric" className="input" value={steps} onChange={(e) => setSteps(e.target.value)} placeholder="9500" />
          </Field>
          <button className="btn shrink-0" aria-label="Save steps"><Footprints className="h-4 w-4" aria-hidden /> Save</button>
        </form>

        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = num(sleep);
            if (!v) return;
            void run(() => logTool("log_sleep", { date, hours: v }), "Sleep saved.", () => { setSleep(""); onLogged?.("sleep", v); });
          }}
        >
          <Field label="Last night's sleep (hours)" htmlFor="q-sleep">
            <input id="q-sleep" inputMode="decimal" className="input" value={sleep} onChange={(e) => setSleep(e.target.value)} placeholder="7.5" />
          </Field>
          <button className="btn shrink-0" aria-label="Save sleep"><Moon className="h-4 w-4" aria-hidden /> Save</button>
        </form>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <p className="label">Water</p>
            <div className="flex gap-2">
              {[250, 500].map((ml) => (
                <button key={ml} className="btn flex-1" onClick={() => void run(() => logTool("log_water", { date, ml }), `+${ml} ml water.`, () => onLogged?.("water", ml))}>
                  <Droplets className="h-4 w-4" aria-hidden /> +{ml} ml
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <p className="text-xs text-muted">Weigh-in tip: after waking and the bathroom, before food or drink, same scale, similar clothing.</p>
    </section>
  );
}
