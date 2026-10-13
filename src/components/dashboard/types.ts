import type { DailyPointDto } from "@/lib/client/types";

/** Subset of GET /api/analytics used by the dashboard. */
export interface WeeklyBucketDto {
  week: string;
  avgCalories: number | null;
  avgProtein: number | null;
  avgSteps: number | null;
  avgSleep: number | null;
  sessions: number;
  weightAvg: number | null;
  weightChange: number | null;
}

export interface AnalyticsDto {
  from: string;
  to: string;
  /** One row per day in [from, to], oldest first. */
  days: DailyPointDto[];
  weekly: WeeklyBucketDto[];
  adherence: { loggingPct: number; calorieTargetPct: number | null; proteinTargetPct: number | null; stepTargetPct: number | null };
  targets: { calories: number; protein: number; steps: number; sleepH: number } | null;
}
