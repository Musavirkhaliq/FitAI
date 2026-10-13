/** Display helpers shared by all pages. Storage is always metric; units are a display preference. */

export type UnitSystem = "METRIC" | "IMPERIAL";

export const fmtNum = (n: number | null | undefined, dp = 0) =>
  n == null || Number.isNaN(n) ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: dp, minimumFractionDigits: 0 });

export const kgToLb = (kg: number) => kg * 2.2046226218;
export const lbToKg = (lb: number) => lb / 2.2046226218;

export function fmtWeight(kg: number | null | undefined, units: UnitSystem = "METRIC", dp = 1): string {
  if (kg == null) return "—";
  return units === "IMPERIAL" ? `${fmtNum(kgToLb(kg), dp)} lb` : `${fmtNum(kg, dp)} kg`;
}

export function fmtDelta(kg: number | null | undefined, units: UnitSystem = "METRIC", dp = 1): string {
  if (kg == null || Number.isNaN(kg)) return "—";
  const v = units === "IMPERIAL" ? kgToLb(kg) : kg;
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}${fmtNum(Math.abs(v), dp)} ${units === "IMPERIAL" ? "lb" : "kg"}`;
}

/** "Mon 30 Mar" from a YYYY-MM-DD day string, independent of the viewer's timezone. */
export function fmtDay(date: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function greeting(name?: string | null, hour = new Date().getHours()): string {
  const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return name ? `${part}, ${name.split(" ")[0]}` : part;
}

export const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const pct = (value: number, target: number) => (target > 0 ? Math.max(0, Math.min(1, value / target)) : 0);

export const MEAL_LABEL: Record<string, string> = { BREAKFAST: "Breakfast", LUNCH: "Lunch", DINNER: "Dinner", SNACK: "Snacks" };
export const CONF_LABEL: Record<string, string> = { HIGH: "High confidence", MEDIUM: "Medium confidence", LOW: "Low confidence" };

export const STATUS_LABEL: Record<string, string> = {
  FAST_LOSS: "Losing fast",
  TARGET_LOSS: "On track",
  SLOW_LOSS: "Slow loss",
  PLATEAU: "Plateau",
  GAINING: "Trending up",
  INSUFFICIENT_DATA: "Gathering data",
};
