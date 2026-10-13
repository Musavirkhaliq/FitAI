"use client";
import { Minus, Plus } from "lucide-react";
import { useId } from "react";

/** Big gym-friendly number control: 56px steppers around an editable (or read-only) value. */
export function Stepper({
  label, unit, value, onChange, onStep, readOnly, inputMode = "decimal", hint,
}: {
  label: string; unit?: string; value: string; onChange?: (v: string) => void; onStep: (dir: 1 | -1) => void;
  readOnly?: boolean; inputMode?: "decimal" | "numeric"; hint?: string;
}) {
  const id = useId();
  const btn = "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface-2 text-fg transition-colors hover:bg-border active:scale-95";
  return (
    <div>
      <label htmlFor={id} className="label">{label}{unit ? <span className="font-normal text-muted"> ({unit})</span> : null}</label>
      <div className="flex items-center gap-2">
        <button type="button" className={btn} onClick={() => onStep(-1)} aria-label={`Decrease ${label.toLowerCase()}`}><Minus className="h-6 w-6" aria-hidden /></button>
        <input
          id={id}
          className="input !min-h-[56px] min-w-0 flex-1 text-center text-2xl font-semibold tabular-nums"
          value={value}
          inputMode={inputMode}
          readOnly={readOnly}
          onChange={(e) => onChange?.(e.target.value)}
          onFocus={(e) => !readOnly && e.target.select()}
          autoComplete="off"
        />
        <button type="button" className={btn} onClick={() => onStep(1)} aria-label={`Increase ${label.toLowerCase()}`}><Plus className="h-6 w-6" aria-hidden /></button>
      </div>
      {hint && <p className="mt-1 text-center text-xs text-muted">{hint}</p>}
    </div>
  );
}
