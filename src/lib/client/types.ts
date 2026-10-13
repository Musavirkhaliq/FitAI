/** JSON shapes returned by the API (dates arrive as ISO strings). Keep in sync with src/app/api/*. */

export type MealType = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";
export type Confidence = "HIGH" | "MEDIUM" | "LOW";
export type GoalType = "FAT_LOSS" | "MUSCLE_GAIN" | "STRENGTH" | "RECOMP" | "MAINTAIN";
export type TrendStatus = "FAST_LOSS" | "TARGET_LOSS" | "SLOW_LOSS" | "PLATEAU" | "GAINING" | "INSUFFICIENT_DATA";

export interface FoodEntryDto {
  id: string;
  date: string;
  meal: MealType;
  food: string;
  quantity: number;
  unit: string;
  grams: number | null;
  prep: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  confidence: Confidence;
  estimateMin: number;
  estimateMax: number;
  assumptions: string[];
  uncertaintySources: string[];
  notes: string | null;
  source: string;
  createdAt: string;
}

export interface TotalsDto {
  calories: number; protein: number; carbs: number; fat: number; fiber: number; sodium: number; minKcal: number; maxKcal: number;
}

export interface TargetsDto { calories: number; proteinG: number; fiberG: number; steps: number; sleepH: number; waterMl: number }

export interface DaySummaryDto {
  date: string;
  weight: { kg: number; time: string | null } | null;
  sleep: { hours: number; quality: number | null } | null;
  meals: { meal: MealType; entries: FoodEntryDto[]; totals: TotalsDto }[];
  totals: TotalsDto;
  activity: { steps: number; trainingMin: number; entries: { id: string; type: string; steps: number | null; durationMin: number | null; notes: string | null }[] };
  water: number;
  vegServings: number;
  fruitServings: number;
  targets: TargetsDto | null;
  remaining: { calories: number; proteinG: number } | null;
  /** Estimates, never facts. */
  expenditure: { mid: number; low: number; high: number } | null;
  deficit: { mid: number; low: number; high: number } | null;
}

export interface TrendDto {
  status: TrendStatus;
  latest: { date: string; weightKg: number } | null;
  changeFromYesterdayKg: number | null;
  changeFromStartKg: number | null;
  ma7: number | null;
  ma14: number | null;
  ma30: number | null;
  weeklyRateKg: number | null;
  monthlyChangeKg: number | null;
  weeklyRatePct: number | null;
  sustainedFastLoss: boolean;
  spanDays: number;
  daysOfData: number;
  note: string;
}

export interface CalorieAdviceDto {
  action: "WAIT" | "KEEP" | "DECREASE" | "INCREASE" | "RECHECK_TDEE";
  deltaKcal: number;
  suggestedTarget: number;
  reason: string;
  isSuggestion: true;
  blockedByFloor: boolean;
}

export interface DailyPointDto {
  date: string; calories: number | null; protein: number | null; fiber: number | null; steps: number | null;
  sleepH: number | null; weightKg: number | null; trainingMin: number; volume: number; hardSets: number;
}

export interface TodayDto {
  date: string;
  today: string;
  user: { name: string | null; email: string } | null;
  profile: { onboarded: boolean; unitSystem: "METRIC" | "IMPERIAL"; ttsEnabled: boolean; timezone: string; sex: "FEMALE" | "MALE" | null; heightCm: number | null; startWeightKg: number | null };
  goal: { type: GoalType; targetWeightKg: number | null; calorieTarget: number; proteinTargetG: number; fiberTargetG: number; stepTarget: number; sleepTargetH: number; waterTargetMl: number } | null;
  summary: DaySummaryDto;
  yesterdayWeightKg: number | null;
  trend: TrendDto;
  workout: { plan: { id: string; name: string; daysPerWeek: number }; day: { id: string; name: string; focus: string; dayIndex: number }; completedToday: boolean; exerciseCount: number; deloadSuggested: boolean; inProgress: boolean } | null;
  coachNote: string;
  nutritionSuggestion: { text: string; approx: { kcal: number; protein: number } | null } | null;
  dietQuality: { text: string; avgProtein: number; avgFiber: number; vegPerDay: number; fruitPerDay: number } | null;
  consistency: { score: number; label: string; adherence: number } | null;
  calorieAdvice: CalorieAdviceDto | null;
  recovery: { avgSleepH: number | null; sleepConsistencySdH: number | null; trainingDays: number; restDays: number; avgSteps: number | null; notes: string[] };
  weeklyDays: DailyPointDto[];
}
