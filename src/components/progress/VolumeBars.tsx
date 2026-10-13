import { Badge, EmptyState } from "@/components/ui";
import type { VolumeDto, VolumeStatus } from "./types";

const STATUS: Record<VolumeStatus, { text: string; tone: "warn" | "good" | "bad" }> = {
  BELOW_MEV: { text: "Below minimum effective volume: usually too few sets to drive progress", tone: "warn" },
  PRODUCTIVE: { text: "In the productive range", tone: "good" },
  NEAR_MRV: { text: "Near your maximum recoverable volume: fine for a short push, keep an eye on recovery", tone: "warn" },
  OVER_MRV: { text: "Over maximum recoverable volume: consider trimming sets or adding recovery", tone: "bad" },
};
const SHORT: Record<VolumeStatus, string> = { BELOW_MEV: "Below minimum", PRODUCTIVE: "Productive", NEAR_MRV: "Near maximum", OVER_MRV: "Over maximum" };

/**
 * Hard sets per muscle over the last 7 days against MEV/MRV markers. Built as a text list (every row states its
 * numbers and status in words) rather than an image-role chart, so it stays readable to screen readers.
 */
export function VolumeBars({ volume }: { volume: VolumeDto[] }) {
  if (!volume.length) {
    return <EmptyState title="No sets in the last 7 days" body="Finish a workout and your weekly sets per muscle group will appear here." />;
  }
  return (
    <ul className="space-y-4">
      {[...volume].sort((a, b) => b.hardSets - a.hardSets).map((v) => {
        const max = Math.max(v.mrv * 1.2, v.hardSets * 1.05, 1);
        const at = (n: number) => `${Math.min(100, (n / max) * 100)}%`;
        const s = STATUS[v.status];
        return (
          <li key={v.muscle}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium capitalize">{v.muscle}</span>
              <span className="tabular-nums">{v.hardSets} hard {v.hardSets === 1 ? "set" : "sets"}</span>
            </div>
            <div className="relative mt-1.5 h-3 rounded-full bg-surface-2" aria-hidden>
              <div className={`h-full rounded-full ${s.tone === "good" ? "bg-good" : s.tone === "bad" ? "bg-bad" : "bg-warn"}`} style={{ width: at(v.hardSets) }} />
              {v.mev > 0 && <span className="absolute -top-1 h-5 w-0.5 bg-fg/70" style={{ left: at(v.mev) }} />}
              <span className="absolute -top-1 h-5 w-0.5 bg-fg/70" style={{ left: at(v.mrv) }} />
            </div>
            <p className="mt-1 text-xs text-muted tabular-nums">
              {v.mev > 0 ? `Minimum ${v.mev} · ` : ""}Maximum {v.mrv} sets a week
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <Badge tone={s.tone}>{SHORT[v.status]}</Badge>
              <span className="text-muted">{s.text}</span>
            </p>
          </li>
        );
      })}
    </ul>
  );
}
