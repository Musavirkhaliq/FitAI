import { z, type ZodType, type ZodTypeDef } from "zod";

export const INTENTS = [
  "log_meal", "log_food", "log_weight", "log_steps", "log_workout", "log_gym_session", "log_sleep", "log_cycling",
  "log_water", "log_body_measurement", "log_note", "create_workout_plan", "modify_workout_plan", "get_todays_workout",
  "log_workout_set", "create_meal_plan", "get_meal_recommendation", "check_meal", "calorie_budget", "protein_target",
  "daily_summary", "weekly_summary", "monthly_summary", "progress_analysis", "why_weight_changed", "weight_trend",
  "body_fat_estimate", "goal_update", "preference_update", "export_data", "edit_entry", "delete_entry",
  "general_fitness_question",
  // Extras the voice experience needs:
  "workout_command", "food_substitution", "chitchat",
] as const;
export type Intent = (typeof INTENTS)[number];

/** Intents that write records. */
export const LOGGING_INTENTS = new Set<Intent>([
  "log_meal", "log_food", "log_weight", "log_steps", "log_workout", "log_gym_session", "log_sleep", "log_cycling",
  "log_water", "log_body_measurement", "log_note", "log_workout_set",
]);

export const classificationSchema = z.object({
  intents: z
    .array(
      z.object({
        intent: z.enum(INTENTS).catch("general_fitness_question"),
        confidence: z.number().min(0).max(1).catch(0.5),
        /** The part of the user's message this intent covers. */
        text: z.string().catch(""),
      }),
    )
    .min(1),
  clarifyingQuestion: z.string().nullish().catch(undefined),
});
export type Classification = z.infer<typeof classificationSchema>;

/** A section the model got wrong should not sink the whole extraction. */
const lenient = <T>(s: ZodType<T, ZodTypeDef, unknown>) => s.nullish().catch(undefined) as unknown as ZodType<T | null | undefined, ZodTypeDef, unknown>;
const num = z.number().finite();

const foodSchema = z.object({
  name: z.string().min(1),
  quantity: num.positive().catch(1),
  unit: z.string().catch("serving"),
  prep: z.string().nullish().catch(undefined),
  meal: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]).nullish().catch(undefined),
  state: z.enum(["RAW", "COOKED"]).nullish().catch(undefined),
  boneIn: z.boolean().nullish().catch(undefined),
  measured: z.boolean().nullish().catch(undefined),
  restaurant: z.boolean().nullish().catch(undefined),
});

export const extractionSchema = z.object({
  dateOffsetDays: z.number().int().min(-30).max(0).catch(0),
  /** "log on the higher side" → true. */
  conservative: z.boolean().nullish().catch(undefined),
  foods: lenient(z.array(foodSchema).max(30)),
  mealType: lenient(z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"])),
  weight: lenient(z.object({ value: num.positive(), unit: z.enum(["kg", "lb"]).catch("kg") })),
  steps: lenient(num.int().min(0).max(100_000)),
  sleepHours: lenient(num.min(0.5).max(18)),
  waterMl: lenient(num.min(50).max(10_000)),
  activities: lenient(
    z.array(
      z.object({
        type: z.enum(["GYM", "CYCLING", "WALKING", "RUNNING", "OTHER"]).catch("OTHER"),
        durationMin: num.nullish().catch(undefined),
        distanceKm: num.nullish().catch(undefined),
        intensity: z.enum(["LIGHT", "MODERATE", "HARD"]).nullish().catch(undefined),
        notes: z.string().nullish().catch(undefined),
      }),
    ),
  ),
  sets: lenient(
    z.array(
      z.object({
        exercise: z.string().nullish().catch(undefined),
        reps: num.int().positive(),
        weight: num.min(0),
        unit: z.enum(["kg", "lb"]).catch("kg"),
        rpe: num.min(1).max(10).nullish().catch(undefined),
        setNumber: num.int().positive().nullish().catch(undefined),
      }),
    ),
  ),
  measurement: lenient(
    z.object({
      waistCm: num.nullish().catch(undefined),
      neckCm: num.nullish().catch(undefined),
      hipCm: num.nullish().catch(undefined),
      bodyFatPct: num.nullish().catch(undefined),
    }),
  ),
  note: lenient(z.string().max(1000)),
  goal: lenient(
    z.object({
      calorieTarget: num.int().nullish().catch(undefined),
      proteinTargetG: num.int().nullish().catch(undefined),
      stepTarget: num.int().nullish().catch(undefined),
      targetWeightKg: num.nullish().catch(undefined),
      type: z.enum(["FAT_LOSS", "MUSCLE_GAIN", "STRENGTH", "RECOMP", "MAINTAIN"]).nullish().catch(undefined),
    }),
  ),
  preferences: lenient(
    z.array(
      z.object({
        category: z.enum(["GOAL", "IDENTITY", "LIFESTYLE", "PREFERENCE", "EVENT", "HEALTH_HISTORY", "MOOD"]).catch("PREFERENCE"),
        key: z.string().min(1),
        value: z.string().min(1),
      }),
    ),
  ),
  workoutPlan: lenient(
    z.object({
      goal: z.enum(["FAT_LOSS", "MUSCLE_GAIN", "STRENGTH", "RECOMP", "MAINTAIN"]).nullish().catch(undefined),
      experience: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]).nullish().catch(undefined),
      daysPerWeek: num.int().min(1).max(7).nullish().catch(undefined),
      sessionMinutes: num.int().nullish().catch(undefined),
      equipment: z.enum(["FULL_GYM", "DUMBBELLS", "HOME", "BODYWEIGHT"]).nullish().catch(undefined),
      injuries: z.string().nullish().catch(undefined),
      replaceExercise: z.string().nullish().catch(undefined),
    }),
  ),
  mealQuery: lenient(z.object({ caloriesLeft: num.nullish().catch(undefined), proteinLeft: num.nullish().catch(undefined), useFavourites: z.boolean().nullish().catch(undefined) })),
  substitution: lenient(z.object({ removeFood: z.string(), grams: num.nullish().catch(undefined) })),
  workoutCommand: lenient(z.object({ action: z.enum(["START_REST_TIMER", "SKIP_EXERCISE", "ADD_SET"]), seconds: num.nullish().catch(undefined) })),
  edit: lenient(z.object({ action: z.enum(["EDIT", "DELETE"]), kind: z.enum(["food", "weight", "activity", "sleep", "set"]).catch("food"), nameHint: z.string().nullish().catch(undefined), newQuantity: num.nullish().catch(undefined) })),
  exportRequest: lenient(z.object({ kind: z.enum(["nutrition", "weight", "activity", "workouts", "measurements"]).catch("nutrition"), format: z.enum(["csv", "xlsx", "pdf"]).catch("csv") })),
  /** For summaries: how many periods back (0 = current, 1 = previous). */
  periodOffset: z.number().int().min(0).max(24).catch(0),
});
export type Extraction = z.infer<typeof extractionSchema>;
export type ExtractedFood = z.infer<typeof foodSchema>;
