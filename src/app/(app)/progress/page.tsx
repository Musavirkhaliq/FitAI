"use client";
import Link from "next/link";
import { PrList } from "@/components/progress/PrList";
import { StrengthChart } from "@/components/progress/StrengthChart";
import type { WorkoutsDto } from "@/components/progress/types";
import { VolumeBars } from "@/components/progress/VolumeBars";
import { Notice, ErrorState, LoadingBlock, PageHeader } from "@/components/ui";
import { BodyFatEstimate } from "@/components/weight/BodyFatEstimate";
import { Stat } from "@/components/weight/Stat";
import type { WeightDto } from "@/components/weight/types";
import { WaistChart } from "@/components/weight/WaistChart";
import { useApi } from "@/lib/client/api";
import { fmtDelta, fmtNum, fmtWeight } from "@/lib/client/format";
import type { TodayDto } from "@/lib/client/types";

export default function ProgressPage() {
  const workouts = useApi<WorkoutsDto>("/api/workouts");
  const weight = useApi<WeightDto>("/api/weight?days=180");
  const today = useApi<TodayDto>("/api/today");

  const units = today.data?.profile.unitSystem ?? "METRIC";
  const w = workouts.data;
  const wt = weight.data;
  const offline = workouts.error ?? weight.error ?? today.error;

  const waists = wt?.measurements.filter((m) => m.waistCm != null) ?? [];
  const waistFirst = waists[0]?.waistCm ?? null;
  const waistLast = waists[waists.length - 1]?.waistCm ?? null;
  const ma7 = wt?.trend.ma7 ?? null;
  const startKg = wt?.startWeightKg ?? null;
  // Compare the 7-day average (not one morning) with the start weight.
  const sinceStart = ma7 != null && startKg != null ? ma7 - startKg : wt?.trend.changeFromStartKg ?? null;
  const completed = w?.sessions.filter((s) => s.status === "COMPLETED").length ?? 0;
  const consistency = today.data?.consistency;

  return (
    <div className="space-y-5">
      <PageHeader title="Progress" subtitle="Where you started, where you are, and how your training is building. Progress is rarely a straight line." />
      {offline && <Notice tone="warn">{offline}</Notice>}

      {/* Start → now */}
      <section aria-labelledby="sn-h" className="space-y-3">
        <h2 id="sn-h" className="text-sm font-semibold">Start → now</h2>
        {weight.loading && !wt ? (
          <LoadingBlock label="Loading summary" rows={1} />
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat
              label="Weight"
              value={startKg != null && ma7 != null ? `${fmtWeight(startKg, units)} → ${fmtWeight(ma7, units)}` : fmtWeight(ma7, units)}
              sub={sinceStart != null ? `${fmtDelta(sinceStart, units)} (7-day average vs start)` : "Log weigh-ins to see this"}
            />
            <Stat
              label="Waist"
              value={waistFirst != null && waistLast != null && waists.length > 1 ? `${fmtNum(waistFirst, 1)} → ${fmtNum(waistLast, 1)} cm` : waistLast != null ? `${fmtNum(waistLast, 1)} cm` : "—"}
              sub={waists.length > 1 ? "Last 180 days" : "Add two readings for a trend"}
            />
            <Stat label="Workouts done" value={String(completed)} sub="Last 60 days" />
            <Stat label="Consistency" value={consistency ? `${consistency.score}/100` : "—"} sub={consistency ? `${consistency.label} this week` : "Set a goal to track this"} />
          </div>
        )}
      </section>

      {/* Personal records */}
      <section className="card" aria-labelledby="pr-h">
        <h2 id="pr-h" className="mb-2 text-sm font-semibold">Personal records</h2>
        {workouts.loading && !w ? <LoadingBlock label="Loading records" rows={2} /> : w ? <PrList prs={w.prs} units={units} /> : <ErrorState message={workouts.error ?? "I couldn't load your workouts."} onRetry={() => void workouts.refresh()} />}
      </section>

      {/* Strength progression */}
      <section aria-labelledby="st-h" className="space-y-2">
        <h2 id="st-h" className="text-sm font-semibold">Strength progression</h2>
        {workouts.loading && !w ? <LoadingBlock label="Loading strength" rows={2} /> : w ? <StrengthChart strength={w.strength} units={units} /> : <ErrorState message={workouts.error ?? "I couldn't load your workouts."} onRetry={() => void workouts.refresh()} />}
      </section>

      {/* Weekly volume vs landmarks */}
      <section className="card space-y-3" aria-labelledby="vol-h">
        <div>
          <h2 id="vol-h" className="text-sm font-semibold">Weekly volume vs landmarks</h2>
          <p className="text-sm text-muted">
            Hard sets per muscle in the last 7 days. MEV (minimum effective volume) is about the fewest sets that usually still drive progress; MRV (maximum recoverable volume) is about the most you can recover from. Between the two is the sweet spot.
          </p>
        </div>
        {workouts.loading && !w ? <LoadingBlock label="Loading volume" rows={2} /> : w ? <VolumeBars volume={w.volume} /> : null}
        {w && w.volume.length === 0 && (
          <Link href="/workouts" className="btn btn-primary w-fit">Go to workouts</Link>
        )}
      </section>

      {/* Body progress */}
      <section className="card space-y-4" aria-labelledby="body-h">
        <h2 id="body-h" className="text-sm font-semibold">Body progress</h2>
        {weight.loading && !wt ? (
          <LoadingBlock label="Loading body progress" rows={2} />
        ) : wt ? (
          <>
            <p className="text-sm">
              {sinceStart != null
                ? <>Your 7-day average is <span className="font-semibold">{fmtDelta(sinceStart, units)}</span> from where you started. </>
                : "Once you have a week of weigh-ins, your change from the start will show here. "}
              <span className="text-muted">Daily weight bounces around; the averages are the honest picture.</span>
            </p>
            <WaistChart measurements={wt.measurements} />
            <BodyFatEstimate bodyFat={wt.bodyFat} date={wt.bodyFatDate} fatLost={wt.fatLostEstimate} units={units} />
            {wt.measurements.length === 0 && (
              <p className="text-sm text-muted">No measurements logged yet. <Link href="/weight" className="text-brand underline">Add waist and neck measurements</Link> to see a waist trend and a body-fat range.</p>
            )}
          </>
        ) : (
          <ErrorState message={weight.error ?? "I couldn't load your body data."} onRetry={() => void weight.refresh()} />
        )}
      </section>
    </div>
  );
}
