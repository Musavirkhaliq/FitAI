import { fmtNum, kgToLb, type UnitSystem } from "@/lib/client/format";
import type { TrendStatus } from "@/lib/client/types";

export const STATUS_TONE: Record<TrendStatus, "neutral" | "good" | "warn"> = {
  FAST_LOSS: "warn",
  TARGET_LOSS: "good",
  SLOW_LOSS: "neutral",
  PLATEAU: "neutral",
  GAINING: "warn",
  INSUFFICIENT_DATA: "neutral",
};

export const unitLabel = (units: UnitSystem) => (units === "IMPERIAL" ? "lb" : "kg");

export const toDisplay = (kg: number, units: UnitSystem) => (units === "IMPERIAL" ? kgToLb(kg) : kg);

/** "12.3–15.1 kg" for estimate ranges stored in kg. */
export function fmtWeightRange(lowKg: number, highKg: number, units: UnitSystem, dp = 1): string {
  return `${fmtNum(toDisplay(lowKg, units), dp)}–${fmtNum(toDisplay(highKg, units), dp)} ${unitLabel(units)}`;
}
