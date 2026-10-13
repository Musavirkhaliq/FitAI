import { clsx } from "@/components/ui";

/**
 * A low–mid–high estimate drawn on a fixed scale: soft band for the range, a ringed dot for the middle estimate.
 * Always labelled an estimate; the screen-reader text states the same numbers in words.
 */
export function RangeBar({ label, low, mid, high, domain, text, className }: {
  label: string;
  low: number;
  mid?: number;
  high: number;
  /** Scale shown by the track, in the same unit as low/high. */
  domain: [number, number];
  /** Pre-formatted range, e.g. "≈ 18–24%". */
  text: string;
  className?: string;
}) {
  const [d0, d1] = domain;
  const span = d1 - d0 || 1;
  const at = (v: number) => `${Math.max(0, Math.min(100, ((v - d0) / span) * 100))}%`;
  const left = Math.max(0, Math.min(100, ((low - d0) / span) * 100));
  const right = Math.max(0, Math.min(100, ((high - d0) / span) * 100));
  const width = Math.max(3, right - left);
  return (
    <div className={clsx("rounded-2xl bg-surface-2 px-3.5 py-3", className)} role="img" aria-label={`${label}, estimate: ${text}`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-semibold text-muted">{label} <span className="font-medium">(est.)</span></p>
        <p className="num !text-base">{text}</p>
      </div>
      <div className="relative mt-3 h-2 rounded-full bg-surface-3" aria-hidden>
        <span className="absolute inset-y-0 rounded-full bg-brand/30" style={{ left: `${left}%`, width: `${width}%` }} />
        {mid != null && <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand ring-2 ring-surface" style={{ left: at(mid) }} />}
      </div>
    </div>
  );
}
