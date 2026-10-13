"use client";
import { ChevronDown } from "lucide-react";
import { ProgressBar } from "@/components/ui";
import { fmtNum } from "@/lib/client/format";
import type { DaySummaryDto } from "@/lib/client/types";
import { microStatus } from "@/lib/engines/micros";

type Ref = DaySummaryDto["microRefs"][number];

/** Calm, words-first status. Never red; a low number on a partial day is not a finding. */
function statusText(ref: Ref, amount: number, isToday: boolean): string {
  const target = fmtNum(ref.target, ref.target < 100 ? 1 : 0);
  if (ref.kind === "limit") {
    return microStatus(ref, amount) === "HIGH"
      ? `Over the usual ${target} ${ref.unit} guide. It's one day, so no need to adjust anything.`
      : `Within the usual ${target} ${ref.unit} guide${isToday ? " so far today" : ""}`;
  }
  if (amount <= 0) return isToday ? "Nothing counted so far today" : "Nothing counted for this day";
  const ratio = amount / ref.target;
  if (ratio >= 1) return "Reached the reference";
  if (microStatus(ref, amount) === "OK") return isToday ? "On track so far today" : "On track";
  return isToday ? "So far today" : "Under 60% of the reference on this day";
}

/** Estimated vitamins and minerals for one day, summed from per-food estimates (many foods have no micro data). */
export function MicrosPanel({ s, isToday }: { s: DaySummaryDto; isToday: boolean }) {
  const hasData = s.microRefs.some((r) => (s.micros[r.key] ?? 0) > 0);
  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-muted">
        {isToday ? "These are amounts so far today, and the day isn't over. " : ""}
        References are rough adult guides, not personal targets. Food-database values are incomplete for some foods (many entries have no vitamin or mineral data), so a low number doesn&apos;t prove a deficiency. This isn&apos;t medical advice.
      </p>
      {!hasData ? (
        <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-muted">No data yet. Once you log foods with vitamin and mineral values, estimates will appear here.</p>
      ) : (
        <details className="group">
          <summary className="press flex min-h-[48px] cursor-pointer list-none items-center justify-between rounded-2xl bg-surface-2 px-4 text-sm font-semibold marker:hidden [&::-webkit-details-marker]:hidden">
            {isToday ? "Show amounts so far today" : "Show amounts for this day"}
            <ChevronDown className="h-4 w-4 text-muted transition-transform duration-300 group-open:rotate-180" aria-hidden />
          </summary>
          <dl className="mt-4 space-y-4">
            {s.microRefs.map((r) => {
              const amount = s.micros[r.key] ?? 0;
              const dp = r.target < 100 ? 1 : 0;
              const pctv = Math.round((amount / r.target) * 100);
              const reached = r.kind === "goal" && amount / r.target >= 0.6;
              // Sodium is a limit: calm amber only when over the guide, with words beside it; never red.
              const over = r.kind === "limit" && microStatus(r, amount) === "HIGH";
              return (
                <div key={r.key}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                    <dt className="font-semibold">{r.label}{r.kind === "limit" && <span className="font-normal text-muted"> (upper guide)</span>}</dt>
                    <dd className="tabular-nums">
                      <span className="font-semibold">{fmtNum(amount, dp)}</span> {r.unit}
                      <span className="text-muted"> · {pctv}% of ~{fmtNum(r.target, dp)} {r.unit}</span>
                    </dd>
                  </div>
                  <div className="mt-1.5 [&>[role=progressbar]]:!h-1.5">
                    <ProgressBar value={Math.min(amount, r.target)} max={r.target} label={`${r.label}: ${pctv}% of the reference`} color={over ? "warn" : reached ? "good" : "brand"} />
                  </div>
                  <p className="mt-1 text-xs text-muted">{statusText(r, amount, isToday)}</p>
                </div>
              );
            })}
          </dl>
        </details>
      )}
    </div>
  );
}
