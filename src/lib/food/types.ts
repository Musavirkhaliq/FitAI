/** Nutrition per 100 g of edible food in the stated state. Micros in the units noted. */
export interface Nutrients {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number; // mg
  calcium: number; // mg
  iron: number; // mg
  potassium: number; // mg
  vitA: number; // µg RAE
  vitC: number; // mg
  vitD: number; // µg
  vitB12: number; // µg
  folate: number; // µg
}

export type FoodState = "RAW" | "COOKED" | "PACKAGED";
export type FoodRole = "protein" | "carb" | "veg" | "fruit" | "dairy" | "fat" | "snack" | "drink" | "meal" | "other";

export interface FoodRecord extends Nutrients {
  id?: string;
  name: string;
  source: "LOCAL" | "USDA" | "OFF" | "USER";
  externalId?: string | null;
  brand?: string | null;
  state: FoodState;
  /** Edible fraction of the *purchased/served* weight (bone-in chicken ≈ 0.6). */
  edibleFraction: number;
  /** Grams per household unit. */
  unitGrams: Record<string, number>;
  /** Used by the meal planner / substitution engine. */
  role?: FoodRole;
  /** A composite dish whose recipe is unknown (biryani, burger…): estimates are LOW confidence. */
  mixed?: boolean;
  /** For restaurant-style defaults. */
  aliases?: string[];
}
