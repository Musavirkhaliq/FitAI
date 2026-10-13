import type { DaySummaryDto, FoodEntryDto, MealType, TotalsDto } from "@/lib/client/types";

export const MEAL_ORDER: MealType[] = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"];

export const isDay = (s: string | null | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Add whole days to a YYYY-MM-DD string without touching the viewer's timezone. */
export function shiftDay(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function guessMeal(hour = new Date().getHours()): MealType {
  return hour < 11 ? "BREAKFAST" : hour < 16 ? "LUNCH" : hour < 21 ? "DINNER" : "SNACK";
}

export function totalsOf(entries: FoodEntryDto[]): TotalsDto {
  const t: TotalsDto = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0, minKcal: 0, maxKcal: 0 };
  for (const e of entries) {
    t.calories += e.calories;
    t.protein += e.protein;
    t.carbs += e.carbs;
    t.fat += e.fat;
    t.fiber += e.fiber;
    t.sodium += e.sodium;
    t.minKcal += e.estimateMin;
    t.maxKcal += e.estimateMax;
  }
  return t;
}

/** All four meals in a fixed order, even when empty. */
export function normalizeMeals(meals: DaySummaryDto["meals"]): DaySummaryDto["meals"] {
  return MEAL_ORDER.map((m) => {
    const found = meals.find((x) => x.meal === m);
    return found ?? { meal: m, entries: [], totals: totalsOf([]) };
  });
}

/** Rebuild meal and day totals from a flat entry list (used for optimistic edits; the refetch is authoritative). */
export function withEntries(s: DaySummaryDto, entries: FoodEntryDto[]): DaySummaryDto {
  const meals = MEAL_ORDER.map((m) => {
    const es = entries.filter((e) => e.meal === m);
    return { meal: m, entries: es, totals: totalsOf(es) };
  });
  return { ...s, meals, totals: totalsOf(entries) };
}

/** Mirrors the server's edit_food_entry rescale so the optimistic number matches what is saved. */
export function scaleEntry(e: FoodEntryDto, quantity: number): FoodEntryDto {
  const k = quantity / e.quantity;
  const r1 = (n: number) => Math.round(n * k * 10) / 10;
  return {
    ...e,
    quantity,
    calories: Math.round(e.calories * k),
    protein: r1(e.protein),
    carbs: r1(e.carbs),
    fat: r1(e.fat),
    fiber: r1(e.fiber),
    sodium: Math.round(e.sodium * k),
    estimateMin: Math.round(e.estimateMin * k),
    estimateMax: Math.round(e.estimateMax * k),
    grams: e.grams ? Math.round(e.grams * k) : null,
  };
}
