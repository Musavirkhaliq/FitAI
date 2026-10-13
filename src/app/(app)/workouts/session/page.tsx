"use client";
import { CheckCircle2, Dumbbell } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ActiveSession } from "@/components/workouts/ActiveSession";
import type { WorkoutsDto } from "@/components/workouts/types";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui";
import { useApi } from "@/lib/client/api";
import { todayLocal } from "@/lib/client/format";
import type { TodayDto } from "@/lib/client/types";

export default function WorkoutSessionPage() {
  const wk = useApi<WorkoutsDto>("/api/workouts");
  const day = useApi<TodayDto>("/api/today");
  // Once a session has started here, keep the screen mounted even after finishing flips `completedToday`.
  const [engaged, setEngaged] = useState(false);
  const [again, setAgain] = useState(false);

  if ((wk.loading && !wk.data) || (day.loading && !day.data)) return <LoadingBlock label="Getting your workout ready" rows={3} />;
  if (!wk.data) return <ErrorState message={wk.error ?? "I couldn't load your workout. Check your connection."} onRetry={() => void wk.refresh()} />;

  const today = wk.data.today;
  if (!today) {
    return (
      <EmptyState
        icon={<Dumbbell className="h-8 w-8" />}
        title="No workout plan yet"
        body="Create a plan first and today's session will be ready to start."
        action={<Link href="/workouts" className="btn btn-primary">Create a plan</Link>}
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
            <Link href="/workouts" className="btn btn-primary">Back to workouts</Link>
            <button className="btn" onClick={() => setAgain(true)}>Start another session</button>
          </div>
        }
      />
    );
  }

  return <ActiveSession today={today} units={day.data?.profile.unitSystem ?? "METRIC"} date={day.data?.date ?? todayLocal()} onEngaged={() => setEngaged(true)} />;
}
