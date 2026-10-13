"use client";
import { Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useId, useRef } from "react";
import { haptic } from "@/components/ui";

const BTN =
  "press flex h-16 w-16 shrink-0 touch-manipulation select-none items-center justify-center rounded-2xl border border-border bg-surface-2 text-fg transition-colors hover:bg-surface-3 active:bg-surface-3";

/**
 * One-hand number control for gym use: 64 px steppers around a big editable value. Press and hold to repeat.
 * Pointer presses step immediately; keyboard activation arrives as a click with detail 0.
 */
export function Stepper({
  label, unit, value, onChange, onStep, inputMode = "decimal", hint,
}: {
  label: string; unit?: string; value: string; onChange: (v: string) => void; onStep: (dir: 1 | -1) => void; inputMode?: "decimal" | "numeric"; hint?: string;
}) {
  const id = useId();
  const stepRef = useRef(onStep);
  const timers = useRef<{ delay?: number; repeat?: number }>({});
  useEffect(() => {
    stepRef.current = onStep;
  });

  const stop = useCallback(() => {
    window.clearTimeout(timers.current.delay);
    window.clearInterval(timers.current.repeat);
  }, []);
  useEffect(() => stop, [stop]);

  const press = (dir: 1 | -1) => (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    stop();
    haptic();
    stepRef.current(dir);
    timers.current.delay = window.setTimeout(() => {
      timers.current.repeat = window.setInterval(() => stepRef.current(dir), 110);
    }, 450);
  };
  const keyboard = (dir: 1 | -1) => (e: React.MouseEvent) => {
    if (e.detail === 0) stepRef.current(dir);
  };

  const btnProps = (dir: 1 | -1) => ({
    type: "button" as const,
    className: BTN,
    onPointerDown: press(dir),
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onClick: keyboard(dir),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  return (
    <div>
      <label htmlFor={id} className="label !mb-2 flex items-baseline justify-between">
        <span>{label}</span>
        {unit && <span className="text-sm font-medium text-muted">{unit}</span>}
      </label>
      <div className="flex items-center gap-2.5">
        <button {...btnProps(-1)} aria-label={`Decrease ${label.toLowerCase()}`}><Minus className="h-7 w-7" aria-hidden /></button>
        <input
          id={id}
          className="input num !min-h-[64px] min-w-0 flex-1 !rounded-2xl text-center !text-[2.25rem] !font-bold"
          value={value}
          inputMode={inputMode}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => e.target.select()}
          autoComplete="off"
        />
        <button {...btnProps(1)} aria-label={`Increase ${label.toLowerCase()}`}><Plus className="h-7 w-7" aria-hidden /></button>
      </div>
      {hint && <p className="mt-1.5 text-center text-xs text-muted">{hint}</p>}
    </div>
  );
}
