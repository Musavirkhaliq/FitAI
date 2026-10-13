"use client";
import { Dumbbell, Trophy } from "lucide-react";
import Link from "next/link";
import { PrList } from "@/components/progress/PrList";
import { ProgressPhotos } from "@/components/progress/ProgressPhotos";
import { StrengthChart } from "@/components/progress/StrengthChart";
import type { WorkoutsDto } from "@/components/progress/types";
import { VolumeBars } from "@/components/progress/VolumeBars";
import { AnimatedNumber, ErrorState, LoadingBlock, Notice, PageHeader, Ring, Skeleton, Tile } from "@/components/ui";
import { BodyFatEstimate } from "@/components/weight/BodyFatEstimate";
import { Stat } from "@/components/weight/Stat";
import { fmtWeightRange, toDisplay, unitLabel } from "@/components/weight/trend";
import type { WeightDto } from "@/components/weight/types";
import { WaistChart } from "@/components/weight/WaistChart";
import { useApi } from "@/lib/client/api";
import { fmtNum, fmtWeight } from "@/lib/client/format";
import type { TodayDto } from "@/lib/client/types";

const fmt1 = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function ProgressPage() {
  const workouts = useApi<WorkoutsDto>("/api/workouts");
  const weight = useApi<WeightDto>("/api/weight?days=180");
  const today = useApi<TodayDto>("/api/today");

  const units = today.data?.profile.unitSystem ?? "METRIC";
  const unit = unitLabel(units);
  const w = workouts.data;
  const wt = weight.data;
  const offline = workouts.error ?? weight.error ?? today.error;

  const waists = wt?.measurements.filter((m) => m.waistCm != null) ?? [];
  const waistFirst = waists[0]?.waistCm ?? null;
  const waistLast = waists[waists.length - 1]?.waistCm ?? null;
  const ma7 = wt?.trend.ma7 ?? null;
  const startKg = wt?.startWeightKg ?? null;
  const targetKg = wt?.targetWeightKg ?? null;
  // Compare the 7-day average (not one morning) with the start weight.
  const sinceStart = ma7 != null && startKg != null ? ma7 - startKg : wt?.trend.changeFromStartKg ?? null;
  const completed = w?.sessions.filter((s) => s.status === "COMPLETED").length ?? 0;
  // Share of the way from the start weight to the target that the 7-day average has covered.
  const journey = startKg != null && targetKg != null && ma7 != null && Math.abs(startKg - targetKg) > 0.5
    ? Math.max(0, Math.min(1, (startKg - ma7) / (startKg - targetKg)))
    : null;
  const changeDisplay = sinceStart != null ? toDisplay(Math.abs(sinceStart), units) : null;
  const sign = sinceStart == null || changeDisplay == null || changeDisplay < 0.05 ? "" : sinceStart < 0 ? "−" : "+";

  return (
    <div className="space-y-5">
      <PageHeader title="Progress" subtitle="Where you started, where you are, and how your training is building. Progress is rarely a straight line." />
      {offline && <Notice tone="warn">{offline}</Notice>}

      {/* Journey hero: start → now */}
      <section aria-labelledby="sn-h" className="space-y-3">
        <h2 id="sn-h" className="sr-only">Start to now</h2>
        {weight.loading && !wt ? (
          <div role="status" aria-live="polite" className="space-y-3">
            <span className="sr-only">Loading summary…</span>
            <Skeleton className="h-60" />
            <div className="grid grid-cols-2 gap-3"><Skeleton className="col-span-2 h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
          </div>
        ) : (
          <>
            <Tile className="!p-5" style={{ background: "linear-gradient(155deg, rgb(var(--brand-a) / 0.15), rgb(var(--brand-b) / 0.05) 55%), rgb(var(--surface))" }}>
              <p className="eyebrow">Your journey so far</p>
              <div className="mt-3 flex items-center gap-4">
                {journey != null && (
                  <div role="img" aria-label={`${Math.round(journey * 100)} percent of the way from your start weight to your target, by 7-day average`}>
                    <Ring ratio={journey} size={116} stroke={12} color="brand">
                      <span className="text-center leading-none">
                        <span className="num block text-[1.5rem]"><AnimatedNumber value={Math.round(journey * 100)} fromZero />%</span>
                        <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">to target</span>
                      </span>
                    </Ring>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="eyebrow">Weight change</p>
                  {changeDisplay == null ? (
                    <p className="num mt-1 text-[2.6rem]">—</p>
                  ) : (
                    <p className="num mt-1 flex items-baseline gap-1 text-[3rem] leading-none">
                      {sign && <span className="text-[1.8rem]">{sign}</span>}
                      <AnimatedNumber value={changeDisplay} format={fmt1} fromZero />
                      <span className="text-base font-semibold text-muted">{unit}</span>
                    </p>
                  )}
                  <p className="mt-1.5 text-sm text-muted">
                    {sinceStart == null
                      ? "Log a few weigh-ins and your journey will show up here."
                      : changeDisplay != null && changeDisplay < 0.05
                        ? "Steady since you started. Steady is a fine place to build from."
                        : sinceStart < 0
                          ? "Down since you started, by 7-day average."
                          : "Up since you started, by 7-day average. Averages smooth the daily noise."}
                  </p>
                </div>
              </div>

              {(startKg != null || waistLast != null) && (
                <dl className="mt-4 flex flex-wrap gap-2">
                  {startKg != null && (
                    <div className="rounded-full bg-surface-2 px-3.5 py-1.5 text-sm">
                      <dt className="inline text-muted">Start → now </dt>
                      <dd className="inline font-bold">{fmtWeight(startKg, units)} → {fmtWeight(ma7, units)}</dd>
                    </div>
                  )}
                  {waistLast != null && (
                    <div className="rounded-full bg-surface-2 px-3.5 py-1.5 text-sm">
                      <dt className="inline text-muted">Waist </dt>
                      <dd className="inline font-bold">{waists.length > 1 && waistFirst != null ? `${fmtNum(waistFirst, 1)} → ${fmtNum(waistLast, 1)} cm` : `${fmtNum(waistLast, 1)} cm`}</dd>
                    </div>
                  )}
                </dl>
              )}
            </Tile>

            <div className="grid grid-cols-2 gap-3">
              {wt?.fatLostEstimate && (
                <Stat
                  index={1}
                  span={2}
                  label="Fat lost so far (est.)"
                  value={`≈ ${fmtWeightRange(wt.fatLostEstimate.lowKg, wt.fatLostEstimate.highKg, units)}`}
                  sub="An estimate, shown as a range: roughly 60–90% of lost weight is fat, the rest is water and lean tissue."
                />
              )}
              <Stat
                index={2}
                label="Workouts done"
                icon={<Dumbbell className="h-3.5 w-3.5" aria-hidden />}
                value={<AnimatedNumber value={completed} fromZero />}
                sub={completed > 0 ? "In the last 60 days. Each one counts." : "Last 60 days. Your first one is a good day."}
              />
              <Stat
                index={3}
                label="Personal records"
                icon={<Trophy className="h-3.5 w-3.5" aria-hidden />}
                value={w ? <AnimatedNumber value={w.prs.length} fromZero /> : "—"}
                sub="New bests, by estimated 1RM"
              />
            </div>
          </>
        )}
      </section>

      {/* Personal records */}
      <section aria-labelledby="pr-h" className="space-y-2">
        <h2 id="pr-h" className="display text-lg font-extrabold">Personal records</h2>
        {workouts.loading && !w ? <LoadingBlock label="Loading records" rows={1} /> : w ? <PrList prs={w.prs} units={units} /> : <ErrorState message={workouts.error ?? "I couldn't load your workouts."} onRetry={() => void workouts.refresh()} />}
      </section>

      {/* Strength progression */}
      <section aria-labelledby="st-h" className="space-y-2">
        <h2 id="st-h" className="display text-lg font-extrabold">Strength progression</h2>
        {workouts.loading && !w ? <LoadingBlock label="Loading strength" rows={2} /> : w ? <StrengthChart strength={w.strength} units={units} /> : <ErrorState message={workouts.error ?? "I couldn't load your workouts."} onRetry={() => void workouts.refresh()} />}
      </section>

      {/* Weekly volume vs landmarks */}
      <section className="card rise space-y-4" aria-labelledby="vol-h">
        <div>
          <h2 id="vol-h" className="display text-lg font-extrabold">Weekly volume vs landmarks</h2>
          <p className="mt-1 text-sm text-muted">Hard sets per muscle in the last 7 days, against a productive zone.</p>
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer py-1.5 text-muted hover:text-fg">What do minimum and maximum mean?</summary>
            <p className="mt-1 text-muted">
              MEV (minimum effective volume) is about the fewest sets that usually still drive progress; MRV (maximum recoverable volume) is about the most you can recover from. Between the two, the shaded zone, is the sweet spot.
            </p>
          </details>
        </div>
        {workouts.loading && !w ? <LoadingBlock label="Loading volume" rows={2} /> : w ? <VolumeBars volume={w.volume} /> : null}
        {w && w.volume.length === 0 && (
          <Link href="/workouts" className="btn btn-primary w-fit">Go to workouts</Link>
        )}
      </section>

      {/* Body progress */}
      <section className="card rise space-y-4" aria-labelledby="body-h">
        <h2 id="body-h" className="display text-lg font-extrabold">Body progress</h2>
        {weight.loading && !wt ? (
          <LoadingBlock label="Loading body progress" rows={2} />
        ) : wt ? (
          <>
            <p className="text-sm">
              {sinceStart != null
                ? <>Your 7-day average is <span className="font-semibold">{sign}{fmt1(changeDisplay ?? 0)} {unit}</span> from where you started. </>
                : "Once you have a week of weigh-ins, your change from the start will show here. "}
              <span className="text-muted">Daily weight bounces around; the averages are the honest picture.</span>
            </p>
            <WaistChart measurements={wt.measurements} />
            <BodyFatEstimate bodyFat={wt.bodyFat} date={wt.bodyFatDate} fatLost={null} units={units} />
            {wt.measurements.length === 0 && (
              <p className="text-sm text-muted">No measurements logged yet. <Link href="/weight" className="font-semibold text-brand underline">Add waist and neck measurements</Link> to see a waist trend and a body-fat range.</p>
            )}
          </>
        ) : (
          <ErrorState message={weight.error ?? "I couldn't load your body data."} onRetry={() => void weight.refresh()} />
        )}
      </section>

      <ProgressPhotos />
    </div>
  );
}
