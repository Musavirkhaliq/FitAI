"use client";
import { BarChart3, ChevronRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { HabitsVsWeightChart } from "@/components/analytics/DriverChart";
import { AdherenceTiles, CorrelationPanel, PrList } from "@/components/analytics/Insights";
import { presetRange, RangePicker, type Range } from "@/components/analytics/RangePicker";
import { FrequencyStrengthChart, StrengthChart, VolumeChart } from "@/components/analytics/TrainingCharts";
import type { AnalyticsDto, Granularity } from "@/components/analytics/types";
import { fmtRange } from "@/components/analytics/util";
import { WaistChart, WeightTrendChart } from "@/components/analytics/WeightCharts";
import type { ProfileDto, WorkoutsDto } from "@/components/workouts/types";
import { EmptyState, ErrorState, Field, Notice, PageHeader, Segmented, Skeleton, haptic } from "@/components/ui";
import { useApi } from "@/lib/client/api";
import { todayLocal } from "@/lib/client/format";
import { daysBetween } from "@/lib/dates";

/** Skeleton shaped like the final layout. */
function AnalyticsSkeleton() {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">Crunching your numbers…</span>
      <Skeleton className="h-36" />
      <Skeleton className="h-72" />
      <div className="grid grid-cols-2 gap-3"><Skeleton className="h-44" /><Skeleton className="h-44" /></div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [today] = useState(todayLocal);
  const [range, setRange] = useState<Range>(() => presetRange("90", todayLocal()));
  const [granPick, setGranPick] = useState<Granularity | null>(null);
  const [exPick, setExPick] = useState<string | null>(null);

  const { data, error, loading, refresh } = useApi<AnalyticsDto>(`/api/analytics?from=${range.from}&to=${range.to}`);
  const wk = useApi<WorkoutsDto>("/api/workouts");
  const prof = useApi<ProfileDto>("/api/profile");
  const units = prof.data?.profile.unitSystem ?? "METRIC";

  const picker = <RangePicker range={range} today={today} onChange={setRange} />;
  const head = <PageHeader title="Analytics" subtitle={data ? `${fmtRange(data.from, data.to)}. Trends over time, not single days.` : "Trends over time, not single days."} />;

  if (loading && !data) return <div className="space-y-4">{head}{picker}<AnalyticsSkeleton /></div>;
  if (!data) {
    return (
      <div className="space-y-4">
        {head}
        {picker}
        <ErrorState message={error ?? "I couldn't load your analytics. Check your connection."} onRetry={() => void refresh()} />
      </div>
    );
  }

  const hasAny = data.days.some((d) => d.calories != null || d.weightKg != null || d.steps != null || d.sleepH != null || d.volume > 0);
  const gran: Granularity = granPick ?? (daysBetween(data.from, data.to) <= 45 ? "daily" : "weekly");

  // Default lift: the one with the most sessions inside the range.
  const inRange = data.strength.map((s) => ({ s, n: s.points.filter((p) => p.date >= data.from && p.date <= data.to).length }));
  const defaultEx = inRange.reduce<{ s: AnalyticsDto["strength"][number]; n: number } | null>((best, c) => (!best || c.n > best.n ? c : best), null)?.s.exercise;
  const exercise = exPick && data.strength.some((s) => s.exercise === exPick) ? exPick : defaultEx;
  const series = data.strength.find((s) => s.exercise === exercise);

  return (
    <div className="space-y-6">
      {head}
      <div className="-mt-2 space-y-3">
        {picker}
        <Link
          href="/recap"
          onClick={() => haptic()}
          className="press rise flex min-h-[64px] items-center gap-3 rounded-[1.5rem] border border-brand/30 px-4"
          style={{ background: "linear-gradient(135deg, rgb(var(--brand-a) / 0.16), rgb(var(--brand-b) / 0.06)), rgb(var(--surface))", ["--i" as string]: 1 }}
        >
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-brand-fg" style={{ background: "var(--btn-bg)" }}><Sparkles className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="display block font-bold leading-tight">Your week, wrapped</span>
            <span className="block text-sm text-muted">A quick story of the last 7 days</span>
          </span>
          <ChevronRight className="h-5 w-5 text-muted" aria-hidden />
        </Link>
      </div>
      {error && <Notice tone="warn">{error}</Notice>}

      {!hasAny ? (
        <EmptyState
          icon={<BarChart3 className="h-8 w-8" />}
          title="Nothing to chart in this range yet"
          body="Log meals, a weigh-in, steps, sleep or a workout and your trends will build up here. Try a longer range, or just tell the coach what you did today."
        />
      ) : (
        <>
          <WeightTrendChart series={data.weightSeries} units={units} />
          <AdherenceTiles adherence={data.adherence} />

          <section className="space-y-3" aria-labelledby="drv-h">
            <div className="rise flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h2 id="drv-h" className="display text-xl font-extrabold">Habits and weight</h2>
                <p className="text-sm text-muted">Each habit has its own panel on a shared timeline, so nothing is squeezed onto a second axis.</p>
              </div>
              <Segmented label="Chart detail" value={gran} onChange={setGranPick} options={[{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }]} />
            </div>
            <HabitsVsWeightChart gran={gran} days={data.days} weekly={data.weekly} weightSeries={data.weightSeries} units={units} targets={data.targets} correlations={data.correlations} />
            <CorrelationPanel c={data.correlations} />
          </section>

          <section className="space-y-3" aria-labelledby="str-h">
            <div className="rise flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h2 id="str-h" className="display text-xl font-extrabold">Training and strength</h2>
                <p className="text-sm text-muted">Strength is estimated from your logged sets.</p>
              </div>
              {data.strength.length > 0 && exercise && (
                <div className="w-full sm:w-64">
                  <Field label="Exercise" htmlFor="ex-pick">
                    <select id="ex-pick" className="input" value={exercise} onChange={(e) => setExPick(e.target.value)}>
                      {data.strength.map((s) => <option key={s.exercise} value={s.exercise}>{s.exercise}</option>)}
                    </select>
                  </Field>
                </div>
              )}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <FrequencyStrengthChart weekly={data.weekly} series={series} from={data.from} to={data.to} units={units} correlation={data.correlations.sessionsVsVolume} />
              <StrengthChart series={series} from={data.from} to={data.to} units={units} />
              <VolumeChart weekly={data.weekly} units={units} />
              <WaistChart waist={data.waist} units={units} />
            </div>
          </section>

          <PrList prs={wk.data?.prs ?? []} units={units} />
        </>
      )}
    </div>
  );
}
