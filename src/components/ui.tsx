"use client";
import clsx from "clsx";
import { AlertTriangle, Inbox, Loader2, WifiOff, X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

export { clsx };

/** Page title row. */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={clsx("animate-pulse rounded-xl bg-surface-2", className)} />;
}

export function LoadingBlock({ label = "Loading", rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{label}…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-20" />
      ))}
    </div>
  );
}

export function EmptyState({ title, body, action, icon }: { title: string; body?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl2 border border-dashed border-border px-6 py-10 text-center">
      <div className="text-muted" aria-hidden>{icon ?? <Inbox className="h-8 w-8" />}</div>
      <p className="font-medium">{title}</p>
      {body && <p className="max-w-md text-sm text-muted">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl2 border border-bad/40 bg-bad/10 p-4 text-sm">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-bad" aria-hidden />
      <div className="flex-1">
        <p>{message}</p>
        {onRetry && (
          <button className="btn mt-2" onClick={onRetry}>
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
    <div role="status" className={clsx("flex items-center gap-2 rounded-xl border px-3 py-2 text-sm", t)}>
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
    good: "bg-good/15 text-good",
    warn: "bg-warn/15 text-warn",
    bad: "bg-bad/15 text-bad",
    brand: "bg-brand/15 text-brand",
  }[tone];
  return <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", t, className)}>{children}</span>;
}

/** Progress ring + number; value/target are text for screen readers (never colour alone). */
export function MetricCard({
  label, value, target, unit, hint, tone = "brand", format = (n: number) => Math.round(n).toLocaleString("en-US"), ranged,
}: {
  label: string; value: number | null; target?: number | null; unit?: string; hint?: ReactNode; tone?: "brand" | "good" | "warn" | "bad";
  format?: (n: number) => string; ranged?: [number, number] | null;
}) {
  const v = value ?? 0;
  const ratio = target ? Math.min(1, v / target) : 0;
  const r = 26, c = 2 * Math.PI * r;
  const over = target ? v > target * 1.1 : false;
  const colour = over ? "text-warn" : { brand: "text-brand", good: "text-good", warn: "text-warn", bad: "text-bad" }[tone];
  const aria = `${label}: ${value == null ? "no data" : `${format(v)}${unit ? " " + unit : ""}`}${target ? ` of ${format(target)}${unit ? " " + unit : ""} target` : ""}`;
  return (
    <div className="card flex items-center gap-3 !p-3 sm:!p-4" role="group" aria-label={aria}>
      <svg width="64" height="64" viewBox="0 0 64 64" className="shrink-0 -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgb(var(--surface-2))" strokeWidth="7" />
        <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - ratio)} className={clsx(colour, "transition-[stroke-dashoffset] duration-500")} />
      </svg>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
        <p className="text-xl font-semibold leading-tight tabular-nums">
          {value == null ? "—" : format(v)}
          {target ? <span className="text-sm font-normal text-muted"> / {format(target)}{unit ? ` ${unit}` : ""}</span> : unit ? <span className="text-sm font-normal text-muted"> {unit}</span> : null}
        </p>
        {ranged && <p className="text-xs text-muted">est. range {format(ranged[0])}–{format(ranged[1])}</p>}
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
    </div>
  );
}

export function ProgressBar({ value, max, label, tone = "brand" }: { value: number; max: number; label: string; tone?: "brand" | "good" | "warn" | "bad" }) {
  const pctv = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const c = { brand: "bg-brand", good: "bg-good", warn: "bg-warn", bad: "bg-bad" }[tone];
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)} className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
      <div className={clsx("h-full rounded-full transition-[width] duration-500", c)} style={{ width: `${pctv}%` }} />
    </div>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl border border-border bg-surface-2 p-1">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={clsx("min-h-[44px] rounded-lg px-3 text-sm font-medium transition-colors", value === o.value ? "bg-surface shadow-sm" : "text-muted hover:text-fg")}>
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
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <label htmlFor={id} className="font-medium">{label}</label>
        {description && <p className="text-sm text-muted">{description}</p>}
      </div>
      <button id={id} role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={clsx("relative h-7 w-12 shrink-0 rounded-full border border-border transition-colors", checked ? "bg-brand" : "bg-surface-2")}>
        <span className={clsx("absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all", checked ? "left-[1.35rem]" : "left-0.5")} />
        <span className="sr-only">{checked ? "On" : "Off"}</span>
      </button>
    </div>
  );
}

/** Accessible modal / bottom sheet: focus trap-lite, Esc to close, labelled. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
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
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="presentation">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}
        className="relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-t-3xl border border-border bg-surface p-5 shadow-xl sm:max-w-lg sm:rounded-3xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
          <button className="btn btn-ghost !min-h-[40px] !px-2" onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

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
    <figure className="card">
      <figcaption className="mb-2 text-sm font-semibold" id={id}>{title}</figcaption>
      <div role="img" aria-labelledby={id} aria-describedby={`${id}-d`} style={{ height }} className="w-full">
        {children}
      </div>
      <p id={`${id}-d`} className="mt-2 text-sm text-muted">{summary}</p>
      {table && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-muted hover:text-fg">View data as a table</summary>
          <div className="mt-2 max-h-64 overflow-auto">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">{title}</caption>
              <thead><tr>{table.columns.map((c) => <th key={c} scope="col" className="sticky top-0 bg-surface px-2 py-1 font-medium">{c}</th>)}</tr></thead>
              <tbody>{table.rows.map((r, i) => <tr key={i} className="border-t border-border">{r.map((v, j) => <td key={j} className="px-2 py-1 tabular-nums">{v ?? "—"}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </details>
      )}
    </figure>
  );
}

/** Colours for Recharts that follow the theme (read from CSS variables). */
export const chartColors = {
  brand: "rgb(var(--brand))",
  muted: "rgb(var(--muted))",
  grid: "rgb(var(--border))",
  warn: "rgb(var(--warn))",
  bad: "rgb(var(--bad))",
  good: "rgb(var(--good))",
  series: ["rgb(var(--brand))", "#6366f1", "#d97706", "#0891b2", "#be185d"],
};

export const tooltipStyle = {
  contentStyle: { background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: 12, color: "rgb(var(--fg))", fontSize: 12 },
  labelStyle: { color: "rgb(var(--muted))" },
};
