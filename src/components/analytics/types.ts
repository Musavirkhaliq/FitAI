import type { DailyPointDto } from "@/lib/client/types";

/** JSON shape of GET /api/analytics (weights in kg, waist in cm). */
export interface WeeklyDto {
  week: string;
  avgCalories: number | null;
  avgProtein: number | null;
  avgSteps: number | null;
  avgSleep: number | null;
  sessions: number;
  volume: number;
  weightAvg: number | null;
  weightChange: number | null;
}

export interface WeightPointDto { date: string; weight: number; ma7: number | null; ma14: number | null }
export interface StrengthSeriesDto { exercise: string; points: { date: string; est1rm: number }[] }

export interface CorrelationsDto {
  caloriesVsWeightChange: number | null;
  proteinVsWeightChange: number | null;
  stepsVsWeightChange: number | null;
  sleepVsWeightChange: number | null;
  sessionsVsVolume: number | null;
  note: string;
}

export interface AnalyticsDto {
  from: string;
  to: string;
  days: DailyPointDto[];
  weekly: WeeklyDto[];
  weightSeries: WeightPointDto[];
  waist: { date: string; waistCm: number | null }[];
  strength: StrengthSeriesDto[];
  correlations: CorrelationsDto;
  adherence: { loggingPct: number; calorieTargetPct: number | null; proteinTargetPct: number | null; stepTargetPct: number | null };
  targets: { calories: number; protein: number; steps: number; sleepH: number } | null;
}

export type Granularity = "daily" | "weekly";
