/** Gentle ring for the weekly consistency score. Always the brand colour: a low score is information, not a warning. */
export function ConsistencyRing({ score, label }: { score: number; label: string }) {
  const r = 52, c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, score));
  return (
    <div className="flex items-center gap-4" role="group" aria-label={`Consistency score ${Math.round(v)} out of 100: ${label}`}>
      <svg width="124" height="124" viewBox="0 0 124 124" className="shrink-0 -rotate-90" aria-hidden>
        <circle cx="62" cy="62" r={r} fill="none" stroke="rgb(var(--surface-2))" strokeWidth="12" />
        <circle cx="62" cy="62" r={r} fill="none" stroke="rgb(var(--brand))" strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} className="transition-[stroke-dashoffset] duration-700" />
      </svg>
      <div>
        <p className="text-4xl font-semibold tabular-nums leading-none">{Math.round(v)}<span className="text-base font-normal text-muted"> / 100</span></p>
        <p className="mt-1 font-medium">{label}</p>
        <p className="mt-1 text-xs text-muted">Last 7 days. Misses dent the score; they never reset it.</p>
      </div>
    </div>
  );
}
