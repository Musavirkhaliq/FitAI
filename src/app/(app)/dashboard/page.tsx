"use client";
import Link from "next/link";
import { ConsistencyRing } from "@/components/dashboard/ConsistencyRing";
import { DayBars } from "@/components/dashboard/DayBars";
import { HabitGrid } from "@/components/dashboard/HabitGrid";
import type { AnalyticsDto } from "@/components/dashboard/types";
import { Badge, chartColors, ErrorState, LoadingBlock, Notice, PageHeader, ProgressBar } from "@/components/ui";
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

/** One guidance row: value, the suggested range, and a words-first read of where you are. Suggestions, never rules. */
function GuidanceRow({ label, value, unit, lo, hi, dp = 0 }: { label: string; value: number; unit: string; lo: number; hi: number; dp?: number }) {
  const read = value < lo ? `a little under the ${lo}–${hi} suggestion` : value > hi ? `above the ${lo}–${hi} suggestion, which is fine` : `within the ${lo}–${hi} suggestion`;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <dt className="font-medium">{label}</dt>
        <dd className="tabular-nums"><span className="font-semibold">{fmtNum(value, dp)}</span> {unit}</dd>
      </div>
      <ProgressBar value={value} max={hi} label={`${label}: ${fmtNum(value, dp)} ${unit}`} tone={value >= lo ? "good" : "brand"} />
      <p className="mt-0.5 text-xs text-muted">{read}</p>
    </div>
  );
}

export default function DashboardPage() {
  const today = useApi<TodayDto>("/api/today");
  const to = today.data?.today;
  const analytics = useApi<AnalyticsDto>(to ? `/api/analytics?from=${addDays(to, -27)}&to=${to}` : null);

  if (today.loading && !today.data) return <LoadingBlock label="Loading dashboard" rows={4} />;
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
    <div className="space-y-5">
      <PageHeader title="Dashboard" subtitle="Your week at a glance. Patterns over days matter far more than any single day." />
      {err && <Notice tone="warn">{err}</Notice>}

      {/* Consistency + habit grid */}
      <section className="card grid gap-5 lg:grid-cols-2" aria-labelledby="cons-h">
        <div className="space-y-3">
          <h2 id="cons-h" className="text-sm font-semibold">Consistency</h2>
          {consistency ? (
            <ConsistencyRing score={consistency.score} label={consistency.label} />
          ) : (
            <p className="text-sm text-muted">Set a goal in Settings and I&apos;ll show a gentle weekly consistency score here.</p>
          )}
          <p className="text-xs text-muted">There are no streaks to protect. A missed day just counts as a missed day.</p>
        </div>
        <div>
          <h3 className="mb-1 text-sm font-semibold">Habits, last 7 days</h3>
          <HabitGrid days={week} goal={goal} />
        </div>
      </section>

      {/* Week at a glance */}
      <section aria-labelledby="week-h" className="space-y-3">
        <h2 id="week-h" className="text-sm font-semibold">Week at a glance</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Stat label="Avg calories (est.)" value={avgCal == null ? "—" : `${fmtNum(avgCal)} kcal`} sub={goal ? `Target ${fmtNum(goal.calorieTarget)}. From logged days only.` : "From logged days only"} />
          <Stat label="Avg protein" value={avgProtein == null ? "—" : `${fmtNum(avgProtein)} g`} sub={goal ? `Target ${fmtNum(goal.proteinTargetG)} g` : undefined} />
          <Stat label="Avg steps" value={avgSteps == null ? "—" : fmtNum(avgSteps)} sub={goal ? `Target ${fmtNum(goal.stepTarget)}` : undefined} />
          <Stat label="Avg sleep" value={avgSleep == null ? "—" : `${fmtNum(avgSleep, 1)} h`} sub={goal ? `Target ${fmtNum(goal.sleepTargetH, 1)} h` : undefined} />
          <Stat label="Workouts" value={`${workouts}`} sub="Days trained this week" />
          <Stat label="Weigh-ins" value={`${weighIns} of 7`} sub="Days weighed this week" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <DayBars days={week} field="calories" target={goal?.calorieTarget ?? null} unit="kcal" title="Calories vs target (estimates)" color={chartColors.series[1]} note="Calories are estimates from the food you logged." />
          <DayBars days={week} field="protein" target={goal?.proteinTargetG ?? null} unit="g" title="Protein vs target" color={chartColors.brand} />
        </div>
      </section>

      {/* 28-day adherence + weekly buckets */}
      <section className="card space-y-4" aria-labelledby="adh-h">
        <div>
          <h2 id="adh-h" className="text-sm font-semibold">Last 4 weeks</h2>
          <p className="text-xs text-muted">Share of days you hit each habit. A “good” number here is whatever you can keep doing, not 100%.</p>
        </div>
        {analytics.loading && !analytics.data ? (
          <LoadingBlock label="Loading 4-week summary" rows={1} />
        ) : adh ? (
          <>
            <dl className="grid gap-3 sm:grid-cols-2">
              {([
                ["Days with food logged", adh.loggingPct],
                ["Days within calorie target", adh.calorieTargetPct],
                ["Days near protein target", adh.proteinTargetPct],
                ["Days near step target", adh.stepTargetPct],
              ] as const).map(([label, v]) => (
                <div key={label}>
                  <div className="flex items-baseline justify-between text-sm">
                    <dt>{label}</dt>
                    <dd className="font-semibold tabular-nums">{v == null ? "—" : `${v}%`}</dd>
                  </div>
                  <ProgressBar value={v ?? 0} max={100} label={`${label}: ${v == null ? "no data" : `${v}%`}`} />
                </div>
              ))}
            </dl>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-xs">
                <caption className="mb-1 text-left text-xs text-muted">Weekly averages (weeks start Monday; the first and last may be partial)</caption>
                <thead>
                  <tr className="text-muted">
                    <th scope="col" className="py-1 pr-2 font-medium">Week of</th>
                    <th scope="col" className="px-2 py-1 font-medium">Calories (est.)</th>
                    <th scope="col" className="px-2 py-1 font-medium">Protein</th>
                    <th scope="col" className="px-2 py-1 font-medium">Steps</th>
                    <th scope="col" className="px-2 py-1 font-medium">Sleep</th>
                    <th scope="col" className="px-2 py-1 font-medium">Workouts</th>
                    <th scope="col" className="px-2 py-1 font-medium">Weight avg change</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.data!.weekly.map((w) => (
                    <tr key={w.week} className="border-t border-border tabular-nums">
                      <th scope="row" className="py-1.5 pr-2 font-medium">{fmtDay(w.week, { day: "numeric", month: "short" })}</th>
                      <td className="px-2 py-1.5">{fmtNum(w.avgCalories)}</td>
                      <td className="px-2 py-1.5">{w.avgProtein == null ? "—" : `${fmtNum(w.avgProtein)} g`}</td>
                      <td className="px-2 py-1.5">{fmtNum(w.avgSteps)}</td>
                      <td className="px-2 py-1.5">{w.avgSleep == null ? "—" : `${fmtNum(w.avgSleep, 1)} h`}</td>
                      <td className="px-2 py-1.5">{w.sessions}</td>
                      <td className="px-2 py-1.5">{fmtDelta(w.weightChange, units)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <ErrorState message={analytics.error ?? "I couldn't load the 4-week summary."} onRetry={() => void analytics.refresh()} />
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recovery */}
        <section className="card space-y-3" aria-labelledby="rec-h">
          <h2 id="rec-h" className="text-sm font-semibold">Recovery</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted">Sleep average</dt>
              <dd className="font-semibold tabular-nums">{recovery.avgSleepH == null ? "—" : `${fmtNum(recovery.avgSleepH, 1)} h`}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Sleep consistency</dt>
              <dd className="font-semibold tabular-nums">{recovery.sleepConsistencySdH == null ? "Needs 3+ nights" : `±${fmtNum(recovery.sleepConsistencySdH, 1)} h`}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Training days</dt>
              <dd className="font-semibold tabular-nums">{recovery.trainingDays} this week</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Rest days</dt>
              <dd className="font-semibold tabular-nums">{recovery.restDays} this week</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-muted">Average steps</dt>
              <dd className="font-semibold tabular-nums">{recovery.avgSteps == null ? "—" : fmtNum(recovery.avgSteps)}</dd>
            </div>
          </dl>
          {recovery.notes.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {recovery.notes.map((n) => <li key={n}>{n}</li>)}
            </ul>
          ) : (
            <p className="text-sm text-muted">Log your sleep and I&apos;ll add a recovery note here.</p>
          )}
          <p className="text-xs text-muted">Sleep consistency is how much your nightly hours vary (lower is steadier). These are suggestions, not rules.</p>
        </section>

        {/* Diet quality */}
        <section className="card space-y-3" aria-labelledby="dq-h">
          <h2 id="dq-h" className="text-sm font-semibold">Diet quality</h2>
          {dq ? (
            <>
              <p className="text-sm">{dq.text}</p>
              <dl className="space-y-3">
                <GuidanceRow label="Vegetables" value={dq.vegPerDay} unit="servings/day" lo={2} hi={3} dp={1} />
                <GuidanceRow label="Fruit" value={dq.fruitPerDay} unit="servings/day" lo={1} hi={2} dp={1} />
                <GuidanceRow label="Fibre" value={dq.avgFiber} unit="g/day" lo={25} hi={35} />
              </dl>
              <p className="text-xs text-muted">Rough guidance: 200–300 g of vegetables (about 2–3 servings), 1–2 pieces of fruit and 25–35 g of fibre a day. Averages over the last 7 days; all are suggestions, and rice, potatoes and bread are welcome.</p>
            </>
          ) : (
            <p className="text-sm text-muted">Log food on at least 3 days this week and I&apos;ll share a quick read on protein, vegetables, fruit and fibre.</p>
          )}
        </section>
      </div>

      {/* Trend + calorie suggestion */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-3" aria-labelledby="tr-h">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="tr-h" className="text-sm font-semibold">Weight trend</h2>
            <Badge tone={STATUS_TONE[trend.status]}>{STATUS_LABEL[trend.status]}</Badge>
          </div>
          <p className="text-sm">{trend.note}</p>
          <dl className="grid grid-cols-3 gap-2 text-sm">
            <div><dt className="text-xs text-muted">7-day avg</dt><dd className="font-semibold tabular-nums">{fmtWeight(trend.ma7, units)}</dd></div>
            <div><dt className="text-xs text-muted">14-day avg</dt><dd className="font-semibold tabular-nums">{fmtWeight(trend.ma14, units)}</dd></div>
            <div><dt className="text-xs text-muted">Weekly rate</dt><dd className="font-semibold tabular-nums">{trend.weeklyRateKg == null ? "—" : `${fmtDelta(trend.weeklyRateKg, units, 2)}/wk`}</dd></div>
          </dl>
          <p className="text-xs text-muted">Single weigh-ins mostly reflect water, so the averages and the 14-day trend lead here. <Link href="/weight" className="text-brand underline">See the full weight page</Link>.</p>
        </section>
        <CalorieAdviceCard advice={today.data.calorieAdvice} />
      </div>
    </div>
  );
}
