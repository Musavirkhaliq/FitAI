"use client";
import { Dumbbell } from "lucide-react";
import { PlanGenerator } from "@/components/workouts/PlanGenerator";
import { PlanView } from "@/components/workouts/PlanView";
import { RecentSessions } from "@/components/workouts/RecentSessions";
import { TodayCard } from "@/components/workouts/TodayCard";
import type { ProfileDto, WorkoutsDto } from "@/components/workouts/types";
import { VolumeSummary } from "@/components/workouts/VolumeSummary";
import { EmptyState, ErrorState, Notice, PageHeader, Skeleton } from "@/components/ui";
import { useApi } from "@/lib/client/api";

/** Skeleton shaped like the final layout, so nothing jumps when data arrives. */
function WorkoutsSkeleton() {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">Loading workouts…</span>
      <div className="space-y-2"><Skeleton className="h-9 w-1/2 !rounded-xl" /><Skeleton className="h-4 w-3/4 !rounded-lg" /></div>
      <Skeleton className="h-[26rem] !rounded-[2rem]" />
      <Skeleton className="h-20" />
      <Skeleton className="h-20" />
      <Skeleton className="h-48" />
    </div>
  );
}

export default function WorkoutsPage() {
  const { data, error, loading, refresh } = useApi<WorkoutsDto>("/api/workouts");
  const { data: prof } = useApi<ProfileDto>("/api/profile");

  if (loading && !data) return <WorkoutsSkeleton />;
  if (!data) return <ErrorState message={error ?? "I couldn't load your workouts. Check your connection."} onRetry={() => void refresh()} />;

  const units = prof?.profile.unitSystem ?? "METRIC";
  const generator = (variant?: "primary" | "compact") => (
    <PlanGenerator profile={data.profile} goal={prof?.goal?.type ?? null} hasPlan={!!data.plan} variant={variant} onDone={() => void refresh()} />
  );

  return (
    <div className="space-y-5">
      <PageHeader title="Workouts" subtitle="Your plan, today's session and how your training volume is looking." />
      {error && <Notice tone="warn">{error}</Notice>}

      {data.today ? (
        <TodayCard today={data.today} units={units} />
      ) : (
        <EmptyState
          icon={<Dumbbell className="h-8 w-8" />}
          title="No workout plan yet"
          body="Answer a few quick questions and I'll build a plan that fits your week, equipment and experience. You can also just say “create me a 4-day gym plan”."
          action={<div className="w-full min-w-[15rem]">{generator("primary")}</div>}
        />
      )}

      {data.plan && <PlanView plan={data.plan} todayDayId={data.today?.day.id} onChanged={() => void refresh()} action={generator("compact")} />}

      <div className="grid gap-5 lg:grid-cols-2">
        <VolumeSummary rows={data.volume} />
        <RecentSessions sessions={data.sessions} units={units} />
      </div>
    </div>
  );
}
