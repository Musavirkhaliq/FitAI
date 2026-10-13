import type { UnitSystem } from "@/lib/client/format";
import type { GoalType } from "@/lib/client/types";

export type ReminderKey = "weighIn" | "workout" | "protein" | "steps" | "sleep" | "weeklyReview";

/** GET /api/profile → profile (Prisma UserProfile as JSON). Only the fields these screens use. */
export interface ProfileDto {
  onboarded: boolean;
  sex: "FEMALE" | "MALE" | null;
  birthYear: number | null;
  heightCm: number | null;
  startWeightKg: number | null;
  activityLevel: number;
  unitSystem: UnitSystem;
  timezone: string;
  experience: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  trainDaysPerWeek: number;
  sessionMinutes: number;
  equipment: string;
  injuries: string | null;
  foodsAvoided: string[];
  mealsPerDay: number;
  conservativeEstimates: boolean;
  ttsEnabled: boolean;
  reminders: Partial<Record<ReminderKey, boolean>>;
}

export interface GoalDto {
  type: GoalType;
  targetWeightKg: number | null;
  calorieTarget: number;
  proteinTargetG: number;
  fiberTargetG: number;
  stepTarget: number;
  sleepTargetH: number;
  waterTargetMl: number;
}

export interface ProfileResponse {
  user: { name: string | null; email: string } | null;
  profile: ProfileDto;
  goal: GoalDto | null;
}

/** PATCH /api/profile body (mirrors its zod schema). */
export interface ProfilePatch {
  name?: string;
  sex?: "FEMALE" | "MALE" | null;
  birthYear?: number | null;
  heightCm?: number | null;
  unitSystem?: UnitSystem;
  timezone?: string;
  experience?: ProfileDto["experience"];
  trainDaysPerWeek?: number;
  sessionMinutes?: number;
  equipment?: string;
  injuries?: string | null;
  foodsAvoided?: string[];
  mealsPerDay?: number;
  conservativeEstimates?: boolean;
  ttsEnabled?: boolean;
  activityLevel?: number;
  reminders?: Partial<Record<ReminderKey, boolean>>;
  goal?: Partial<{
    calorieTarget: number; proteinTargetG: number; fiberTargetG: number; stepTarget: number; sleepTargetH: number;
    waterTargetMl: number; targetWeightKg: number; type: GoalType;
  }>;
}

export type MemoryCategory = "GOAL" | "IDENTITY" | "LIFESTYLE" | "PREFERENCE" | "EVENT" | "HEALTH_HISTORY" | "MOOD";

export interface MemoryDto {
  id: string;
  category: MemoryCategory;
  key: string;
  value: string;
  source: "EXPLICIT" | "INFERRED";
  confidence: number;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
}
