"use client";
import { useId, useState } from "react";
import { clsx, haptic } from "@/components/ui";
import { rirShort } from "./util";

export const rirText = (rpe: number) => {
  const rir = Math.max(0, 10 - rpe);
  return rir === 0 ? "≈ 0 reps in reserve (all-out)" : `≈ ${rir} ${rir === 1 ? "rep" : "reps"} in reserve`;
};

const WHOLE = [6, 7, 8, 9, 10];
const HALVES = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

/** RPE as a row of big pill buttons (6 to 10). Half steps live behind a toggle so the default row stays thumb-sized. */
export function RpePicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const id = useId();
  const [half, setHalf] = useState(value % 1 !== 0);
  const showHalf = half || value % 1 !== 0;
  const options = showHalf ? HALVES : WHOLE;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p id={`${id}-l`} className="label !mb-0">RPE (effort)</p>
        <button
          type="button"
          className="press min-h-[44px] rounded-full px-3 text-sm font-semibold text-muted hover:text-fg"
          aria-pressed={showHalf}
          onClick={() => {
            haptic();
            if (showHalf) onChange(Math.round(value));
            setHalf(!showHalf);
          }}
        >
          {showHalf ? "Whole steps" : "Half steps"}
        </button>
      </div>
      <div role="radiogroup" aria-labelledby={`${id}-l`} className="grid grid-cols-5 gap-2">
        {options.map((o) => {
          const on = o === value;
          return (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`RPE ${o}, ${rirText(o).replace("≈ ", "about ")}`}
              onClick={() => { haptic(); onChange(o); }}
              className={clsx(
                "press flex h-16 touch-manipulation flex-col items-center justify-center rounded-2xl border transition-colors",
                on ? "btn-primary" : "border-border bg-surface-2 hover:bg-surface-3",
              )}
            >
              <span className="num text-[1.4rem]">{o}</span>
              <span className={clsx("mt-1 text-[11px] font-semibold leading-none", on ? "text-brand-fg/80" : "text-muted")}>{rirShort(o)}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-center text-sm text-muted" aria-live="polite">{rirText(value)}</p>
    </div>
  );
}
