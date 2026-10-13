export type Equipment = "FULL_GYM" | "DUMBBELLS" | "HOME" | "BODYWEIGHT";
export type PlanGoal = "FAT_LOSS" | "MUSCLE_GAIN" | "STRENGTH" | "RECOMP" | "MAINTAIN";
export type Level = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export interface PlanRequest {
  goal: PlanGoal;
  experience: Level;
  daysPerWeek: number; // 2–6
  sessionMinutes: number; // 30–120
  equipment: Equipment;
  injuries?: string | null;
}

export interface PlanExercise {
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

export interface PlanDayOut {
  name: string;
  focus: string;
  exercises: PlanExercise[];
}

export interface GeneratedPlan {
  name: string;
  days: PlanDayOut[];
  notes: string[];
}

interface Lift {
  name: string;
  muscle: string;
  compound: boolean;
  equip: Equipment[]; // equipment tiers where this lift is available
  tip: string;
  /** Injury keywords this lift commonly aggravates. */
  stress?: string[];
  incrementKg?: number;
}

const ALL: Equipment[] = ["FULL_GYM", "DUMBBELLS", "HOME", "BODYWEIGHT"];
const GYM_DB: Equipment[] = ["FULL_GYM", "DUMBBELLS"];
const GYM_ONLY: Equipment[] = ["FULL_GYM"];
const GYM_DB_HOME: Equipment[] = ["FULL_GYM", "DUMBBELLS", "HOME"];

export const LIBRARY: Lift[] = [
  // chest
  { name: "Barbell Bench Press", muscle: "chest", compound: true, equip: GYM_ONLY, tip: "Shoulder blades pinched back, feet planted, lower to mid-chest under control.", stress: ["shoulder"] },
  { name: "Dumbbell Bench Press", muscle: "chest", compound: true, equip: GYM_DB_HOME, tip: "Elbows about 45° from the torso; full stretch at the bottom, no bouncing.", stress: ["shoulder"] },
  { name: "Incline Dumbbell Press", muscle: "chest", compound: true, equip: GYM_DB_HOME, tip: "Bench at 30°, press up and slightly in; keep wrists stacked over elbows.", stress: ["shoulder"] },
  { name: "Cable Fly", muscle: "chest", compound: false, equip: GYM_ONLY, tip: "Soft elbow bend, think 'hug a tree', squeeze at the centre." },
  { name: "Push-Up", muscle: "chest", compound: true, equip: ALL, tip: "Body in a straight line, chest to the floor, elbows ~45°.", stress: ["wrist", "shoulder"] },
  // back
  { name: "Lat Pulldown", muscle: "back", compound: true, equip: GYM_ONLY, tip: "Lead with elbows, pull to upper chest, don't swing." },
  { name: "Pull-Up", muscle: "back", compound: true, equip: ["FULL_GYM", "HOME", "BODYWEIGHT"], tip: "Start from a dead hang, chest to bar, control the way down.", stress: ["shoulder", "elbow"] },
  { name: "Barbell Row", muscle: "back", compound: true, equip: GYM_ONLY, tip: "Hinge to ~45°, neutral spine, pull to the lower ribs.", stress: ["back"] },
  { name: "One-Arm Dumbbell Row", muscle: "back", compound: true, equip: GYM_DB_HOME, tip: "Brace on a bench, pull the elbow to the hip, pause at the top." },
  { name: "Seated Cable Row", muscle: "back", compound: true, equip: GYM_ONLY, tip: "Chest tall, squeeze shoulder blades, don't rock." },
  { name: "Inverted Row", muscle: "back", compound: true, equip: ["HOME", "BODYWEIGHT"], tip: "Body rigid, pull chest to the bar or table edge." },
  // quads / hamstrings / glutes
  { name: "Back Squat", muscle: "quads", compound: true, equip: GYM_ONLY, tip: "Brace, knees track over toes, hit comfortable depth.", stress: ["knee", "back"], incrementKg: 2.5 },
  { name: "Goblet Squat", muscle: "quads", compound: true, equip: GYM_DB_HOME, tip: "Hold the weight at the chest, elbows inside knees, sit between your hips.", stress: ["knee"] },
  { name: "Leg Press", muscle: "quads", compound: true, equip: GYM_ONLY, tip: "Feet shoulder width, don't let the lower back round at the bottom.", stress: ["knee"], incrementKg: 5 },
  { name: "Walking Lunge", muscle: "quads", compound: true, equip: GYM_DB_HOME, tip: "Long stride, torso upright, front knee over the mid-foot.", stress: ["knee"] },
  { name: "Bodyweight Squat", muscle: "quads", compound: true, equip: ["HOME", "BODYWEIGHT"], tip: "Heels down, chest up, controlled tempo (3s down).", stress: ["knee"] },
  { name: "Leg Extension", muscle: "quads", compound: false, equip: GYM_ONLY, tip: "Squeeze at the top, slow lowering.", stress: ["knee"] },
  { name: "Romanian Deadlift", muscle: "hamstrings", compound: true, equip: GYM_DB_HOME, tip: "Hips back, soft knees, bar close to legs, feel the hamstring stretch.", stress: ["back"], incrementKg: 2.5 },
  { name: "Lying Leg Curl", muscle: "hamstrings", compound: false, equip: GYM_ONLY, tip: "Hips pinned to the pad, curl smoothly, slow return." },
  { name: "Single-Leg Glute Bridge", muscle: "hamstrings", compound: false, equip: ["HOME", "BODYWEIGHT", "DUMBBELLS"], tip: "Drive through the heel, ribs down, pause 1s at the top." },
  { name: "Hip Thrust", muscle: "glutes", compound: true, equip: GYM_DB_HOME, tip: "Chin tucked, drive through heels, full hip extension.", incrementKg: 5 },
  // shoulders
  { name: "Overhead Press", muscle: "shoulders", compound: true, equip: GYM_ONLY, tip: "Glutes tight, ribs down, press in a straight line past the face.", stress: ["shoulder", "back"] },
  { name: "Dumbbell Shoulder Press", muscle: "shoulders", compound: true, equip: GYM_DB_HOME, tip: "Neutral grip is kinder to the shoulder; don't flare ribs.", stress: ["shoulder"] },
  { name: "Lateral Raise", muscle: "shoulders", compound: false, equip: GYM_DB_HOME, tip: "Lead with the elbows to shoulder height, no swinging." },
  { name: "Pike Push-Up", muscle: "shoulders", compound: true, equip: ["HOME", "BODYWEIGHT"], tip: "Hips high, head travels between the hands.", stress: ["shoulder", "wrist"] },
  { name: "Face Pull", muscle: "shoulders", compound: false, equip: GYM_ONLY, tip: "Pull to the forehead, elbows high, rotate the hands outward." },
  // arms
  { name: "Dumbbell Curl", muscle: "biceps", compound: false, equip: GYM_DB_HOME, tip: "Elbows pinned, full stretch at the bottom, no swinging." },
  { name: "Hammer Curl", muscle: "biceps", compound: false, equip: GYM_DB_HOME, tip: "Neutral grip, slow lowering; good for forearms too." },
  { name: "Chin-Up", muscle: "biceps", compound: true, equip: ["FULL_GYM", "HOME", "BODYWEIGHT"], tip: "Underhand grip, chin over the bar, controlled descent.", stress: ["elbow"] },
  { name: "Cable Triceps Pushdown", muscle: "triceps", compound: false, equip: GYM_ONLY, tip: "Elbows glued to your sides, lock out fully." },
  { name: "Overhead Dumbbell Triceps Extension", muscle: "triceps", compound: false, equip: GYM_DB_HOME, tip: "Keep elbows pointing forward, deep stretch.", stress: ["elbow", "shoulder"] },
  { name: "Bench Dip", muscle: "triceps", compound: false, equip: ["HOME", "BODYWEIGHT"], tip: "Shoulders down, only go as deep as is comfortable.", stress: ["shoulder"] },
  // calves / core
  { name: "Standing Calf Raise", muscle: "calves", compound: false, equip: ALL, tip: "Full stretch, 1s pause at the top, slow lowering." },
  { name: "Plank", muscle: "abs", compound: false, equip: ALL, tip: "Ribs down, glutes tight, breathe; aim for 30–60s (the 'reps' are seconds).", stress: ["back"] },
  { name: "Hanging Knee Raise", muscle: "abs", compound: false, equip: ["FULL_GYM", "HOME"], tip: "Curl the pelvis up, avoid swinging.", stress: ["shoulder"] },
  { name: "Dead Bug", muscle: "abs", compound: false, equip: ALL, tip: "Lower back stays glued to the floor, move slowly." },
];

type Slot = { muscle: string; compound?: boolean };
const s = (muscle: string, compound?: boolean): Slot => ({ muscle, compound });

const TEMPLATES: Record<string, { focus: string; slots: Slot[] }> = {
  FULL: { focus: "full body", slots: [s("quads", true), s("chest", true), s("back", true), s("hamstrings"), s("shoulders"), s("abs")] },
  UPPER: { focus: "chest, back, shoulders, arms", slots: [s("chest", true), s("back", true), s("shoulders", true), s("back"), s("biceps"), s("triceps"), s("shoulders")] },
  LOWER: { focus: "quads, hamstrings, glutes, calves", slots: [s("quads", true), s("hamstrings", true), s("glutes"), s("quads"), s("hamstrings"), s("calves"), s("abs")] },
  PUSH: { focus: "chest, shoulders, triceps", slots: [s("chest", true), s("shoulders", true), s("chest"), s("shoulders"), s("triceps"), s("triceps")] },
  PULL: { focus: "back, biceps, rear delts", slots: [s("back", true), s("back", true), s("back"), s("shoulders"), s("biceps"), s("biceps")] },
  LEGS: { focus: "quads, hamstrings, glutes, calves", slots: [s("quads", true), s("hamstrings", true), s("glutes"), s("quads"), s("hamstrings"), s("calves")] },
};

const SPLITS: Record<number, [string, string][]> = {
  2: [["FULL", "Full Body 1"], ["FULL", "Full Body 2"]],
  3: [["FULL", "Full Body 1"], ["FULL", "Full Body 2"], ["FULL", "Full Body 3"]],
  4: [["UPPER", "Upper Body 1"], ["LOWER", "Lower Body 1"], ["UPPER", "Upper Body 2"], ["LOWER", "Lower Body 2"]],
  5: [["UPPER", "Upper Body 1"], ["LOWER", "Lower Body 1"], ["PUSH", "Push"], ["PULL", "Pull"], ["LEGS", "Legs"]],
  6: [["PUSH", "Push 1"], ["PULL", "Pull 1"], ["LEGS", "Legs 1"], ["PUSH", "Push 2"], ["PULL", "Pull 2"], ["LEGS", "Legs 2"]],
};

function ok(l: Lift, equipment: Equipment, injuries: string): boolean {
  if (!l.equip.includes(equipment)) return false;
  return !(l.stress ?? []).some((k) => injuries.includes(k));
}

function prescription(goal: PlanGoal, level: Level, lift: Lift, mainLift: boolean) {
  const sets = level === "BEGINNER" ? (lift.compound ? 3 : 2) : level === "INTERMEDIATE" ? 3 : lift.compound ? 4 : 3;
  let repMin: number, repMax: number, rpe: number;
  if (goal === "STRENGTH" && lift.compound) {
    [repMin, repMax, rpe] = mainLift ? [4, 6, 8] : [6, 8, 8];
  } else if (lift.compound) {
    [repMin, repMax, rpe] = goal === "FAT_LOSS" || goal === "RECOMP" || goal === "MAINTAIN" ? [8, 12, 8] : [6, 10, 8];
  } else {
    [repMin, repMax, rpe] = [10, 15, 8.5];
  }
  if (lift.name === "Plank") [repMin, repMax] = [30, 60];
  if (level === "BEGINNER") rpe = Math.min(rpe, 7.5);
  const restSec = lift.compound ? (goal === "STRENGTH" ? 180 : 120) : 75;
  const inc = lift.incrementKg ?? 2.5;
  const progression =
    lift.name === "Plank"
      ? "Add 5–10 seconds each session until you can hold 60s, then add a harder variation."
      : `Double progression: add reps until every set hits ${repMax}, then add ${inc}kg (or the next dumbbell) and drop back to ${repMin} reps. Stop 1–3 reps short of failure.`;
  return { sets, repMin, repMax, restSec, targetRpe: rpe, progression };
}

/** Build a structured plan. Deterministic: same inputs → same plan. */
export function generatePlan(req: PlanRequest): GeneratedPlan {
  const days = Math.min(6, Math.max(2, Math.round(req.daysPerWeek)));
  const injuries = (req.injuries ?? "").toLowerCase();
  const perDay = Math.max(4, Math.min(9, Math.round(req.sessionMinutes / 9)));
  const split = SPLITS[days];
  const used = new Map<string, number>(); // muscle+compound → rotations so variant days differ

  const out: PlanDayOut[] = split.map(([tmpl, name], dayIdx) => {
    const t = TEMPLATES[tmpl];
    const picked: Lift[] = [];
    const slots = t.slots.slice(0, perDay);
    slots.forEach((slot, i) => {
      const pool = LIBRARY.filter((l) => l.muscle === slot.muscle && (slot.compound === undefined || l.compound === slot.compound) && ok(l, req.equipment, injuries));
      const fallback = LIBRARY.filter((l) => l.muscle === slot.muscle && ok(l, req.equipment, injuries));
      const candidates = (pool.length ? pool : fallback).filter((l) => !picked.includes(l));
      if (!candidates.length) return;
      const key = `${slot.muscle}:${slot.compound ?? "x"}`;
      const rot = used.get(key) ?? 0;
      used.set(key, rot + 1);
      picked.push(candidates[(rot + (dayIdx % 2 === 1 ? 1 : 0)) % candidates.length]);
      void i;
    });
    const exercises = picked.map((lift, idx) => {
      const p = prescription(req.goal, req.experience, lift, idx === 0);
      return { name: lift.name, muscleGroup: lift.muscle, technique: lift.tip, ...p };
    });
    return { name, focus: t.focus, exercises };
  });

  const notes = [
    "Warm up with 5 minutes of easy cardio and 1–2 light ramp-up sets of your first lift.",
    "RPE 8 means you could have done about 2 more reps. Stay there most of the time; save RPE 9+ for the last set.",
    "Rest at least one day between sessions that train the same muscles.",
  ];
  if (injuries.trim()) notes.push(`I avoided lifts that commonly aggravate: ${injuries.trim()}. If anything hurts, stop and check with a physiotherapist or doctor.`);
  if (req.sessionMinutes > 90) notes.push("Sessions over 90 minutes are rarely better than 60–75 focused minutes. Don't exceed two hours of intense training in a day.");

  const goalName = { FAT_LOSS: "Fat Loss", MUSCLE_GAIN: "Muscle Gain", STRENGTH: "Strength", RECOMP: "Recomposition", MAINTAIN: "Maintenance" }[req.goal];
  return { name: `${days}-Day ${goalName} Plan`, days: out, notes };
}

/** Swap one exercise for another of the same muscle group (voice: "replace squats with leg press"). */
export function findAlternative(currentName: string, equipment: Equipment, injuries = ""): Lift | null {
  const cur = LIBRARY.find((l) => l.name.toLowerCase() === currentName.toLowerCase());
  if (!cur) return null;
  return LIBRARY.find((l) => l.muscle === cur.muscle && l.name !== cur.name && ok(l, equipment, injuries.toLowerCase())) ?? null;
}

export function findLiftByQuery(q: string): Lift | null {
  const n = q.toLowerCase();
  return LIBRARY.find((l) => n.includes(l.name.toLowerCase())) ?? LIBRARY.find((l) => l.name.toLowerCase().split(" ").every((w) => n.includes(w.replace(/s$/, "")))) ?? null;
}
