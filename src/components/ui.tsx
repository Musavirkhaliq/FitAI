"use client";
import clsx from "clsx";
import { AlertTriangle, Inbox, Loader2, WifiOff, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";

export { clsx };

/* ───────────────────────── helpers ───────────────────────── */

/** Light haptic tick where the platform supports it (Android Chrome). Silent no-op elsewhere. */
export function haptic(kind: "tap" | "success" | "warn" = "tap") {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      navigator.vibrate(kind === "tap" ? 8 : kind === "success" ? [10, 40, 14] : [18, 30, 18]);
    }
  } catch {
    /* unsupported */
  }
}

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Fixed-meaning colours (docs/DESIGN.md §3). Validated for colour-vision separation and ≥ 3:1 contrast in both themes. */
export type RingColor = "brand" | "cal" | "protein" | "steps" | "sleep" | "fiber" | "good" | "warn" | "bad";
const VAR: Record<RingColor, string> = {
  brand: "--brand", cal: "--c-cal", protein: "--c-protein", steps: "--c-steps", sleep: "--c-sleep", fiber: "--c-fiber", good: "--good", warn: "--warn", bad: "--bad",
};
export const colorVar = (c: RingColor) => `rgb(var(${VAR[c]}))`;

/* ───────────────────────── layout ───────────────────────── */

/** Page title row. */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="rise mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="display text-[1.75rem] font-extrabold leading-tight tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** A bento cell. `span` is how many of the grid's columns it takes on small screens. */
export function Tile({ children, span = 1, className, style, index = 0 }: { children: ReactNode; span?: 1 | 2; className?: string; style?: CSSProperties; index?: number }) {
  return (
    <div className={clsx("tile rise", span === 2 && "col-span-2", className)} style={{ ...style, ["--i" as string]: index }}>
      {children}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={clsx("shimmer rounded-3xl", className)} />;
}

export function LoadingBlock({ label = "Loading", rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{label}…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-24" />
      ))}
    </div>
  );
}

export function EmptyState({ title, body, action, icon }: { title: string; body?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="rise flex flex-col items-center gap-3 rounded-[1.5rem] border border-dashed border-border px-6 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-muted ring-1 ring-border" aria-hidden>
        {icon ?? <Inbox className="h-7 w-7" />}
      </div>
      <p className="display text-lg font-bold">{title}</p>
      {body && <p className="max-w-md text-sm text-muted">{body}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-[1.5rem] border border-bad/40 bg-bad/10 p-4 text-sm">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-bad" aria-hidden />
      <div className="flex-1">
        <p>{message}</p>
        {onRetry && (
          <button className="btn mt-3" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

/** Soft banner for non-fatal notices (offline, stale data). */
export function Notice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warn" | "good" }) {
  const t = { info: "border-border bg-surface-2", warn: "border-warn/40 bg-warn/10", good: "border-good/40 bg-good/10" }[tone];
  return (
    <div role="status" className={clsx("pop flex items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-sm", t)}>
      {tone === "warn" && <WifiOff className="h-4 w-4 shrink-0" aria-hidden />}
      <div>{children}</div>
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "bad" | "brand"; className?: string }) {
  const t = {
    neutral: "bg-surface-2 text-fg",
    good: "bg-good/[0.12] text-good",
    warn: "bg-warn/[0.12] text-warn",
    bad: "bg-bad/[0.12] text-bad",
    brand: "bg-brand/[0.12] text-brand",
  }[tone];
  return <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", t, className)}>{children}</span>;
}

/** Pill button for quick actions / suggestions. */
export function Chip({ children, onClick, disabled, active, "aria-label": ariaLabel }: { children: ReactNode; onClick?: () => void; disabled?: boolean; active?: boolean; "aria-label"?: string }) {
  return (
    <button type="button" className={clsx("chip", active && "!border-brand !bg-brand/10 text-brand")} onClick={onClick} disabled={disabled} aria-pressed={active} aria-label={ariaLabel}>
      {children}
    </button>
  );
}

/* ───────────────────────── numbers & rings ───────────────────────── */

/**
 * Counts to `value` (from the previous value, or from 0 on first paint when `fromZero`). Instant under reduced motion.
 * The accessible text is always the final value, never mid-animation.
 */
export function AnimatedNumber({ value, format = (n: number) => Math.round(n).toLocaleString("en-US"), duration = 650, fromZero = false, className }: {
  value: number; format?: (n: number) => string; duration?: number; fromZero?: boolean; className?: string;
}) {
  const [shown, setShown] = useState(fromZero ? 0 : value);
  const prev = useRef(fromZero ? 0 : value);
  useEffect(() => {
    if (prefersReducedMotion() || prev.current === value) {
      prev.current = value;
      setShown(value);
      return;
    }
    const from = prev.current;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      const e = 1 - Math.pow(1 - k, 3);
      setShown(from + (value - from) * e);
      if (k < 1) raf = requestAnimationFrame(step);
      else prev.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return (
    <span className={className} aria-label={format(value)}>
      <span aria-hidden>{format(shown)}</span>
    </span>
  );
}

/** A single progress ring. The arc draws in on mount and eases on updates. `ratio` is clamped to 0–1. */
export function Ring({ ratio, size = 64, stroke = 7, color = "brand", children, className }: {
  ratio: number; size?: number; stroke?: number; color?: RingColor; children?: ReactNode; className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const k = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  return (
    <div className={clsx("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colorVar(color)} strokeOpacity={0.16} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colorVar(color)} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - k)}
          className="animate-draw-ring [transition:stroke-dashoffset_700ms_cubic-bezier(0.22,1,0.36,1)]"
          style={{ ["--ring-len" as string]: c, ["--ring-off" as string]: c * (1 - k) }}
        />
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
    </div>
  );
}

/** Concentric rings (outermost first). Each ring has a fixed meaning colour; `summary` is the screen-reader text. */
export function RingCluster({ rings, size = 200, stroke = 14, gap = 5, summary, children }: {
  rings: { ratio: number; color: RingColor }[]; size?: number; stroke?: number; gap?: number; summary: string; children?: ReactNode;
}) {
  return (
    <div className="relative mx-auto shrink-0" style={{ width: size, height: size }} role="img" aria-label={summary}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
        {rings.map((ring, i) => {
          const r = (size - stroke) / 2 - i * (stroke + gap);
          const c = 2 * Math.PI * r;
          const k = Math.max(0, Math.min(1, Number.isFinite(ring.ratio) ? ring.ratio : 0));
          return (
            <g key={i}>
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colorVar(ring.color)} strokeOpacity={0.16} strokeWidth={stroke} />
              <circle
                cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colorVar(ring.color)} strokeWidth={stroke} strokeLinecap="round"
                strokeDasharray={c} strokeDashoffset={c * (1 - k)}
                className="animate-draw-ring [transition:stroke-dashoffset_800ms_cubic-bezier(0.22,1,0.36,1)]"
                style={{ ["--ring-len" as string]: c, ["--ring-off" as string]: c * (1 - k), animationDelay: `${i * 90}ms` }}
              />
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

/** Tiny trend line with a 10% area wash and an end-dot ringed in the surface colour. Decorative: pair it with text. */
export function Sparkline({ values, color = "brand", className }: { values: (number | null)[]; color?: RingColor; className?: string }) {
  const real = values.map((v, i) => (v == null ? null : { i, v })).filter((p): p is { i: number; v: number } => p !== null);
  if (real.length < 2) return null;
  const W = 120, H = 40, pad = 5;
  const lo = Math.min(...real.map((p) => p.v));
  const hi = Math.max(...real.map((p) => p.v));
  const span = hi - lo || 1;
  const x = (i: number) => pad + (i / Math.max(1, values.length - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - ((v - lo) / span) * (H - pad * 2);
  const d = real.map((p, j) => `${j ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const last = real[real.length - 1];
  const col = colorVar(color);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={clsx("h-auto w-full", className)} aria-hidden>
      <path d={`${d} L${x(last.i).toFixed(1)},${H} L${x(real[0].i).toFixed(1)},${H} Z`} fill={col} opacity={0.1} />
      <path d={d} fill="none" stroke={col} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(last.i)} cy={y(last.v)} r={4} fill={col} stroke="rgb(var(--surface))" strokeWidth={2} />
    </svg>
  );
}

/**
 * Metric tile: label, big number, target, optional hint, and a progress ring. `color` picks the ring's fixed meaning
 * (calories, protein, steps, sleep, fibre); `tone` is the older status-colour API and still works.
 */
export function MetricCard({
  label, value, target, unit, hint, tone = "brand", color, format = (n: number) => Math.round(n).toLocaleString("en-US"), ranged, className, index = 0,
}: {
  label: string; value: number | null; target?: number | null; unit?: string; hint?: ReactNode; tone?: "brand" | "good" | "warn" | "bad"; color?: RingColor;
  format?: (n: number) => string; ranged?: [number, number] | null; className?: string; index?: number;
}) {
  const v = value ?? 0;
  const ratio = target ? v / target : 0;
  const over = target ? v > target * 1.1 : false;
  const ring: RingColor = over ? "warn" : color ?? tone;
  const aria = `${label}: ${value == null ? "no data" : `${format(v)}${unit ? " " + unit : ""}`}${target ? ` of ${format(target)}${unit ? " " + unit : ""} target` : ""}`;
  return (
    <div className={clsx("tile rise flex items-center justify-between gap-3", className)} role="group" aria-label={aria} style={{ ["--i" as string]: index }}>
      <div className="min-w-0">
        <p className="eyebrow">{label}</p>
        <p className="mt-1.5 flex items-baseline gap-1">
          <span className="num text-[1.75rem]">{value == null ? "—" : <AnimatedNumber value={v} format={format} />}</span>
          {unit && <span className="text-sm font-medium text-muted">{unit}</span>}
        </p>
        {target ? <p className="mt-0.5 text-xs text-muted">of {format(target)}{unit ? ` ${unit}` : ""}</p> : null}
        {ranged && <p className="text-xs text-muted">est. {format(ranged[0])}–{format(ranged[1])}</p>}
        {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      </div>
      {target ? (
        <Ring ratio={ratio} size={56} stroke={7} color={ring}>
          <span className="text-[11px] font-bold tabular-nums text-muted">{Math.round(Math.min(ratio, 9.99) * 100)}%</span>
        </Ring>
      ) : null}
    </div>
  );
}

export function ProgressBar({ value, max, label, tone = "brand", color }: { value: number; max: number; label: string; tone?: "brand" | "good" | "warn" | "bad"; color?: RingColor }) {
  const pctv = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const col = colorVar(color ?? tone);
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)} className="h-2.5 w-full overflow-hidden rounded-full" style={{ background: `color-mix(in srgb, ${col} 16%, transparent)` }}>
      <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${pctv}%`, background: col }} />
    </div>
  );
}

/* ───────────────────────── controls ───────────────────────── */

/** Pill segmented control with a sliding indicator. */
export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div role="radiogroup" aria-label={label} className="relative inline-grid rounded-2xl border border-border bg-surface-2 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 rounded-xl bg-surface shadow-tile transition-transform duration-300 ease-out"
        style={{ width: `calc((100% - 0.5rem) / ${options.length})`, transform: `translateX(${idx * 100}%)` }}
      />
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => { haptic(); onChange(o.value); }}
          className={clsx("relative z-10 min-h-[44px] whitespace-nowrap rounded-xl px-3.5 text-sm font-semibold transition-colors", value === o.value ? "text-fg" : "text-muted hover:text-fg")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div>
        <label htmlFor={id} className="font-semibold">{label}</label>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      <button id={id} type="button" role="switch" aria-checked={checked} onClick={() => { haptic(); onChange(!checked); }}
        className={clsx("press relative h-8 w-[3.25rem] shrink-0 rounded-full border transition-colors duration-300", checked ? "border-transparent grad-brand" : "border-border bg-surface-3")}>
        <span className={clsx("absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-all duration-300 ease-out", checked ? "left-[1.6rem]" : "left-0.5")} />
        <span className="sr-only">{checked ? "On" : "Off"}</span>
      </button>
    </div>
  );
}

/** Bottom sheet on phones (grab handle, swipe down to dismiss, safe-area aware), centred card on larger screens. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [dy, setDy] = useState(0);
  const drag = useRef<{ y: number; active: boolean }>({ y: 0, active: false });

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  const onDown = (e: React.PointerEvent) => {
    drag.current = { y: e.clientY, active: true };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => drag.current.active && setDy(Math.max(0, e.clientY - drag.current.y));
  const onUp = () => {
    drag.current.active = false;
    if (dy > 110) onClose();
    setDy(0);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}
        style={{ transform: dy ? `translateY(${dy}px)` : undefined, transition: drag.current.active ? "none" : "transform 240ms cubic-bezier(0.22,1,0.36,1)" }}
        className="glass animate-float-up relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-[2rem] border border-border bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-float sm:max-w-lg sm:rounded-[2rem]">
        <div className="-mx-5 -mt-5 mb-1 flex cursor-grab touch-none justify-center pb-2 pt-3 sm:hidden" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} aria-hidden>
          <span className="h-1.5 w-11 rounded-full bg-border" />
        </div>
        <div className="mb-3 flex items-center justify-between">
          <h2 id={titleId} className="display text-xl font-extrabold">{title}</h2>
          <button className="btn btn-ghost !min-h-[44px] !px-2.5" onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ───────────────────────── charts ───────────────────────── */

/**
 * Chart wrapper with text alternatives for screen readers: a summary sentence (role="img" label) plus a
 * collapsible data table with the same numbers. Every chart in the app goes through this.
 */
export function ChartFrame({
  title, summary, table, children, height = 240,
}: {
  title: string; summary: string; height?: number; children: ReactNode;
  table?: { columns: string[]; rows: (string | number | null)[][] };
}) {
  const id = useId();
  return (
    <figure className="card rise">
      <figcaption className="display mb-2 text-base font-bold" id={id}>{title}</figcaption>
      <div role="img" aria-labelledby={id} aria-describedby={`${id}-d`} style={{ height }} className="w-full">
        {children}
      </div>
      <p id={`${id}-d`} className="mt-3 text-sm text-muted">{summary}</p>
      {table && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer py-1 text-muted hover:text-fg">View data as a table</summary>
          <div className="mt-2 max-h-64 overflow-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">{title}</caption>
              <thead><tr>{table.columns.map((c) => <th key={c} scope="col" className="sticky top-0 bg-surface-2 px-2.5 py-1.5 font-semibold">{c}</th>)}</tr></thead>
              <tbody>{table.rows.map((r, i) => <tr key={i} className="border-t border-border">{r.map((v, j) => <td key={j} className="px-2.5 py-1.5 tabular-nums">{v ?? "—"}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </details>
      )}
    </figure>
  );
}

/** Chart colours that follow the theme. Series order is fixed and validated; never reorder or reuse for another meaning. */
export const chartColors = {
  brand: "rgb(var(--brand))",
  muted: "rgb(var(--muted))",
  grid: "rgb(var(--border))",
  warn: "rgb(var(--warn))",
  bad: "rgb(var(--bad))",
  good: "rgb(var(--good))",
  cal: "rgb(var(--c-cal))",
  protein: "rgb(var(--c-protein))",
  steps: "rgb(var(--c-steps))",
  sleep: "rgb(var(--c-sleep))",
  fiber: "rgb(var(--c-fiber))",
  surface: "rgb(var(--surface))",
  series: ["rgb(var(--c-cal))", "rgb(var(--c-protein))", "rgb(var(--c-steps))", "rgb(var(--c-sleep))", "rgb(var(--c-fiber))"],
};

export const tooltipStyle = {
  contentStyle: {
    background: "rgb(var(--surface) / 0.94)",
    backdropFilter: "blur(12px)",
    border: "1px solid rgb(var(--border))",
    borderRadius: 14,
    color: "rgb(var(--fg))",
    fontSize: 12,
    boxShadow: "var(--shadow-float)",
    padding: "8px 12px",
  },
  labelStyle: { color: "rgb(var(--muted))", marginBottom: 2 },
};
