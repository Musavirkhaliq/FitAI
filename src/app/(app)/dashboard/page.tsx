"use client";
import Link from "next/link";
import { ConsistencyRing } from "@/components/dashboard/ConsistencyRing";
import { DayBars } from "@/components/dashboard/DayBars";
import { DietQualityCard } from "@/components/dashboard/DietQualityCard";
import { HabitGrid } from "@/components/dashboard/HabitGrid";
import { RecapLink } from "@/components/dashboard/RecapLink";
import { RecoveryCard } from "@/components/dashboard/RecoveryCard";
import { StreaksCard } from "@/components/dashboard/StreaksCard";
import type { AnalyticsDto } from "@/components/dashboard/types";
import { Badge, chartColors, colorVar, ErrorState, LoadingBlock, Notice, PageHeader, ProgressBar, Skeleton, type RingColor } from "@/components/ui";
import { CalorieAdviceCard } from "@/components/weight/CalorieAdviceCard";
import { Stat } from "@/components/weight/Stat";
import { STATUS_TONE } from "@/components/weight/trend";
import { addDays } from "@/lib/dates";
import { useApi } from "@/lib/client/api";
import { fmtDay, fmtDelta, fmtNum, fmtWeight, STATUS_LABEL } from "@/lib/client/format";
import type { DailyPointDto, TodayDto } from "@/lib/client/types";

const mean = (xs: (number | null)[]): number | null => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
};

/** Coloured dot beside a label (the colour is the fixed meaning; the text stays in text colours). */
const Dot = ({ color }: { color: RingColor }) => <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: colorVar(color) }} />;

function DashboardSkeleton() {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">Loading dashboard…</span>
      <div className="space-y-2"><Skeleton className="h-9 w-1/2 !rounded-xl" /><Skeleton className="h-4 w-3/4 !rounded-lg" /></div>
      <Skeleton className="h-24" />
      <Skeleton className="h-48" />
      <Skeleton className="h-56" />
      <div className="grid grid-cols-2 gap-3"><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
    </div>
  );
}

export default function DashboardPage() {
  const today = useApi<TodayDto>("/api/today");
  const to = today.data?.today;
  const analytics = useApi<AnalyticsDto>(to ? `/api/analytics?from=${addDays(to, -27)}&to=${to}` : null);

  const streaks = useApi<AnalyticsDto>(to ? `/api/analytics?from=${addDays(to, -89)}&to=${to}` : null);
  const streakData = streaks.data && streaks.data.days ? streaks.data : null;

  if (today.loading && !today.data) return <DashboardSkeleton />;
  if (!today.data) return <ErrorState message={today.error ?? "I couldn't load your dashboard. Check your connection."} onRetry={() => void today.refresh()} />;

  const { weeklyDays, goal, trend, recovery, dietQuality: dq, consistency, profile } = today.data;
  const units = profile.unitSystem;
  const week: DailyPointDto[] = weeklyDays;
  const avgCal = mean(week.map((d) => d.calories));
  const avgProtein = mean(week.map((d) => d.protein));
  const avgSteps = mean(week.map((d) => d.steps));
  const avgSleep = mean(week.map((d) => d.sleepH));
  const workouts = week.filter((d) => d.trainingMin > 0 || d.volume > 0).length;
  const weighIns = week.filter((d) => d.weightKg != null).length;
  const adh = analytics.data?.adherence;
  const err = today.error ?? analytics.error;

  return (
    <div className="space-y-4">
      <PageHeader title="Dashboard" subtitle="Your week at a glance. Patterns over days matter far more than any single day." />
      {err && <Notice tone="warn">{err}</Notice>}

      <RecapLink />

      {/* Consistency + weekly habit dot matrix */}
      <section className="card rise space-y-5" aria-labelledby="cons-h" style={{ ["--i" as string]: 2 }}>
        <h2 id="cons-h" className="sr-only">Consistency and habits</h2>
        {consistency ? (
          <ConsistencyRing score={consistency.score} label={consistency.label} />
        ) : (
          <p className="text-sm text-muted">Set a goal in Settings and I&apos;ll show a gentle weekly consistency score here.</p>
        )}
        <div>
          <h3 className="eyebrow mb-1">Habits, last 7 days</h3>
          <HabitGrid days={week} goal={goal} />
        </div>
        <p className="text-xs text-muted">A missed day just counts as a missed day. It never wipes out your progress.</p>
      </section>

      {/* Forgiving streaks */}
      {streakData ? (
        <StreaksCard days={streakData.days} today={streakData.to} targets={streakData.targets && { protein: streakData.targets.protein, steps: streakData.targets.steps }} plannedPerWeek={today.data.workout?.plan.daysPerWeek ?? null} />
      ) : (
        <section className="card" aria-labelledby="streaks-h">
          <h2 id="streaks-h" className="display mb-3 text-lg font-extrabold">Streaks</h2>
          {streaks.error && !streaks.loading ? (
            <ErrorState message={streaks.error} onRetry={() => void streaks.refresh()} />
          ) : (
            <LoadingBlock label="Loading streaks" rows={2} />
          )}
        </section>
      )}

      {/* Week at a glance: bento of averages, then two single-measure charts */}
      <section aria-labelledby="week-h" className="space-y-3">
        <h2 id="week-h" className="display text-lg font-extrabold">Week at a glance</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Stat index={0} label="Avg calories (est.)" icon={<Dot color="cal" />} value={avgCal == null ? "—" : <>{fmtNum(avgCal)}<span className="ml-1 text-sm font-medium text-muted">kcal</span></>} sub={goal ? `Target ${fmtNum(goal.calorieTarget)}. Logged days only.` : "Logged days only"} />
          <Stat index={1} label="Avg protein" icon={<Dot color="protein" />} value={avgProtein == null ? "—" : <>{fmtNum(avgProtein)}<span className="ml-1 text-sm font-medium text-muted">g</span></>} sub={goal ? `Target ${fmtNum(goal.proteinTargetG)} g` : undefined} />
          <Stat index={2} label="Avg steps" icon={<Dot color="steps" />} value={avgSteps == null ? "—" : fmtNum(avgSteps)} sub={goal ? `Target ${fmtNum(goal.stepTarget)}` : undefined} />
          <Stat index={3} label="Avg sleep" icon={<Dot color="sleep" />} value={avgSleep == null ? "—" : <>{fmtNum(avgSleep, 1)}<span className="ml-1 text-sm font-medium text-muted">h</span></>} sub={goal ? `Target ${fmtNum(goal.sleepTargetH, 1)} h` : undefined} />
          <Stat index={4} label="Workouts" value={`${workouts}`} sub="Days trained this week" />
          <Stat index={5} label="Weigh-ins" value={<>{weighIns}<span className="ml-1 text-sm font-medium text-muted">of 7</span></>} sub="Days weighed this week" />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <DayBars days={week} field="calories" target={goal?.calorieTarget ?? null} unit="kcal" title="Calories vs target (estimates)" color={chartColors.cal} note="Calories are estimates from the food you logged." />
          <DayBars days={week} field="protein" target={goal?.proteinTargetG ?? null} unit="g" title="Protein vs target" color={chartColors.protein} />
        </div>
      </section>

      {/* 28-day adherence + weekly buckets */}
      <section className="card rise space-y-4" aria-labelledby="adh-h">
        <div>
          <h2 id="adh-h" className="display text-lg font-extrabold">Last 4 weeks</h2>
          <p className="mt-1 text-sm text-muted">Share of days you hit each habit. A “good” number here is whatever you can keep doing, not 100%.</p>
        </div>
        {analytics.loading && !analytics.data ? (
          <LoadingBlock label="Loading 4-week summary" rows={1} />
        ) : adh ? (
          <>
            <dl className="grid gap-4 sm:grid-cols-2">
              {([
                ["Days with food logged", adh.loggingPct],
                ["Days within calorie target", adh.calorieTargetPct],
                ["Days near protein target", adh.proteinTargetPct],
                ["Days near step target", adh.stepTargetPct],
              ] as const).map(([label, v]) => (
                <div key={label}>
                  <div className="mb-1.5 flex items-baseline justify-between text-sm">
                    <dt className="font-medium">{label}</dt>
                    <dd className="num !text-base">{v == null ? "—" : `${v}%`}</dd>
                  </div>
                  <ProgressBar value={v ?? 0} max={100} label={`${label}: ${v == null ? "no data" : `${v}%`}`} />
                </div>
              ))}
            </dl>
            <details className="text-sm">
              <summary className="cursor-pointer py-1.5 text-muted hover:text-fg">Weekly averages as a table</summary>
              <div className="mt-2 overflow-x-auto rounded-2xl border border-border">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <caption className="sr-only">Weekly averages (weeks start Monday; the first and last may be partial)</caption>
                  <thead>
                    <tr className="bg-surface-2 text-muted">
                      <th scope="col" className="px-3 py-2 font-medium">Week of</th>
                      <th scope="col" className="px-2 py-2 font-medium">Calories (est.)</th>
                      <th scope="col" className="px-2 py-2 font-medium">Protein</th>
                      <th scope="col" className="px-2 py-2 font-medium">Steps</th>
                      <th scope="col" className="px-2 py-2 font-medium">Sleep</th>
                      <th scope="col" className="px-2 py-2 font-medium">Workouts</th>
                      <th scope="col" className="px-2 py-2 font-medium">Weight avg change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.data!.weekly.map((w) => (
                      <tr key={w.week} className="border-t border-border tabular-nums">
                        <th scope="row" className="px-3 py-2 font-medium">{fmtDay(w.week, { day: "numeric", month: "short" })}</th>
                        <td className="px-2 py-2">{fmtNum(w.avgCalories)}</td>
                        <td className="px-2 py-2">{w.avgProtein == null ? "—" : `${fmtNum(w.avgProtein)} g`}</td>
                        <td className="px-2 py-2">{fmtNum(w.avgSteps)}</td>
                        <td className="px-2 py-2">{w.avgSleep == null ? "—" : `${fmtNum(w.avgSleep, 1)} h`}</td>
                        <td className="px-2 py-2">{w.sessions}</td>
                        <td className="px-2 py-2">{fmtDelta(w.weightChange, units)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-1.5 text-xs text-muted">Weeks start Monday; the first and last may be partial.</p>
            </details>
          </>
        ) : (
          <ErrorState message={analytics.error ?? "I couldn't load the 4-week summary."} onRetry={() => void analytics.refresh()} />
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <RecoveryCard recovery={recovery} week={week} sleepTargetH={goal?.sleepTargetH ?? null} />
        <DietQualityCard dq={dq} />
      </div>

      {/* Trend + calorie suggestion */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="tile rise space-y-3" aria-labelledby="tr-h">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="tr-h" className="display text-lg font-extrabold">Weight trend</h2>
            <Badge tone={STATUS_TONE[trend.status]}>{STATUS_LABEL[trend.status]}</Badge>
          </div>
          <p className="text-sm leading-relaxed">{trend.note}</p>
          <dl className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-surface-2 px-3 py-2.5"><dt className="text-[11px] font-semibold text-muted">7-day avg</dt><dd className="num mt-1 !text-base">{fmtWeight(trend.ma7, units)}</dd></div>
            <div className="rounded-2xl bg-surface-2 px-3 py-2.5"><dt className="text-[11px] font-semibold text-muted">14-day avg</dt><dd className="num mt-1 !text-base">{fmtWeight(trend.ma14, units)}</dd></div>
            <div className="rounded-2xl bg-surface-2 px-3 py-2.5"><dt className="text-[11px] font-semibold text-muted">Weekly rate</dt><dd className="num mt-1 !text-base">{trend.weeklyRateKg == null ? "—" : `${fmtDelta(trend.weeklyRateKg, units, 2)}/wk`}</dd></div>
          </dl>
          <p className="text-xs text-muted">Single weigh-ins mostly reflect water, so the averages and the 14-day trend lead here. <Link href="/weight" className="font-semibold text-brand underline">See the full weight page</Link>.</p>
        </section>
        <CalorieAdviceCard advice={today.data.calorieAdvice} />
      </div>
    </div>
  );
}
