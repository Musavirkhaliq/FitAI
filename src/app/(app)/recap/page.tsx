"use client";
import { useMemo, useState } from "react";
import type { AnalyticsDto } from "@/components/analytics/types";
import { buildRecap, type RecapTargets } from "@/components/recap/compute";
import { RecapStory } from "@/components/recap/RecapStory";
import type { WorkoutsDto } from "@/components/workouts/types";
import { ErrorState, Notice, PageHeader, Skeleton } from "@/components/ui";
import { useApi } from "@/lib/client/api";
import { fmtDay, todayLocal } from "@/lib/client/format";
import type { TodayDto } from "@/lib/client/types";
import { addDays } from "@/lib/dates";

/** Shaped like the story: a header, one big card with the next one peeking, and the page dots. */
function RecapSkeleton() {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">Gathering your week…</span>
      <div className="space-y-2"><Skeleton className="h-9 w-3/4 !rounded-xl" /><Skeleton className="h-4 w-1/3 !rounded-lg" /></div>
      <div className="-mx-4 flex gap-3 overflow-hidden px-4">
        <Skeleton className="h-[28rem] w-[88%] shrink-0 !rounded-[2rem]" />
        <Skeleton className="h-[28rem] w-[88%] shrink-0 !rounded-[2rem]" />
      </div>
    </div>
  );
}

/** "Your week, wrapped": a swipeable story of the last 7 days, compared with the 7 before. Cached by useApi, so it works offline. */
export default function RecapPage() {
  const [today] = useState(todayLocal);
  const from = addDays(today, -6);
  const cur = useApi<AnalyticsDto>(`/api/analytics?from=${from}&to=${today}`);
  const prev = useApi<AnalyticsDto>(`/api/analytics?from=${addDays(today, -13)}&to=${addDays(today, -7)}`);
  const wk = useApi<WorkoutsDto>("/api/workouts");
  const td = useApi<TodayDto>("/api/today");

  const units = td.data?.profile.unitSystem ?? "METRIC";

  const recap = useMemo(() => {
    if (!cur.data) return null;
    const goal = td.data?.goal;
    const targets: RecapTargets | null = cur.data.targets ?? (goal ? { calories: goal.calorieTarget, protein: goal.proteinTargetG, steps: goal.stepTarget, sleepH: goal.sleepTargetH } : null);
    return buildRecap({ from, to: today, days: cur.data.days, prevDays: prev.data?.days ?? null, targets, prs: wk.data?.prs ?? [], plannedSessions: wk.data?.profile.trainDaysPerWeek ?? 3 });
  }, [cur.data, prev.data, wk.data, td.data, from, today]);

  if (cur.loading && !cur.data) return <RecapSkeleton />;
  if (!cur.data || !recap) return <ErrorState message={cur.error ?? "I couldn't gather your week. Check your connection."} onRetry={() => void cur.refresh()} />;

  return (
    <div className="space-y-4">
      <PageHeader title="Your week, wrapped" subtitle={`${fmtDay(from, { day: "numeric", month: "short" })} to ${fmtDay(today, { day: "numeric", month: "short" })}`} />
      {cur.error && <Notice tone="warn">{cur.error}</Notice>}
      <RecapStory recap={recap} units={units} name={td.data?.user?.name ?? null} />
    </div>
  );
}
