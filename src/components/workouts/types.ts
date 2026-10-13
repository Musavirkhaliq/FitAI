/** JSON shapes of GET /api/workouts (dates arrive as ISO strings; weights are kg). */
import type { UnitSystem } from "@/lib/client/format";

export type Equipment = "FULL_GYM" | "DUMBBELLS" | "HOME" | "BODYWEIGHT";
export type Experience = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
export type PlanGoal = "FAT_LOSS" | "MUSCLE_GAIN" | "STRENGTH" | "RECOMP" | "MAINTAIN";

export interface SetResultDto { weightKg: number; reps: number; rpe?: number | null }

export interface PrescriptionDto {
  weightKg: number | null;
  targetReps: number[];
  deload: boolean;
  reason: string;
  text: string;
}

export interface ExerciseBriefDto {
  id: string;
  name: string;
  muscleGroup: string;
  sets: number;
  repMin: number;
  repMax: number;
  restSec: number;
  targetRpe: number;
  technique: string;
  progression: string;
  previous: { date: string; sets: SetResultDto[] } | null;
  prescription: PrescriptionDto;
}

export interface SessionSetDto {
  id: string;
  exerciseName: string;
  exerciseId?: string | null;
  setNumber: number;
  reps: number;
  weightKg: number;
  rpe: number | null;
}

export interface PlanExerciseDto {
  id: string;
  order: number;
  name: string;
  muscleGroup: string;
  sets: number;
  repMin: number;
  repMax: number;
  restSec: number;
  targetRpe: number;
  technique: string;
  progression: string;
}

export interface PlanDayDto { id: string; name: string; focus: string; dayIndex: number; exercises: PlanExerciseDto[] }
export interface PlanDto { id: string; name: string; daysPerWeek: number; days: PlanDayDto[] }

export interface TodayWorkoutDto {
  plan: { id: string; name: string; daysPerWeek: number };
  day: { id: string; name: string; focus: string; dayIndex: number };
  exercises: ExerciseBriefDto[];
  completedToday: boolean;
  inProgress: { id: string; startedAt: string; sets: SessionSetDto[] } | null;
  deloadSuggested: boolean;
  lastSessionDate: string | null;
}

export type VolumeStatusDto = "BELOW_MEV" | "PRODUCTIVE" | "NEAR_MRV" | "OVER_MRV";
export interface VolumeRowDto { muscle: string; hardSets: number; status: VolumeStatusDto; mev: number; mrv: number }

export interface SessionRowDto {
  id: string;
  date: string;
  status: "IN_PROGRESS" | "COMPLETED" | "SKIPPED";
  durationMin: number | null;
  day: { name: string } | null;
  sets: { volume: number }[];
}

export interface PrDto { id: string; date: string; title: string; data: { est1rm?: number } | null }

export interface WorkoutsDto {
  today: TodayWorkoutDto | null;
  plan: PlanDto | null;
  volume: VolumeRowDto[];
  sessions: SessionRowDto[];
  strength: { exercise: string; points: { date: string; est1rm: number }[] }[];
  prs: PrDto[];
  profile: { equipment: Equipment; experience: Experience; trainDaysPerWeek: number; sessionMinutes: number; injuries: string | null };
}

/** The slice of GET /api/profile these screens need. */
export interface ProfileDto {
  profile: { unitSystem: UnitSystem };
  goal: { type: PlanGoal } | null;
}
