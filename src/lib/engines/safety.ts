import { calorieFloor, type SexLike } from "./calories";
import type { TrendSummary } from "./weightTrend";

export type SafetyLevel = "GREEN" | "YELLOW" | "RED";

export interface SafetyVerdict {
  level: SafetyLevel;
  reasons: string[];
  /** Fixed response shown instead of normal coaching. Undefined for GREEN. */
  response?: string;
  /** RED entries are never logged. */
  allowLogging: boolean;
}

export const DISCLAIMER = "AI can make mistakes. Double-check important results.";
export const MEDICAL_FOOTER = "For pain, symptoms, or a medical condition, the next step is a doctor or physiotherapist.";

export const YELLOW_RESPONSE =
  "That's worth paying attention to. I'd recommend checking with a physiotherapist or doctor before continuing this program.";
export const RED_RESPONSE =
  "This is something a medical professional should look at. Please contact a doctor or emergency services.";

// Phrases that negate a symptom right before it ("no chest pain", "without dizziness").
const NEGATION = /\b(no|not|never|without|zero|don'?t have|didn'?t have|free of)\s+(?:\w+\s+){0,2}$/i;

interface Rule {
  re: RegExp;
  reason: string;
}

const RED_RULES: Rule[] = [
  { re: /\bchest (pain|pains|tightness|pressure)\b|\bpain in (my )?chest\b|\bpressure in (my )?chest\b/i, reason: "chest pain or pressure" },
  { re: /\b(faint(ed|ing)?|passed out|blacked out|black(ing)? out|collapsed)\b/i, reason: "fainting" },
  { re: /\b(severe(ly)? )?(short(ness)? of breath|can'?t breathe|cannot breathe|struggling to breathe|trouble breathing)\b/i, reason: "difficulty breathing" },
  {
    re: /\b(make|made|making|force|forced|forcing)\s+myself\s+(throw up|vomit|puke|sick)\b|\bpurg(e|ed|ing)\b|\bthrow(ing)? up (after|what i) (eat|ate)\b|\bvomit(ed|ing)? (after|on purpose)\b|\blaxatives? (to|for) (lose|burn|get rid)\b|\bbinge and purge\b|\banorexi|\bbulimi/i,
    reason: "possible eating-disorder behaviour",
  },
  {
    re: /\b(starv(e|ed|ing) myself|not eat(ing)? (anything )?for (\d+|two|three|four|five|several) days|haven'?t eaten (anything )?(in|for) (\d+|two|three|four|five|several) days|punish(ing)? myself (for|with) (food|eating)|hate myself for eating)\b/i,
    reason: "possible eating-disorder behaviour",
  },
  { re: /\b(suicid|kill myself|end my life|self[- ]harm)\b/i, reason: "self-harm risk" },
  { re: /\b(lost|losing|drop(ped)?)\s+(\d+(\.\d+)?)\s*(kg|kilos?|lbs?|pounds?)\s+(in|over)\s+(a|one|1|the last|the past)?\s*(week|7 days)\b/i, reason: "very rapid weight loss reported" },
];

const YELLOW_RULES: Rule[] = [
  { re: /\b(dizz(y|iness)|light-?headed|nause(a|ous)|vertigo)\b/i, reason: "dizziness or nausea" },
  {
    re: /\b(my|a|some|sharp|sudden|shooting|stabbing|bad|severe|lower|upper)\s+(?:\w+\s+)?(pain|ache)\b|\b(knee|back|shoulder|elbow|wrist|hip|ankle|neck|hamstring|groin|calf)\s+(pain|hurts?|is hurting|is sore)\b|\bhurts?\b|\bin pain\b|\bpainful\b/i,
    reason: "pain",
  },
  { re: /\b(injur(y|ed)|sprain(ed)?|strain(ed)?|pulled (a|my)|torn|swollen|swelling|numb(ness)?|tingling|pins and needles)\b/i, reason: "possible injury" },
  { re: /\b(unusual(ly)?|extreme|constant(ly)?|always)\s+(tired|fatigue(d)?|exhausted|drained)\b|\bexhausted all the time\b/i, reason: "unusual fatigue" },
  { re: /\b(palpitations?|heart (racing|pounding|fluttering)|irregular heart ?beat)\b/i, reason: "heart symptoms" },
];

function firstUnnegated(text: string, rules: Rule[]): string[] {
  const hits: string[] = [];
  for (const rule of rules) {
    const re = new RegExp(rule.re.source, rule.re.flags.includes("g") ? rule.re.flags : rule.re.flags + "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const before = text.slice(Math.max(0, m.index - 30), m.index);
      if (!NEGATION.test(before)) {
        if (!hits.includes(rule.reason)) hits.push(rule.reason);
        break;
      }
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  return hits;
}

/** Classify a user's message. RED beats YELLOW beats GREEN. Pure and deterministic. */
export function classifyMessage(text: string): SafetyVerdict {
  const red = firstUnnegated(text, RED_RULES);
  if (red.length) return { level: "RED", reasons: red, response: RED_RESPONSE, allowLogging: false };
  const yellow = firstUnnegated(text, YELLOW_RULES);
  if (yellow.length) return { level: "YELLOW", reasons: yellow, response: YELLOW_RESPONSE, allowLogging: true };
  return { level: "GREEN", reasons: [], allowLogging: true };
}

export interface GoalCheck {
  ok: boolean;
  calories: number;
  message?: string;
}

/** Enforce the calorie floor on any target the user or the AI proposes. */
export function validateCalorieTarget(requestedKcal: number, sex: SexLike): GoalCheck {
  const floor = calorieFloor(sex);
  if (requestedKcal >= floor) return { ok: true, calories: requestedKcal };
  return {
    ok: false,
    calories: floor,
    message: `I can't set a target below ${floor} kcal/day without medical supervision. I've used ${floor} instead — if you want to go faster, adding movement is the safer lever.`,
  };
}

/** Sustained loss > 1%/week for 2+ weeks escalates to a RED coaching response. */
export function checkRapidLoss(trend: TrendSummary): SafetyVerdict | null {
  if (!trend.sustainedFastLoss) return null;
  return {
    level: "RED",
    reasons: ["weight loss faster than 1% of body weight per week for two or more weeks"],
    response:
      "Your weight has been dropping faster than 1% of body weight per week for two weeks running. " +
      RED_RESPONSE +
      " In the meantime I'd raise your calories a little rather than cut further.",
    allowLogging: true, // the weigh-in itself is real data; only the eating-disorder / symptom RED statements block logging
  };
}

/** No more than two hours of intense training per day for non-athletes. */
export function checkTrainingLoad(intenseMinutesToday: number, isAthlete = false): string | null {
  if (isAthlete || intenseMinutesToday <= 120) return null;
  return "That's more than two hours of intense training in a day. For most people, more isn't better — I'd keep hard sessions under two hours and make sure you recover.";
}
