"use client";
import { Minus, Plus } from "lucide-react";
import { fmtNum } from "@/lib/client/format";

/** Servings counter with accessible "−" / "+" buttons. "−" is disabled at 0 (the server clamps at 0 too). */
export function ProduceStepper({ label, noun, value, onChange }: { label: string; noun: string; value: number; onChange: (delta: 1 | -1) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs text-muted">{label}</p>
        <p className="font-semibold tabular-nums" aria-live="polite">
          {fmtNum(value, 1)}<span className="sr-only"> {value === 1 ? "serving" : "servings"}</span>
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" className="btn !px-3" aria-label={`Remove one ${noun} serving`} disabled={value <= 0} onClick={() => onChange(-1)}>
          <Minus className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" className="btn !px-3" aria-label={`Add one ${noun} serving`} onClick={() => onChange(1)}>
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
