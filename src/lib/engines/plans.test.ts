import { describe, expect, it } from "vitest";
import { fitIntoBudget, substitute, suggestMeal } from "./mealPlan";
import { findAlternative, generatePlan, LIBRARY } from "./workoutPlan";

describe("meal planner", () => {
  it("fits ~900 kcal / 60 g protein with a concrete combination", () => {
    const m = suggestMeal({ kcal: 900, proteinG: 60 })!;
    expect(m.items.length).toBeGreaterThanOrEqual(3);
    expect(m.kcal).toBeGreaterThan(700);
    expect(m.kcal).toBeLessThan(1050);
    expect(m.protein).toBeGreaterThan(45);
    expect(m.text).toMatch(/\d+ g /);
  });

  it("respects avoided foods", () => {
    const m = suggestMeal({ kcal: 800, proteinG: 55, avoid: ["chicken", "egg"] })!;
    expect(m.items.map((i) => i.name).join(" ")).not.toMatch(/chicken|egg/);
  });

  it("returns nothing when there's no budget", () => {
    expect(suggestMeal({ kcal: 80, proteinG: 10 })).toBeNull();
  });

  it("substitutes eggs with protein-matched alternatives and never the removed food", () => {
    const s = substitute({ name: "egg", grams: 150 }, {})!;
    expect(s.protein).toBeGreaterThan(8);
    expect(s.items.map((i) => i.name)).not.toContain("egg");
  });

  it("never says no to a meal: fits easily, tightly, or shows the overshoot", () => {
    expect(fitIntoBudget({ foodKcal: 700, remainingKcal: 1200, remainingProtein: 40, mealsLeft: 1 }).mode).toBe("easy");
    expect(fitIntoBudget({ foodKcal: 700, remainingKcal: 800, remainingProtein: 40, mealsLeft: 1 }).mode).toBe("tight");
    const over = fitIntoBudget({ foodKcal: 900, remainingKcal: 600, remainingProtein: 40, mealsLeft: 1 });
    expect(over.fits).toBe(false);
    expect(over.leftKcal).toBe(-300);
  });
});

describe("workout plan generator", () => {
  const base = { goal: "MUSCLE_GAIN", experience: "INTERMEDIATE", sessionMinutes: 60, equipment: "FULL_GYM" } as const;

  it("produces the requested number of days with structured exercises", () => {
    for (const days of [2, 3, 4, 5, 6]) {
      const p = generatePlan({ ...base, daysPerWeek: days });
      expect(p.days).toHaveLength(days);
      for (const d of p.days) {
        expect(d.exercises.length).toBeGreaterThanOrEqual(3);
        for (const e of d.exercises) {
          expect(e.sets).toBeGreaterThan(0);
          expect(e.repMax).toBeGreaterThanOrEqual(e.repMin);
          expect(e.restSec).toBeGreaterThan(0);
          expect(e.targetRpe).toBeGreaterThanOrEqual(6);
          expect(e.technique.length).toBeGreaterThan(5);
          expect(e.progression.length).toBeGreaterThan(5);
        }
      }
    }
  });

  it("names a 4-day plan Upper/Lower and varies the second upper day", () => {
    const p = generatePlan({ ...base, daysPerWeek: 4 });
    expect(p.days.map((d) => d.name)).toEqual(["Upper Body 1", "Lower Body 1", "Upper Body 2", "Lower Body 2"]);
    expect(p.days[0].exercises.map((e) => e.name)).not.toEqual(p.days[2].exercises.map((e) => e.name));
  });

  it("only uses equipment the user has", () => {
    const p = generatePlan({ ...base, daysPerWeek: 3, equipment: "BODYWEIGHT" });
    for (const e of p.days.flatMap((d) => d.exercises)) {
      expect(LIBRARY.find((l) => l.name === e.name)!.equip).toContain("BODYWEIGHT");
    }
  });

  it("avoids lifts that commonly aggravate a stated injury and says so", () => {
    const p = generatePlan({ ...base, daysPerWeek: 4, injuries: "bad knees" });
    const names = p.days.flatMap((d) => d.exercises.map((e) => e.name));
    expect(names).not.toContain("Back Squat");
    expect(names).not.toContain("Walking Lunge");
    expect(p.notes.join(" ")).toMatch(/physiotherapist/);
  });

  it("scales exercise count with session length, and strength goals use lower reps", () => {
    const short = generatePlan({ ...base, daysPerWeek: 3, sessionMinutes: 30 });
    const long = generatePlan({ ...base, daysPerWeek: 3, sessionMinutes: 90 });
    expect(long.days[0].exercises.length).toBeGreaterThan(short.days[0].exercises.length);
    const strength = generatePlan({ ...base, daysPerWeek: 3, goal: "STRENGTH" });
    expect(strength.days[0].exercises[0].repMax).toBeLessThanOrEqual(6);
  });

  it("finds a same-muscle alternative for swaps", () => {
    const alt = findAlternative("Back Squat", "FULL_GYM", "");
    expect(alt?.muscle).toBe("quads");
    expect(alt?.name).not.toBe("Back Squat");
  });
});
