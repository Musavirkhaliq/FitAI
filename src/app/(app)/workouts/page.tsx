"use client";
import { Dumbbell } from "lucide-react";
import { PlanGenerator } from "@/components/workouts/PlanGenerator";
import { PlanView } from "@/components/workouts/PlanView";
import { RecentSessions } from "@/components/workouts/RecentSessions";
import { TodayCard } from "@/components/workouts/TodayCard";
import type { ProfileDto, WorkoutsDto } from "@/components/workouts/types";
import { VolumeSummary } from "@/components/workouts/VolumeSummary";
import { EmptyState, ErrorState, LoadingBlock, Notice, PageHeader } from "@/components/ui";
import { useApi } from "@/lib/client/api";

export default function WorkoutsPage() {
  const { data, error, loading, refresh } = useApi<WorkoutsDto>("/api/workouts");
  const { data: prof } = useApi<ProfileDto>("/api/profile");

  if (loading && !data) return <LoadingBlock label="Loading workouts" rows={4} />;
  if (!data) return <ErrorState message={error ?? "I couldn't load your workouts. Check your connection."} onRetry={() => void refresh()} />;

  const units = prof?.profile.unitSystem ?? "METRIC";

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
          body="Answer a few quick questions below and I'll build a plan that fits your week, equipment and experience. You can also just say “create me a 4-day gym plan”."
        />
      )}

      <PlanGenerator profile={data.profile} goal={prof?.goal?.type ?? null} hasPlan={!!data.plan} onDone={() => void refresh()} />

      {data.plan && <PlanView plan={data.plan} todayDayId={data.today?.day.id} onChanged={() => void refresh()} />}

      <div className="grid gap-5 lg:grid-cols-2">
        <VolumeSummary rows={data.volume} />
        <RecentSessions sessions={data.sessions} units={units} />
      </div>
    </div>
  );
}
