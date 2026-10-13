"use client";
import { Minus, Plus } from "lucide-react";
import { haptic } from "@/components/ui";
import { fmtNum } from "@/lib/client/format";

/** Servings counter with accessible "−" / "+" buttons. "−" is disabled at 0 (the server clamps at 0 too). */
export function ProduceStepper({ label, noun, value, onChange }: { label: string; noun: string; value: number; onChange: (delta: 1 | -1) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 p-2.5 pl-4">
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="num text-xl" aria-live="polite">
          {fmtNum(value, 1)}<span className="sr-only"> {value === 1 ? "serving" : "servings"}</span>
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" className="btn !w-12 !rounded-full !bg-surface !px-0" aria-label={`Remove one ${noun} serving`} disabled={value <= 0} onClick={() => { haptic(); onChange(-1); }}>
          <Minus className="h-5 w-5" aria-hidden />
        </button>
        <button type="button" className="btn !w-12 !rounded-full !bg-surface !px-0" aria-label={`Add one ${noun} serving`} onClick={() => { haptic(); onChange(1); }}>
          <Plus className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
