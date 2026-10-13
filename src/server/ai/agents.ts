import { z } from "zod";
import { completeJson, completeText, streamText, type ChatMessage } from "@/lib/providers/llm";
import { DISCLAIMER } from "@/lib/engines/safety";
import type { FoodRecord } from "@/lib/food/types";
import { classificationSchema, extractionSchema, INTENTS, type Classification, type Extraction } from "./schemas";

/** Intent Classification Agent: fast model, returns intents with confidence 0–1. */
export async function classifyIntent(text: string, history: ChatMessage[]): Promise<Classification> {
  const system = `You classify messages sent to a fitness & nutrition coaching app. A single message may contain SEVERAL intents (e.g. a weigh-in, a meal and a goal). Return JSON:
{"intents":[{"intent":"<one of the list>","confidence":0-1,"text":"<the part of the message for this intent>"}],"clarifyingQuestion":"<only if you are unsure what the user wants>"}

Allowed intents: ${INTENTS.join(", ")}.

Guidance:
- Food or drink the user already ate → log_meal (a named meal) or log_food. A question about whether they CAN eat something → check_meal. "I don't want X tonight" → food_substitution.
- "I weighed 84.5" → log_weight. Steps → log_steps. Sleep → log_sleep. Water → log_water. Gym/cycling/walking done → log_gym_session / log_cycling / log_workout.
- "Set 1 was 60 kilos for 8" → log_workout_set. "Start rest timer", "Skip this exercise", "Add one more set" → workout_command.
- "How am I doing this week" → weekly_summary; "today" → daily_summary; "this month" → monthly_summary; "why did my weight go up" → why_weight_changed.
- Statements about habits/likes ("I usually eat bone-in chicken", "I don't like whey") → preference_update.
- Be honest: if the message is ambiguous, lower the confidence (below 0.7) and add a short clarifyingQuestion.`;
  return completeJson(
    [{ role: "system", content: system }, ...history.slice(-4), { role: "user", content: text }],
    classificationSchema,
    { role: "extract", maxTokens: 500 },
  );
}

/** Entity Extraction Agent: turns the message into structured data. Never writes anywhere. */
export async function extractEntities(text: string, intents: string[], history: ChatMessage[], nowIso: string): Promise<Extraction> {
  const system = `You extract structured data from a message to a fitness coach. Current local date-time: ${nowIso}. Return ONLY a JSON object; omit sections that don't apply. Detected intents: ${intents.join(", ")}.

Fields:
- dateOffsetDays: 0 for today, -1 for "yesterday", etc.
- conservative: true if the user says to log on the higher side / be conservative.
- foods: [{name, quantity, unit, prep, meal, state, boneIn, measured, restaurant}]
  * Split "rice, chicken and dal" into separate foods. Use singular simple names ("egg white", "rice", "chicken", "masoor dal").
  * quantity+unit exactly as spoken ("five egg whites" → 5 piece; "300 grams of rice" → 300 g; "half a yolk" → 0.5 piece, name "egg yolk"; "a bowl of dal" → 1 bowl).
  * prep: "fried", "curry", "grilled", "boiled", "roasted"... or null. meal: BREAKFAST/LUNCH/DINNER/SNACK if stated.
  * state: RAW only if they said raw/uncooked/dry, COOKED only if they said cooked; otherwise null.
  * boneIn: true only if they said bone-in / with bones; false if boneless; otherwise null. Never guess.
  * measured: true only if they said they weighed it / measured it / read the label. restaurant: true for restaurant/takeaway/delivery.
- mealType: the meal named for the whole message if any.
- weight {value, unit kg|lb}; steps (integer); sleepHours; waterMl (glass=250, bottle=500, litre=1000).
- activities: [{type GYM|CYCLING|WALKING|RUNNING|OTHER, durationMin, distanceKm, intensity, notes}]
- sets: [{exercise, reps, weight, unit kg|lb, rpe, setNumber}] ("Set 1 was 60 kilos for 8" → setNumber 1, weight 60, reps 8)
- measurement {waistCm, neckCm, hipCm, bodyFatPct}; note.
- goal {calorieTarget, proteinTargetG, stepTarget, targetWeightKg, type}  ("stay under 2,000 calories" → calorieTarget 2000)
- preferences: [{category GOAL|IDENTITY|LIFESTYLE|PREFERENCE|EVENT|HEALTH_HISTORY|MOOD, key (snake_case), value}] e.g. "I usually eat bone-in chicken" → {PREFERENCE, chicken_cut, "bone-in"}; "I don't like whey" → {PREFERENCE, dislikes_whey, "doesn't like whey protein"}; "use conservative estimates" → {PREFERENCE, calorie_estimates, "conservative"}
- workoutPlan {goal, experience, daysPerWeek, sessionMinutes, equipment, injuries, replaceExercise}
- mealQuery {caloriesLeft, proteinLeft, useFavourites}
- substitution {removeFood, grams}
- workoutCommand {action START_REST_TIMER|SKIP_EXERCISE|ADD_SET, seconds}
- edit {action EDIT|DELETE, kind, nameHint, newQuantity}
- exportRequest {kind, format}
- periodOffset: 1 for "last week/last month", else 0.
Do not invent values the user did not say.`;
  return completeJson([{ role: "system", content: system }, ...history.slice(-4), { role: "user", content: text }], extractionSchema, { role: "extract", maxTokens: 1200 });
}

const guessSchema = z.object({
  kcal: z.number().min(0).max(900),
  protein: z.number().min(0).max(100),
  carbs: z.number().min(0).max(100),
  fat: z.number().min(0).max(100),
  fiber: z.number().min(0).max(60).catch(0),
  gramsPerServing: z.number().min(10).max(1500).catch(150),
});

/** Last resort when no database knows a food: a LOW-confidence ballpark per 100 g, clearly labelled as a guess. */
export async function guessNutrition(name: string): Promise<FoodRecord | null> {
  try {
    const g = await completeJson(
      [
        { role: "system", content: `Give typical nutrition per 100 g for the food as commonly eaten. JSON only: {"kcal":n,"protein":n,"carbs":n,"fat":n,"fiber":n,"gramsPerServing":n}` },
        { role: "user", content: name },
      ],
      guessSchema,
      { role: "extract", maxTokens: 150 },
    );
    return {
      name: name.toLowerCase(),
      source: "LOCAL",
      state: "COOKED",
      kcal: g.kcal,
      protein: g.protein,
      carbs: g.carbs,
      fat: g.fat,
      fiber: g.fiber,
      sodium: 0,
      calcium: 0,
      iron: 0,
      potassium: 0,
      vitA: 0,
      vitC: 0,
      vitD: 0,
      vitB12: 0,
      folate: 0,
      edibleFraction: 1,
      unitGrams: { serving: g.gramsPerServing, piece: g.gramsPerServing, plate: g.gramsPerServing * 1.5 },
      mixed: true,
    };
  } catch {
    return null;
  }
}

/** If speech-to-text confidence is low, offer one alternative reading ("five" vs "nine"). */
export async function alternativeTranscript(text: string): Promise<string | null> {
  try {
    const out = await completeText(
      [
        { role: "system", content: "The following was transcribed from speech by a fitness-logging app and may contain a mis-heard word or number. Reply with ONE alternative plausible reading (same sentence, fixing the most likely error), or the single word SAME if the text looks right. No explanation." },
        { role: "user", content: text },
      ],
      { role: "extract", temperature: 0, maxTokens: 120 },
    );
    const t = out.trim().replace(/^["']|["']$/g, "");
    return !t || /^same\b/i.test(t) || t.toLowerCase() === text.toLowerCase() ? null : t;
  } catch {
    return null;
  }
}

export const COACH_SYSTEM = `You are FitTrack, a personal fitness and nutrition coach inside a voice-first app. Personality: supportive, direct, practical, data-driven, non-judgmental, occasionally dry-humoured, honest about uncertainty. You do not gush: never "AMAZING!!!", no emoji, no streams of praise. Prefer "That's a solid day. Protein is on target and activity was high."

How to answer:
- Use ONLY numbers from the DATA block. Never invent calories, weights or dates. If something isn't in DATA, say you don't have it.
- Keep the four kinds of statements distinct, in natural words:
  FACT (logged by the user: "Your weight today is 84.5 kg"),
  ESTIMATE (computed: "I estimate lunch at about 650 kcal, likely 560–740"),
  ASSUMPTION ("I assumed the chicken was bone-in"),
  RECOMMENDATION ("I'd keep calories around 2,000").
- Calories from food are always estimates: say "about" and mention the range or confidence when DATA provides them. Mention the main assumptions that matter. Don't pretend precision.
- Never moralise about food and never make the user feel guilty. A burger, dessert or biryani is fine — it just uses part of the day's calorie budget. If asked "can I eat X", say yes and show how it fits.
- Do not overreact to a single weigh-in; refer to the 7- or 14-day trend. Calorie changes are only suggestions, and only after ~14 days of data.
- You are not a doctor. Don't diagnose. Never suggest eating below the calorie floor (1200 kcal women, 1500 kcal men) or training more than two hours of intense exercise a day.
- Respect the user's remembered preferences (MEMORY block).
- Be brief and spoken-friendly: plain language, short sentences, under about 90 words unless the user asked for detail. No markdown tables or headings. Short lists are fine.
- When you logged food, end with a short invitation to correct anything ("Tell me if anything's off and I'll fix it.").
- If DATA includes a SAFETY note, lead with it exactly as given.`;

export function coachMessages(args: { userText: string; data: unknown; memory: string; history: ChatMessage[]; task: string }): ChatMessage[] {
  return [
    { role: "system", content: COACH_SYSTEM },
    ...args.history.slice(-6),
    {
      role: "user",
      content: `USER SAID: ${args.userText}\n\nTASK: ${args.task}\n\nMEMORY:\n${args.memory}\n\nDATA (JSON):\n${JSON.stringify(args.data)}`,
    },
  ];
}

export { streamText, DISCLAIMER };
