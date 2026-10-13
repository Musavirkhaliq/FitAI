"use client";
import { AnimatedNumber, Ring } from "@/components/ui";

/** Gentle ring for the weekly consistency score. Always the brand colour: a low score is information, not a warning. */
export function ConsistencyRing({ score, label }: { score: number; label: string }) {
  const v = Math.max(0, Math.min(100, score));
  return (
    <div className="flex items-center gap-4" role="group" aria-label={`Consistency score ${Math.round(v)} out of 100: ${label}`}>
      <Ring ratio={v / 100} size={128} stroke={13} color="brand">
        <span className="num text-[2.4rem]" aria-hidden><AnimatedNumber value={Math.round(v)} fromZero /></span>
      </Ring>
      <div className="min-w-0">
        <p className="eyebrow">Consistency · last 7 days</p>
        <p className="display mt-1 text-xl font-extrabold leading-tight">{label}</p>
        <p className="mt-1.5 text-sm text-muted">Out of 100. Misses dent the score; they never reset it.</p>
      </div>
    </div>
  );
}
