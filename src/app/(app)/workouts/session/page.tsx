"use client";
import { CheckCircle2, Dumbbell } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ActiveSession } from "@/components/workouts/ActiveSession";
import type { WorkoutsDto } from "@/components/workouts/types";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { useApi } from "@/lib/client/api";
import { todayLocal } from "@/lib/client/format";
import type { TodayDto } from "@/lib/client/types";

/** Shaped like the gym-mode screen, so nothing jumps when the session is ready. */
function SessionSkeleton() {
  return (
    <div role="status" aria-live="polite" className="mx-auto max-w-xl space-y-4">
      <span className="sr-only">Getting your workout ready…</span>
      <Skeleton className="h-11 !rounded-2xl" />
      <div className="space-y-2"><Skeleton className="h-4 w-1/2 !rounded-lg" /><Skeleton className="h-12 w-4/5 !rounded-xl" /></div>
      <Skeleton className="h-32" />
      <Skeleton className="h-20" />
      <Skeleton className="h-20" />
    </div>
  );
}

export default function WorkoutSessionPage() {
  const wk = useApi<WorkoutsDto>("/api/workouts");
  const day = useApi<TodayDto>("/api/today");
  // Once a session has started here, keep the screen mounted even after finishing flips `completedToday`.
  const [engaged, setEngaged] = useState(false);
  const [again, setAgain] = useState(false);

  if ((wk.loading && !wk.data) || (day.loading && !day.data)) return <SessionSkeleton />;
  if (!wk.data) return <ErrorState message={wk.error ?? "I couldn't load your workout. Check your connection."} onRetry={() => void wk.refresh()} />;

  const today = wk.data.today;
  if (!today) {
    return (
      <EmptyState
        icon={<Dumbbell className="h-8 w-8" />}
        title="No workout plan yet"
        body="Create a plan first and today's session will be ready to start."
        action={<Link href="/workouts" className="btn btn-primary !min-h-[56px] px-6">Create a plan</Link>}
      />
    );
  }

  if (today.completedToday && !engaged && !again) {
    return (
      <EmptyState
        icon={<CheckCircle2 className="h-8 w-8 text-good" />}
        title="Today's workout is already done"
        body="Rest is where the gains happen. If you really want a bonus session, you can start another."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/workouts" className="btn btn-primary !min-h-[56px]">Back to workouts</Link>
            <button type="button" className="btn !min-h-[56px]" onClick={() => setAgain(true)}>Start another session</button>
          </div>
        }
      />
    );
  }

  return <ActiveSession today={today} units={day.data?.profile.unitSystem ?? "METRIC"} date={day.data?.date ?? todayLocal()} onEngaged={() => setEngaged(true)} />;
}
