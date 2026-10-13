/** Calendar-day helpers. Days are "YYYY-MM-DD" strings in the user's own timezone. */

export type DateStr = string;

export function todayIn(tz = "UTC", now: Date = new Date()): DateStr {
  try {
    // en-CA formats as YYYY-MM-DD
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

function toUtc(date: DateStr): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(date: DateStr, n: number): DateStr {
  return new Date(toUtc(date) + n * 86_400_000).toISOString().slice(0, 10);
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: DateStr, b: DateStr): number {
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

export function dateRange(from: DateStr, to: DateStr): DateStr[] {
  const out: DateStr[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function weekday(date: DateStr): number {
  return new Date(toUtc(date)).getUTCDay(); // 0 = Sunday
}

export function isDateStr(s: unknown): s is DateStr {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toUtc(s));
}

/** Monday-based start of the week containing `date`. */
export function startOfWeek(date: DateStr): DateStr {
  const wd = weekday(date);
  return addDays(date, -((wd + 6) % 7));
}
