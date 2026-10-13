"use client";
import { ArrowRight, Droplets, Footprints, Moon, Scale, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { clsx, colorVar, Notice, haptic, type RingColor } from "@/components/ui";
import { logTool } from "@/lib/client/api";
import { lbToKg, type UnitSystem } from "@/lib/client/format";

type Kind = "weight" | "steps" | "sleep" | "water";

/** Check mark that draws itself (reduced motion shows it instantly via the global override). */
function DrawnCheck() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 13l4 4L19 7" strokeDasharray={24} className="animate-check-draw" />
    </svg>
  );
}

/** One quick-log cell: coloured icon + label on top, control below. Its border turns green briefly after a save. */
function LogTile({ saved, icon: Icon, color, label, htmlFor, children }: { saved: boolean; icon: LucideIcon; color: RingColor; label: string; htmlFor?: string; children: ReactNode }) {
  const head = (
    <>
      <Icon className="mt-px h-4 w-4 shrink-0" style={{ color: colorVar(color) }} aria-hidden />
      <span>{label}</span>
    </>
  );
  const cls = "mb-2 flex min-h-[2rem] items-start gap-1.5 text-xs font-semibold leading-4 text-muted";
  return (
    <div className={clsx("rounded-2xl border bg-surface-2 p-3 transition-colors duration-500", saved ? "border-good/60" : "border-transparent")}>
      {htmlFor ? <label htmlFor={htmlFor} className={cls}>{head}</label> : <p className={cls}>{head}</p>}
      {children}
    </div>
  );
}

/** 48 px input with its save button inside the right edge (a full 48 px touch target). */
function SaveInput({ id, inputMode, placeholder, value, onChange, saveLabel, saved }: {
  id: string; inputMode: "decimal" | "numeric"; placeholder: string; value: string; onChange: (v: string) => void; saveLabel: string; saved: boolean;
}) {
  return (
    <div className="relative">
      <input id={id} inputMode={inputMode} className="input !bg-surface pr-12" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      <button className={clsx("press absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-2xl transition-colors", saved ? "text-good" : "text-brand")} aria-label={saveLabel}>
        {saved ? <DrawnCheck /> : <ArrowRight className="h-5 w-5" aria-hidden />}
      </button>
    </div>
  );
}

/**
 * Fast, form-light logging for the four things that are quickest to type: weigh-in, water, steps, sleep.
 * Goes through the same validated tool endpoint as the AI; offline writes are queued (optimistic UI).
 */
export function QuickLog({ date, units, onLogged }: { date: string; units: UnitSystem; onLogged?: (kind: string, value: number) => void }) {
  const [weight, setWeight] = useState("");
  const [steps, setSteps] = useState("");
  const [sleep, setSleep] = useState("");
  const [msg, setMsg] = useState<{ tone: "good" | "warn"; text: string } | null>(null);
  const [done, setDone] = useState<Kind | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const flash = (k: Kind) => {
    setDone(k);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDone(null), 1800);
  };

  const run = async (kind: Kind, fn: () => Promise<{ queued: boolean }>, ok: string, after: () => void) => {
    setMsg(null);
    try {
      const r = await fn();
      after();
      flash(kind);
      if (!r.queued) haptic("success");
      setMsg(r.queued ? { tone: "warn", text: "I couldn't save that. Your entry is queued and will sync when you're back online." } : { tone: "good", text: ok });
    } catch (e) {
      setMsg({ tone: "warn", text: (e as Error).message });
    }
  };

  const num = (s: string) => Number(s.replace(",", "."));

  return (
    <section className="card space-y-3" aria-labelledby="quick-h">
      <h2 id="quick-h" className="display text-lg font-extrabold">Quick log</h2>
      <div className="grid grid-cols-2 gap-2.5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = num(weight);
            if (!v) return;
            const kg = units === "IMPERIAL" ? lbToKg(v) : v;
            void run("weight", () => logTool("log_weight", { date, weightKg: Math.round(kg * 10) / 10 }), "Weigh-in saved.", () => { setWeight(""); onLogged?.("weight", kg); });
          }}
        >
          <LogTile saved={done === "weight"} icon={Scale} color="brand" label={`Morning weight (${units === "IMPERIAL" ? "lb" : "kg"})`} htmlFor="q-weight">
            <SaveInput id="q-weight" inputMode="decimal" value={weight} onChange={setWeight} placeholder={units === "IMPERIAL" ? "186.5" : "84.5"} saveLabel="Save weight" saved={done === "weight"} />
          </LogTile>
        </form>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = Math.round(num(steps));
            if (!v) return;
            void run("steps", () => logTool("log_activity", { date, type: "STEPS", steps: v }), "Steps saved.", () => { setSteps(""); onLogged?.("steps", v); });
          }}
        >
          <LogTile saved={done === "steps"} icon={Footprints} color="steps" label="Steps today" htmlFor="q-steps">
            <SaveInput id="q-steps" inputMode="numeric" value={steps} onChange={setSteps} placeholder="9500" saveLabel="Save steps" saved={done === "steps"} />
          </LogTile>
        </form>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = num(sleep);
            if (!v) return;
            void run("sleep", () => logTool("log_sleep", { date, hours: v }), "Sleep saved.", () => { setSleep(""); onLogged?.("sleep", v); });
          }}
        >
          <LogTile saved={done === "sleep"} icon={Moon} color="sleep" label="Last night's sleep (hours)" htmlFor="q-sleep">
            <SaveInput id="q-sleep" inputMode="decimal" value={sleep} onChange={setSleep} placeholder="7.5" saveLabel="Save sleep" saved={done === "sleep"} />
          </LogTile>
        </form>

        <LogTile saved={done === "water"} icon={Droplets} color="brand" label="Water">
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Add water">
            {[250, 500].map((ml) => (
              <button
                key={ml}
                type="button"
                className="btn !bg-surface !px-1 text-[13px]"
                onClick={() => void run("water", () => logTool("log_water", { date, ml }), `+${ml} ml water.`, () => onLogged?.("water", ml))}
              >
                +{ml} ml
              </button>
            ))}
          </div>
        </LogTile>
      </div>
      <div aria-live="polite">{msg && <Notice tone={msg.tone}>{msg.text}</Notice>}</div>
      <p className="text-xs text-muted">Weigh-in tip: after waking and the bathroom, before food or drink, same scale, similar clothing.</p>
    </section>
  );
}
