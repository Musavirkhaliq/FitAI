import { fmtNum, kgToLb, lbToKg, type UnitSystem } from "@/lib/client/format";
import type { GoalType } from "@/lib/client/types";

export type Sex = "FEMALE" | "MALE";
export type Activity = "sedentary" | "light" | "moderate" | "active";
export type Equipment = "FULL_GYM" | "DUMBBELLS" | "HOME" | "BODYWEIGHT";
export type Experience = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

/** Raw answers exactly as typed (strings for anything the user types), so editing never loses input. */
export interface Answers {
  unitSystem: UnitSystem;
  name: string;
  sex: Sex | null;
  birthYear: string;
  heightCm: string;
  heightFt: string;
  heightIn: string;
  weight: string;
  targetWeight: string;
  goal: GoalType | null;
  activity: Activity | null;
  trainDays: number;
  sessionMinutes: string;
  equipment: Equipment | null;
  experience: Experience | null;
  injuries: string;
  foods: string;
  mealsPerDay: number;
}

export const EMPTY_ANSWERS: Answers = {
  unitSystem: "METRIC", name: "", sex: null, birthYear: "", heightCm: "", heightFt: "", heightIn: "", weight: "", targetWeight: "",
  goal: null, activity: null, trainDays: 3, sessionMinutes: "60", equipment: null, experience: null, injuries: "", foods: "", mealsPerDay: 3,
};

export type StepId =
  | "units" | "name" | "sex" | "birthYear" | "height" | "weight" | "targetWeight" | "goal" | "activity"
  | "trainDays" | "sessionMinutes" | "equipment" | "experience" | "injuries" | "foods" | "mealsPerDay";

export const STEPS: StepId[] = [
  "units", "name", "sex", "birthYear", "height", "weight", "targetWeight", "goal", "activity",
  "trainDays", "sessionMinutes", "equipment", "experience", "injuries", "foods", "mealsPerDay",
];

export interface Option<T extends string> { value: T; label: string; description?: string }

export const UNIT_OPTIONS: Option<UnitSystem>[] = [
  { value: "METRIC", label: "Metric", description: "Kilograms and centimetres" },
  { value: "IMPERIAL", label: "Imperial", description: "Pounds, feet and inches" },
];
export const SEX_OPTIONS: Option<Sex>[] = [
  { value: "FEMALE", label: "Female" },
  { value: "MALE", label: "Male" },
];
export const GOAL_OPTIONS: Option<GoalType>[] = [
  { value: "FAT_LOSS", label: "Lose body fat", description: "A steady, sustainable calorie deficit" },
  { value: "MUSCLE_GAIN", label: "Build muscle", description: "A small calorie surplus with hard training" },
  { value: "STRENGTH", label: "Get stronger", description: "Lifting heavier over time" },
  { value: "RECOMP", label: "Recomposition", description: "Lose fat and build muscle at the same time" },
  { value: "MAINTAIN", label: "Maintain", description: "Stay where I am and keep healthy habits" },
];
export const ACTIVITY_OPTIONS: Option<Activity>[] = [
  { value: "sedentary", label: "Mostly sitting", description: "Desk job, driving, little walking" },
  { value: "light", label: "Lightly active", description: "On your feet some of the day: teaching, shop work, a daily short walk" },
  { value: "moderate", label: "Moderately active", description: "Moving most of the day: nursing, delivery rounds, regular long walks" },
  { value: "active", label: "Very active", description: "Physical work or lots of walking: building, farming, 15,000+ steps a day" },
];
export const EQUIPMENT_OPTIONS: Option<Equipment>[] = [
  { value: "FULL_GYM", label: "Full gym", description: "Barbells, machines, cables" },
  { value: "DUMBBELLS", label: "Dumbbells", description: "A pair or a set of dumbbells at home" },
  { value: "HOME", label: "Home basics", description: "Bands, a bench, a few weights" },
  { value: "BODYWEIGHT", label: "Bodyweight only", description: "No equipment" },
];
export const EXPERIENCE_OPTIONS: Option<Experience>[] = [
  { value: "BEGINNER", label: "Beginner", description: "New to training, or coming back after a long break" },
  { value: "INTERMEDIATE", label: "Intermediate", description: "Trained regularly for a year or more" },
  { value: "ADVANCED", label: "Advanced", description: "Several years of consistent, structured training" },
];

export const TRAIN_DAY_CHOICES = [2, 3, 4, 5, 6];
export const SESSION_CHOICES = [30, 45, 60, 75, 90, 120];
export const MEAL_CHOICES = [1, 2, 3, 4, 5, 6];
export const FOOD_EXAMPLES = ["Pork", "Beef", "Shellfish", "Fish", "Dairy", "Eggs", "Gluten", "Nuts", "Soy"];

const MIN_AGE = 13;
const MIN_YEAR = 1920;
export const maxBirthYear = () => new Date().getFullYear() - MIN_AGE;

/** Accepts "72,5" as well as "72.5"; returns null for anything that is not a plain number. */
export function parseNum(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (!t || !/^-?\d*\.?\d+$/.test(t)) return null;
  return Number(t);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function weightToKg(text: string, units: UnitSystem): number | null {
  const n = parseNum(text);
  if (n == null) return null;
  return round1(units === "IMPERIAL" ? lbToKg(n) : n);
}

export function heightToCm(a: Answers): number | null {
  if (a.unitSystem === "METRIC") {
    const n = parseNum(a.heightCm);
    return n == null ? null : round1(n);
  }
  const ft = parseNum(a.heightFt);
  const inch = a.heightIn.trim() === "" ? 0 : parseNum(a.heightIn);
  if (ft == null || inch == null) return null;
  return round1(ft * 30.48 + inch * 2.54);
}

export function parseFoods(text: string): string[] {
  const seen = new Set<string>();
  for (const part of text.split(/[,;\n]/)) {
    const t = part.trim();
    if (t) seen.add(t);
  }
  return [...seen];
}

export const weightUnit = (u: UnitSystem) => (u === "IMPERIAL" ? "lb" : "kg");

function weightRangeText(u: UnitSystem) {
  return u === "IMPERIAL" ? `${fmtNum(kgToLb(25))} and ${fmtNum(kgToLb(400))} lb` : "25 and 400 kg";
}

export function question(id: StepId, a: Answers): string {
  switch (id) {
    case "units": return "Which units do you prefer?";
    case "name": return "What should I call you?";
    case "sex": return "Are you female or male?";
    case "birthYear": return "What year were you born?";
    case "height": return "How tall are you?";
    case "weight": return "What's your current weight?";
    case "targetWeight": return "What's your target?";
    case "goal": return a.targetWeight.trim() ? "And what's the main goal?" : "What's your main goal?";
    case "activity": return "How active is a typical day, outside of workouts?";
    case "trainDays": return "How many days a week can you train?";
    case "sessionMinutes": return "How long can each session be?";
    case "equipment": return "What equipment do you have?";
    case "experience": return "How would you describe your training experience?";
    case "injuries": return "Any injuries or limitations?";
    case "foods": return "Any foods you avoid?";
    case "mealsPerDay": return "How many meals a day do you usually eat?";
  }
}

export function help(id: StepId, a: Answers): string | null {
  switch (id) {
    case "units": return "You can change this later in Settings.";
    case "name": return "Optional. Just a first name is fine.";
    case "sex": return "I use this only for the minimum safe calorie level and the formulas that estimate your energy needs.";
    case "birthYear": return "Age is part of the energy estimate. You need to be at least 13.";
    case "height": return a.unitSystem === "IMPERIAL" ? "Feet and inches." : "In centimetres.";
    case "weight": return "Your weight today, as best you know it. It becomes your starting point.";
    case "targetWeight": return "The weight you'd like to reach. Optional: skip it if you don't have a number in mind.";
    case "goal": return "You can change this any time.";
    case "activity": return "Think about a normal day, not the days you train.";
    case "trainDays": return "Pick a number you can keep up. Fewer, consistent sessions beat ambitious ones you skip.";
    case "sessionMinutes": return "Include warm-up. Between 30 and 120 minutes.";
    case "equipment": return "I'll build your plan around what you can actually use.";
    case "experience": return "Be honest. It only affects how much volume I start you on.";
    case "injuries": return "Optional. For example a sore knee or a past shoulder injury. I'll avoid exercises that could aggravate it.";
    case "foods": return "Optional. Separate with commas. I won't suggest these.";
    case "mealsPerDay": return "I'll split your calories and protein across this many meals.";
  }
}

/** Friendly inline error, or null when the answer is fine. */
export function validate(id: StepId, a: Answers): string | null {
  switch (id) {
    case "name":
      return a.name.trim().length > 60 ? "That's a little long. Please use 60 characters or fewer." : null;
    case "sex":
      return a.sex ? null : "Please choose one so I can use the right calorie floor.";
    case "birthYear": {
      const n = parseNum(a.birthYear);
      if (n == null || !Number.isInteger(n)) return "Please enter a four-digit year, like 1990.";
      if (n > maxBirthYear()) return `You need to be at least ${MIN_AGE} to use this app. That means a birth year of ${maxBirthYear()} or earlier.`;
      if (n < MIN_YEAR) return `Please enter a year from ${MIN_YEAR} onward.`;
      return null;
    }
    case "height": {
      const cm = heightToCm(a);
      if (cm == null) return a.unitSystem === "IMPERIAL" ? "Please enter your height in feet and inches, like 5 and 9." : "Please enter your height in centimetres.";
      if (cm < 100 || cm > 250) return "Height should be between 100 and 250 cm (about 3 ft 4 in to 8 ft 2 in). Please check the number.";
      return null;
    }
    case "weight": {
      const kg = weightToKg(a.weight, a.unitSystem);
      if (kg == null) return "Please enter a number, like 72.5.";
      if (kg < 25 || kg > 400) return `Weight should be between ${weightRangeText(a.unitSystem)}. Please check the number.`;
      return null;
    }
    case "targetWeight": {
      if (!a.targetWeight.trim()) return null;
      const kg = weightToKg(a.targetWeight, a.unitSystem);
      if (kg == null) return "Please enter a number, or skip this one.";
      if (kg < 25 || kg > 400) return `Target should be between ${weightRangeText(a.unitSystem)}.`;
      return null;
    }
    case "goal":
      return a.goal ? null : "Please pick the goal that fits best.";
    case "activity":
      return a.activity ? null : "Please pick the closest match.";
    case "sessionMinutes": {
      const n = parseNum(a.sessionMinutes);
      if (n == null || !Number.isInteger(n) || n < 30 || n > 120) return "Session length should be a whole number of minutes from 30 to 120.";
      return null;
    }
    case "equipment":
      return a.equipment ? null : "Please choose what you have.";
    case "experience":
      return a.experience ? null : "Please choose the closest level.";
    case "injuries":
      return a.injuries.length > 300 ? "Please keep this under 300 characters." : null;
    case "foods": {
      const list = parseFoods(a.foods);
      if (list.length > 30) return "That's a long list. Please keep it to 30 foods or fewer.";
      if (list.some((f) => f.length > 40)) return "Each food should be 40 characters or fewer. Use commas between foods.";
      return null;
    }
    default:
      return null;
  }
}

const labelOf = <T extends string>(opts: Option<T>[], v: T | null) => opts.find((o) => o.value === v)?.label ?? "";

/** The user's answer as shown in their chat bubble. */
export function summary(id: StepId, a: Answers): string {
  switch (id) {
    case "units": return labelOf(UNIT_OPTIONS, a.unitSystem);
    case "name": return a.name.trim() || "I'd rather not say";
    case "sex": return labelOf(SEX_OPTIONS, a.sex);
    case "birthYear": return a.birthYear.trim();
    case "height": return a.unitSystem === "IMPERIAL" ? `${a.heightFt.trim()} ft ${a.heightIn.trim() || "0"} in` : `${a.heightCm.trim()} cm`;
    case "weight": return `${a.weight.trim()} ${weightUnit(a.unitSystem)}`;
    case "targetWeight": return a.targetWeight.trim() ? `${a.targetWeight.trim()} ${weightUnit(a.unitSystem)}` : "No target weight";
    case "goal": return labelOf(GOAL_OPTIONS, a.goal);
    case "activity": return labelOf(ACTIVITY_OPTIONS, a.activity);
    case "trainDays": return `${a.trainDays} days a week`;
    case "sessionMinutes": return `${a.sessionMinutes.trim()} minutes`;
    case "equipment": return labelOf(EQUIPMENT_OPTIONS, a.equipment);
    case "experience": return labelOf(EXPERIENCE_OPTIONS, a.experience);
    case "injuries": return a.injuries.trim() || "None";
    case "foods": return parseFoods(a.foods).join(", ") || "Nothing to avoid";
    case "mealsPerDay": return `${a.mealsPerDay} ${a.mealsPerDay === 1 ? "meal" : "meals"} a day`;
  }
}

export interface Overrides { calories?: number; proteinG?: number; steps?: number }

export interface OnboardingPayload {
  sex: Sex;
  birthYear: number;
  heightCm: number;
  weightKg: number;
  targetWeightKg?: number;
  goal: GoalType;
  activity: Activity;
  trainDays: number;
  sessionMinutes: number;
  equipment: Equipment;
  experience: Experience;
  injuries?: string;
  foodsAvoided: string[];
  mealsPerDay: number;
  unitSystem: UnitSystem;
  timezone: string;
}

/** Converts validated answers to the API shape (always kg / cm). Returns null if something is missing. */
export function toPayload(a: Answers): OnboardingPayload | null {
  const heightCm = heightToCm(a);
  const weightKg = weightToKg(a.weight, a.unitSystem);
  const birthYear = parseNum(a.birthYear);
  const session = parseNum(a.sessionMinutes);
  if (!a.sex || !a.goal || !a.activity || !a.equipment || !a.experience || heightCm == null || weightKg == null || birthYear == null || session == null) return null;
  const target = a.targetWeight.trim() ? weightToKg(a.targetWeight, a.unitSystem) : null;
  const injuries = a.injuries.trim();
  return {
    sex: a.sex, birthYear, heightCm, weightKg,
    ...(target != null ? { targetWeightKg: target } : {}),
    goal: a.goal, activity: a.activity, trainDays: a.trainDays, sessionMinutes: session, equipment: a.equipment, experience: a.experience,
    ...(injuries ? { injuries } : {}),
    foodsAvoided: parseFoods(a.foods), mealsPerDay: a.mealsPerDay, unitSystem: a.unitSystem,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  };
}

export interface PreviewDto {
  calories: number; proteinG: number; fiberG: number; steps: number; tdee: number; weeklyRateKg: number; weeksToGoal: number | null;
  warnings: string[]; mealStructure: string; schedule: { name: string; focus: string }[]; note: string;
}

export const calorieFloorFor = (sex: Sex | null) => (sex === "FEMALE" ? 1200 : 1500);
