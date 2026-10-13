import { Check, Minus } from "lucide-react";
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

/** Habit × day table. Each cell pairs an icon shape with hidden text, so meaning never rests on colour. */
export function HabitGrid({ days, goal }: { days: DailyPointDto[]; goal: Goal | null }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed border-separate border-spacing-y-1 text-center text-xs">
        <caption className="sr-only">Habits for the last 7 days. Done means the habit was met that day.</caption>
        <thead>
          <tr>
            <th scope="col" className="w-[84px] text-left font-medium text-muted"><span className="sr-only">Habit</span></th>
            {days.map((d) => (
              <th key={d.date} scope="col" className="font-medium text-muted">
                <abbr title={fmtDay(d.date, { weekday: "long", day: "numeric", month: "short" })} className="no-underline">{fmtDay(d.date, { weekday: "short" })}</abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {HABITS.map((h) => (
            <tr key={h.key}>
              <th scope="row" className="text-left text-sm font-medium">{h.label}</th>
              {days.map((d) => {
                const ok = h.done(d, goal);
                return (
                  <td key={d.date}>
                    <span className={clsx("mx-auto flex h-7 w-7 items-center justify-center rounded-full border", ok ? "border-transparent bg-brand text-brand-fg" : "border-border text-muted")}>
                      {ok ? <Check className="h-4 w-4" aria-hidden /> : <Minus className="h-3.5 w-3.5" aria-hidden />}
                      <span className="sr-only">{ok ? "Done" : "Not recorded"}</span>
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
