"use client";
import { Cookie, Moon, SignalHigh, SignalLow, SignalMedium, Sun, Sunrise, type LucideIcon } from "lucide-react";
import { Badge, clsx } from "@/components/ui";
import type { Confidence, MealType } from "@/lib/client/types";

export const MEAL_ICON: Record<MealType, LucideIcon> = { BREAKFAST: Sunrise, LUNCH: Sun, DINNER: Moon, SNACK: Cookie };

/** Rounded-square meal icon. Meals are "fuel", so the avatar wears the calorie colour (docs/DESIGN.md §3); the icon shape tells them apart. */
export function MealAvatar({ meal, size = 40, className }: { meal: MealType; size?: number; className?: string }) {
  const Icon = MEAL_ICON[meal];
  return (
    <span
      aria-hidden
      className={clsx("flex shrink-0 items-center justify-center rounded-2xl", className)}
      style={{ width: size, height: size, background: "rgb(var(--c-cal) / 0.14)", color: "rgb(var(--c-cal))" }}
    >
      <Icon strokeWidth={1.75} style={{ width: size * 0.5, height: size * 0.5 }} />
    </span>
  );
}

const CONF = {
  HIGH: { tone: "good", Icon: SignalHigh, short: "High" },
  MEDIUM: { tone: "neutral", Icon: SignalMedium, short: "Medium" },
  LOW: { tone: "warn", Icon: SignalLow, short: "Low" },
} as const satisfies Record<Confidence, { tone: "good" | "neutral" | "warn"; Icon: LucideIcon; short: string }>;

/** Confidence is always icon + words (never colour alone). Low confidence is information, not a warning sign. */
export function ConfidenceBadge({ confidence, className }: { confidence: Confidence; className?: string }) {
  const c = CONF[confidence];
  return (
    <Badge tone={c.tone} className={clsx("shrink-0 gap-1", className)}>
      <c.Icon className="h-3.5 w-3.5" aria-hidden />
      {c.short}
      <span className="sr-only"> confidence</span>
    </Badge>
  );
}
