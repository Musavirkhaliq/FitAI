"use client";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ErrorState, Notice, Skeleton, Toggle, chartColors } from "@/components/ui";
import { useApi } from "@/lib/client/api";
import { fmtDay, fmtNum, fmtWeight, todayLocal, type UnitSystem } from "@/lib/client/format";
import { shiftDay } from "@/components/nutrition/dayMath";
import type { DailyPointDto } from "@/lib/client/types";

const DAYS = 60;
const STEP = 14;

const hasData = (d: DailyPointDto) => d.calories != null || d.protein != null || d.steps != null || d.sleepH != null || d.weightKg != null || d.trainingMin > 0;

/** Last 60 days, newest first. Each row opens that day in the nutrition log; a tiny bar compares calories across days. */
export function DayBrowser({ units, index = 0 }: { units: UnitSystem; index?: number }) {
  const from = useMemo(() => shiftDay(todayLocal(), -(DAYS - 1)), []);
  const { data, error, loading, refresh } = useApi<{ days: DailyPointDto[] }>(`/api/analytics?from=${from}`);
  const [hideEmpty, setHideEmpty] = useState(false);
  const [shown, setShown] = useState(STEP);

  const all = useMemo(() => [...(data?.days ?? [])].reverse(), [data]);
  const days = useMemo(() => (hideEmpty ? all.filter(hasData) : all), [all, hideEmpty]);
  // One shared scale for every row, so bar lengths are comparable (a single measure: no dual axes).
  const maxKcal = useMemo(() => Math.max(1, ...all.map((d) => d.calories ?? 0)), [all]);

  return (
    <section className="card rise space-y-3" aria-labelledby="browse-h" style={{ ["--i" as string]: index }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="browse-h" className="display text-lg font-extrabold">Browse by day</h2>
        <p className="text-xs text-muted">Last {DAYS} days · bars show estimated calories</p>
      </div>
      {error && data && <Notice tone="warn">{error}</Notice>}
      {loading && !data ? (
        <div role="status" aria-live="polite" className="space-y-2">
          <span className="sr-only">Loading days…</span>
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 !rounded-2xl" />)}
        </div>
      ) : !data ? (
        <ErrorState message={error ?? "I couldn't load your days."} onRetry={() => void refresh()} />
      ) : (
        <>
          <Toggle checked={hideEmpty} onChange={(v) => { setHideEmpty(v); setShown(STEP); }} label="Hide days with nothing logged" />
          {days.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">Nothing logged in this period yet. Whenever you log a meal, it&apos;ll show up here.</p>
          ) : (
            <>
              <ul className="space-y-2">
                {days.slice(0, shown).map((d) => {
                  const bits = [
                    d.protein != null && `Protein ${fmtNum(d.protein)} g`,
                    d.steps != null && `Steps ${fmtNum(d.steps)}`,
                    d.sleepH != null && `Sleep ${fmtNum(d.sleepH, 1)} h`,
                    d.weightKg != null && `Weight ${fmtWeight(d.weightKg, units)}`,
                    d.trainingMin > 0 && `Training ${fmtNum(d.trainingMin)} min`,
                  ].filter((b): b is string => !!b);
                  return (
                    <li key={d.date}>
                      <Link href={`/nutrition?date=${d.date}`} className="press flex min-h-[64px] items-center gap-3 rounded-2xl bg-surface-2 px-3.5 py-3 hover:bg-surface-3">
                        <div className="w-14 shrink-0">
                          <p className="eyebrow">{fmtDay(d.date, { weekday: "short" })}</p>
                          <p className="num mt-0.5 text-[1.05rem]">{fmtDay(d.date, { day: "numeric", month: "short" })}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          {hasData(d) ? (
                            <>
                              <p className="text-sm font-semibold tabular-nums">
                                {d.calories == null ? "No food logged" : <>~{fmtNum(d.calories)} <span className="font-normal text-muted">kcal (est.)</span></>}
                              </p>
                              {d.calories != null && (
                                <div aria-hidden className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full" style={{ background: `color-mix(in srgb, ${chartColors.cal} 16%, transparent)` }}>
                                  <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, (d.calories / maxKcal) * 100))}%`, background: chartColors.cal }} />
                                </div>
                              )}
                              {bits.length > 0 && <p className="mt-1.5 truncate text-xs text-muted">{bits.join(" · ")}</p>}
                            </>
                          ) : (
                            <p className="text-sm text-muted">Nothing logged</p>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {shown < days.length && (
                <button className="btn w-full" onClick={() => setShown((n) => n + STEP)}>Show {Math.min(STEP, days.length - shown)} more days</button>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
