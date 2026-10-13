"use client";
import { Ruler } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Field, Notice } from "@/components/ui";
import { logTool } from "@/lib/client/api";
import { todayLocal } from "@/lib/client/format";
import type { MeasurementDto } from "./types";

const num = (s: string) => (s.trim() ? Number(s.replace(",", ".")) : undefined);
const RANGES = { waistCm: [30, 250, "Waist"], neckCm: [20, 80, "Neck"], hipCm: [40, 250, "Hip"], bodyFatPct: [2, 70, "Body fat"] } as const;

/** Tape measurements (cm) and an optional user-entered body-fat %. Hip is only needed for the female estimate. */
export function MeasurementForm({ showHip, onSaved }: { showHip: boolean; onSaved: (m: Omit<MeasurementDto, "id" | "notes">) => void }) {
  const [date, setDate] = useState(todayLocal);
  const [f, setF] = useState({ waistCm: "", neckCm: "", hipCm: "", bodyFatPct: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "good" | "warn"; text: string } | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const vals = { waistCm: num(f.waistCm), neckCm: num(f.neckCm), hipCm: num(f.hipCm), bodyFatPct: num(f.bodyFatPct) };
    const entries = Object.entries(vals).filter(([, v]) => v !== undefined) as [keyof typeof RANGES, number][];
    if (!entries.length) {
      setMsg({ tone: "warn", text: "Enter at least one measurement." });
      return;
    }
    for (const [k, v] of entries) {
      const [lo, hi, name] = RANGES[k];
      if (!Number.isFinite(v) || v < lo || v > hi) {
        setMsg({ tone: "warn", text: `${name} should be between ${lo} and ${hi}${k === "bodyFatPct" ? " %" : " cm"}.` });
        return;
      }
    }
    setBusy(true);
    try {
      const r = await logTool("log_measurement", { date, ...Object.fromEntries(entries) });
      onSaved({ date, waistCm: vals.waistCm ?? null, neckCm: vals.neckCm ?? null, hipCm: vals.hipCm ?? null, bodyFatPct: vals.bodyFatPct ?? null });
      setF({ waistCm: "", neckCm: "", hipCm: "", bodyFatPct: "" });
      setMsg(r.queued ? { tone: "warn", text: "You're offline. Your measurements are queued and will sync later." } : { tone: "good", text: "Measurements saved." });
    } catch (err) {
      setMsg({ tone: "warn", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-3" aria-labelledby="ms-h">
      <h3 id="ms-h" className="text-sm font-semibold">Log measurements</h3>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Waist (cm)" htmlFor="ms-waist" hint="At the navel, relaxed.">
          <input id="ms-waist" inputMode="decimal" className="input" value={f.waistCm} onChange={set("waistCm")} placeholder="88" autoComplete="off" />
        </Field>
        <Field label="Neck (cm)" htmlFor="ms-neck" hint="Just below the larynx.">
          <input id="ms-neck" inputMode="decimal" className="input" value={f.neckCm} onChange={set("neckCm")} placeholder="38" autoComplete="off" />
        </Field>
        {showHip && (
          <Field label="Hip (cm)" htmlFor="ms-hip" hint="Widest point. Needed for the estimate if you're female.">
            <input id="ms-hip" inputMode="decimal" className="input" value={f.hipCm} onChange={set("hipCm")} placeholder="100" autoComplete="off" />
          </Field>
        )}
        <Field label="Body fat % (optional)" htmlFor="ms-bf" hint="Only if you measured it elsewhere.">
          <input id="ms-bf" inputMode="decimal" className="input" value={f.bodyFatPct} onChange={set("bodyFatPct")} placeholder="22" autoComplete="off" />
        </Field>
        <Field label="Date" htmlFor="ms-date">
          <input id="ms-date" type="date" className="input" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} required />
        </Field>
      </div>
      <button className="btn btn-primary w-full sm:w-auto" disabled={busy}>
        <Ruler className="h-4 w-4" aria-hidden /> {busy ? "Saving…" : "Save measurements"}
      </button>
      <div aria-live="polite">{msg && <Notice tone={msg.tone}>{msg.text}</Notice>}</div>
    </form>
  );
}
