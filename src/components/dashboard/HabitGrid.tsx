import { Check } from "lucide-react";
import { clsx } from "@/components/ui";
import { fmtDay } from "@/lib/client/format";
import type { DailyPointDto, TodayDto } from "@/lib/client/types";

type Goal = NonNullable<TodayDto["goal"]>;

/** Same thresholds the consistency score uses, so the grid and the number agree. */
const HABITS: { key: string; label: string; done: (d: DailyPointDto, g: Goal | null) => boolean }[] = [
  { key: "weigh", label: "Weigh-in", done: (d) => d.weightKg != null },
  { key: "food", label: "Food logged", done: (d) => d.calories != null },
  { key: "protein", label: "Protein", done: (d, g) => !!g && (d.protein ?? 0) >= g.proteinTargetG * 0.9 },
  { key: "steps", label: "Steps", done: (d, g) => !!g && (d.steps ?? 0) >= g.stepTarget * 0.8 },
  { key: "sleep", label: "Sleep", done: (d, g) => !!g && (d.sleepH ?? 0) >= g.sleepTargetH - 0.5 },
  { key: "train", label: "Training", done: (d) => d.trainingMin > 0 || d.volume > 0 },
];

/**
 * Habit × day dot matrix. Filled dot with a check = done, a small hollow dot = not recorded. The shape carries the
 * meaning (not colour), and every cell has hidden text so the table reads the same to a screen reader.
 */
export function HabitGrid({ days, goal }: { days: DailyPointDto[]; goal: Goal | null }) {
  return (
    <table className="w-full table-fixed border-separate border-spacing-y-1.5 text-center text-xs">
      <caption className="sr-only">Habits for the last 7 days. Done means the habit was met that day.</caption>
      <thead>
        <tr>
          <th scope="col" className="w-[5.5rem] text-left font-medium text-muted"><span className="sr-only">Habit</span></th>
          {days.map((d) => (
            <th key={d.date} scope="col" className="font-medium text-muted">
              <abbr title={fmtDay(d.date, { weekday: "long", day: "numeric", month: "short" })} className="no-underline" aria-label={fmtDay(d.date, { weekday: "long" })}>{fmtDay(d.date, { weekday: "narrow" })}</abbr>
            </th>
          ))}
          <th scope="col" className="w-9 text-right font-medium text-muted"><span className="sr-only">Days done</span></th>
        </tr>
      </thead>
      <tbody>
        {HABITS.map((h) => {
          const flags = days.map((d) => h.done(d, goal));
          const n = flags.filter(Boolean).length;
          return (
            <tr key={h.key}>
              <th scope="row" className="truncate text-left text-[13px] font-medium">{h.label}</th>
              {days.map((d, i) => (
                <td key={d.date}>
                  <span className={clsx("mx-auto flex h-6 w-6 items-center justify-center rounded-full transition-colors", flags[i] ? "grad-brand text-brand-fg" : "bg-surface-2")}>
                    {flags[i] ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /> : <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-border" />}
                    <span className="sr-only">{flags[i] ? "Done" : "Not recorded"}</span>
                  </span>
                </td>
              ))}
              <td className="text-right text-[11px] font-semibold tabular-nums text-muted">{n}/{days.length}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
