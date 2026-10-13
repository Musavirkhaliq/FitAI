"use client";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ErrorState, LoadingBlock, Notice, Toggle } from "@/components/ui";
import { useApi } from "@/lib/client/api";
import { fmtDay, fmtNum, fmtWeight, todayLocal, type UnitSystem } from "@/lib/client/format";
import { shiftDay } from "@/components/nutrition/dayMath";
import type { DailyPointDto } from "@/lib/client/types";

const DAYS = 60;

const hasData = (d: DailyPointDto) => d.calories != null || d.protein != null || d.steps != null || d.sleepH != null || d.weightKg != null || d.trainingMin > 0;

/** Last 60 days, newest first. Each row opens that day in the nutrition log. */
export function DayBrowser({ units }: { units: UnitSystem }) {
  const from = useMemo(() => shiftDay(todayLocal(), -(DAYS - 1)), []);
  const { data, error, loading, refresh } = useApi<{ days: DailyPointDto[] }>(`/api/analytics?from=${from}`);
  const [hideEmpty, setHideEmpty] = useState(false);

  const days = useMemo(() => {
    const all = [...(data?.days ?? [])].reverse();
    return hideEmpty ? all.filter(hasData) : all;
  }, [data, hideEmpty]);

  return (
    <section className="card space-y-3" aria-labelledby="browse-h">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="browse-h" className="text-sm font-semibold">Browse by day</h2>
        <p className="text-xs text-muted">Last {DAYS} days</p>
      </div>
      {error && data && <Notice tone="warn">{error}</Notice>}
      {loading && !data ? (
        <LoadingBlock label="Loading days" rows={4} />
      ) : !data ? (
        <ErrorState message={error ?? "I couldn't load your days."} onRetry={() => void refresh()} />
      ) : (
        <>
          <Toggle checked={hideEmpty} onChange={setHideEmpty} label="Hide days with nothing logged" />
          {days.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Nothing logged in this period yet.</p>
          ) : (
            <ul className="max-h-[32rem] divide-y divide-border overflow-y-auto rounded-xl border border-border">
              {days.map((d) => (
                <li key={d.date}>
                  <Link href={`/nutrition?date=${d.date}`} className="block min-h-[44px] px-3 py-2 hover:bg-surface-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{fmtDay(d.date)}</span>
                      <ChevronRight className="h-4 w-4 text-muted" aria-hidden />
                    </div>
                    {hasData(d) ? (
                      <dl className="mt-1 grid grid-cols-3 gap-x-3 gap-y-1 text-xs sm:grid-cols-6">
                        <Cell label="Calories (est.)" value={d.calories == null ? "—" : `~${fmtNum(d.calories)}`} />
                        <Cell label="Protein" value={d.protein == null ? "—" : `${fmtNum(d.protein)} g`} />
                        <Cell label="Steps" value={fmtNum(d.steps)} />
                        <Cell label="Sleep" value={d.sleepH == null ? "—" : `${fmtNum(d.sleepH, 1)} h`} />
                        <Cell label="Weight" value={fmtWeight(d.weightKg, units)} />
                        <Cell label="Training" value={d.trainingMin ? `${fmtNum(d.trainingMin)} min` : "—"} />
                      </dl>
                    ) : (
                      <p className="text-xs text-muted">Nothing logged</p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
