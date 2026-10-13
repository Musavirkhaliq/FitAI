import type { Answers, StepId } from "./model";

/**
 * Turns what the browser heard into the text we'd have typed. Deliberately small: digits pass straight through and
 * simple number words ("eighty four point five") become digits. Anything else is left as heard, and the step's normal
 * validation message guides the person. Nothing here submits an answer.
 */

const DIGITS: Record<string, number> = { zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };
const TEENS: Record<string, number> = { ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

const tokenize = (text: string) =>
  text
    .toLowerCase()
    .replace(/(\d),(\d)/g, "$1.$2") // "72,5" → "72.5"
    .replace(/[^a-z0-9.\s]/g, " ") // drops quotes in 5'9", hyphens, etc.
    .split(/\s+/)
    .map((t) => t.replace(/\.+$/, ""))
    .filter(Boolean);

/** Every number found in the text, in order: "five foot nine" → [5, 9]; "84 point 5 kg" → [84.5]. */
export function spokenNumbers(text: string): number[] {
  const out: number[] = [];
  let total = 0;
  let cur = 0;
  let has = false;
  let lastUnit = false;
  let frac: string | null = null;

  const flush = () => {
    if (has) {
      const v = total + cur;
      out.push(frac ? Number(`${v}.${frac}`) : v);
    }
    total = 0; cur = 0; has = false; lastUnit = false; frac = null;
  };

  for (const t of tokenize(text)) {
    if (frac !== null) {
      const digits = t in DIGITS ? String(DIGITS[t]) : /^\d+$/.test(t) ? t : null;
      if (digits !== null) { frac += digits; continue; }
      flush();
    }
    if (/^\d+(\.\d+)?$/.test(t)) { flush(); total = Number(t); has = true; continue; }
    if (t === "point") { if (has) frac = ""; continue; }
    if (t === "and") continue;
    if (t in DIGITS) {
      if (lastUnit) flush();
      cur += DIGITS[t]; has = true; lastUnit = true;
    } else if (t in TEENS) {
      if (lastUnit) flush();
      cur += TEENS[t]; has = true; lastUnit = false;
    } else if (t in TENS) {
      // "one eighty" / "two fifty" read as 180 / 250 (common for centimetres and pounds)
      if (lastUnit && (cur === 1 || cur === 2)) cur = cur * 100 + TENS[t];
      else cur += TENS[t];
      has = true; lastUnit = false;
    } else if (t === "hundred") {
      cur = (cur || 1) * 100; has = true; lastUnit = false;
    } else if (t === "thousand") {
      total += (cur || 1) * 1000; cur = 0; has = true; lastUnit = false;
    } else flush();
  }
  flush();
  return out;
}

const numStr = (n: number | undefined) => (n === undefined ? null : String(n));

/** "nineteen eighty four" → "1984"; "two thousand five" → "2005"; "1990" → "1990". */
export function yearFromSpeech(text: string): string | null {
  const four = text.match(/\b(\d{4})\b/);
  if (four) return four[1];
  const tokens = tokenize(text);
  const first = tokens[0] ?? "";
  const head = first in TEENS ? TEENS[first] : first === "twenty" ? 20 : null;
  if (head === 19 || head === 20) {
    if (tokens.length === 1) return null;
    const rest = spokenNumbers(tokens.slice(1).join(" "));
    const v = rest.length === 2 && rest[0] === 0 ? rest[1] : rest[0]; // "oh five" → 5
    if (v !== undefined && Number.isInteger(v) && v >= 0 && v < 100) return String(head * 100 + v);
  }
  return numStr(spokenNumbers(text).find((n) => n >= 1000 && n <= 2999));
}

const clean = (text: string) => text.trim().replace(/[.!?]+$/, "").trim();

/**
 * What to store for a step given what was heard. `base` is the answer as it was when dictation started (used to append
 * to the longer free-text answers). Returns null for steps that have no typed input.
 */
export function fromSpeech(id: StepId, text: string, a: Answers, base: string): Partial<Answers> | null {
  const raw = clean(text);
  switch (id) {
    case "name":
      return { name: raw.replace(/^(my name is|my name's|i am|i'm|call me|it's|this is)\s+/i, "").slice(0, 80) };
    case "birthYear":
      return { birthYear: yearFromSpeech(raw) ?? raw };
    case "height": {
      const nums = spokenNumbers(raw);
      if (a.unitSystem === "IMPERIAL") {
        if (nums.length >= 2) return { heightFt: String(nums[0]), heightIn: String(nums[1]) };
        if (nums.length === 1) return { heightFt: String(nums[0]), heightIn: "" };
        return { heightFt: raw };
      }
      return { heightCm: numStr(nums[0]) ?? raw };
    }
    case "weight":
      return { weight: numStr(spokenNumbers(raw)[0]) ?? raw };
    case "targetWeight":
      return { targetWeight: numStr(spokenNumbers(raw)[0]) ?? raw };
    case "sessionMinutes":
      return { sessionMinutes: numStr(spokenNumbers(raw)[0]) ?? raw };
    case "injuries":
      return { injuries: [base.trim(), raw].filter(Boolean).join(" ").slice(0, 400) };
    case "foods": {
      const list = raw.replace(/\s*(?:,|\band\b)\s*/gi, ", ").replace(/\s+/g, " ");
      return { foods: [base.trim().replace(/,$/, ""), list].filter(Boolean).join(", ") };
    }
    default:
      return null;
  }
}
