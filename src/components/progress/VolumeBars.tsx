import { AlertTriangle, ArrowUp, Check } from "lucide-react";
import type { ReactNode } from "react";
import { Badge, EmptyState } from "@/components/ui";
import type { VolumeDto, VolumeStatus } from "./types";

const STATUS: Record<VolumeStatus, { text: string; tone: "warn" | "good" | "bad"; short: string; icon: ReactNode }> = {
  BELOW_MEV: { text: "Below minimum effective volume: usually too few sets to drive progress.", tone: "warn", short: "Below minimum", icon: <ArrowUp className="mr-1 h-3 w-3" aria-hidden /> },
  PRODUCTIVE: { text: "In the productive range.", tone: "good", short: "Productive", icon: <Check className="mr-1 h-3 w-3" aria-hidden /> },
  NEAR_MRV: { text: "Near your maximum recoverable volume: fine for a short push, keep an eye on recovery.", tone: "warn", short: "Near maximum", icon: <AlertTriangle className="mr-1 h-3 w-3" aria-hidden /> },
  OVER_MRV: { text: "Over maximum recoverable volume: consider trimming sets or adding recovery.", tone: "bad", short: "Over maximum", icon: <AlertTriangle className="mr-1 h-3 w-3" aria-hidden /> },
};
const FILL = { good: "bg-good", warn: "bg-warn", bad: "bg-bad" } as const;

/**
 * Hard sets per muscle over the last 7 days against MEV/MRV markers. Built as a text list (every row states its
 * numbers and status in words) rather than an image-role chart, so it stays readable to screen readers.
 * The shaded band on each track is the productive zone (MEV to MRV); the bar is this week's sets.
 */
export function VolumeBars({ volume }: { volume: VolumeDto[] }) {
  if (!volume.length) {
    return <EmptyState title="No sets in the last 7 days" body="Finish a workout and your weekly sets per muscle group will appear here." />;
  }
  return (
    <ul className="space-y-5">
      {[...volume].sort((a, b) => b.hardSets - a.hardSets).map((v) => {
        const max = Math.max(v.mrv * 1.2, v.hardSets * 1.05, 1);
        const at = (n: number) => Math.min(100, (n / max) * 100);
        const s = STATUS[v.status];
        return (
          <li key={v.muscle}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="display font-bold capitalize">{v.muscle}</span>
              <span className="text-sm text-muted"><span className="num !text-lg text-fg">{v.hardSets}</span> hard {v.hardSets === 1 ? "set" : "sets"}</span>
            </div>
            <div className="relative mt-2 h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden>
              <span className="absolute inset-y-0 bg-brand/15" style={{ left: `${at(v.mev)}%`, width: `${Math.max(0, at(v.mrv) - at(v.mev))}%` }} />
              <span className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out ${FILL[s.tone]}`} style={{ width: `${at(v.hardSets)}%` }} />
              {v.mev > 0 && <span className="absolute inset-y-0 w-0.5 bg-fg/40" style={{ left: `${at(v.mev)}%` }} />}
              <span className="absolute inset-y-0 w-0.5 bg-fg/40" style={{ left: `${at(v.mrv)}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-muted tabular-nums">
              {v.mev > 0 ? `Productive zone ${v.mev}–${v.mrv} sets a week` : `Up to ${v.mrv} sets a week`}
            </p>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <Badge tone={s.tone}>{s.icon}{s.short}</Badge>
              <span className="text-muted">{s.text}</span>
            </p>
          </li>
        );
      })}
    </ul>
  );
}
