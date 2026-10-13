import type { CalorieAdviceDto, TrendDto } from "@/lib/client/types";

/** Shape of GET /api/weight (dates are YYYY-MM-DD strings, weights are kg). */
export interface WeightEntryDto {
  id: string;
  date: string;
  weightKg: number;
  time: string | null;
  conditions: string | null;
}

export interface MeasurementDto {
  id: string;
  date: string;
  waistCm: number | null;
  neckCm: number | null;
  hipCm: number | null;
  bodyFatPct: number | null;
  notes: string | null;
}

export interface BodyFatDto {
  low: number;
  mid: number;
  high: number;
  fatMassKg: { low: number; high: number };
  leanMassKg: { low: number; high: number };
  method: string;
}

export interface SeriesPointDto {
  date: string;
  weight: number;
  ma7: number | null;
  ma14: number | null;
}

export interface WeightDto {
  series: SeriesPointDto[];
  trend: TrendDto;
  entries: WeightEntryDto[];
  measurements: MeasurementDto[];
  bodyFat: BodyFatDto | null;
  bodyFatDate: string | null;
  fatLostEstimate: { lowKg: number; highKg: number } | null;
  startWeightKg: number | null;
  targetWeightKg: number | null;
  calorieAdvice: CalorieAdviceDto | null;
  protocol: string;
}
