import { Trophy } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { fmtDay, fmtWeight, type UnitSystem } from "@/lib/client/format";
import type { PrDto } from "./types";

// Titles are saved as "Bench press: 60kg × 5"; re-render the load in the user's units.
const TITLE = /^(.*): ([\d.]+)\s*kg\s*[×x]\s*(\d+)$/;

function parse(title: string, units: UnitSystem): { name: string; load: string | null; reps: string | null } {
  const m = TITLE.exec(title);
  if (!m) return { name: title, load: null, reps: null };
  return { name: m[1], load: fmtWeight(Number(m[2]), units, 1), reps: m[3] };
}

/** Trophy cards in a horizontally scrolling row. Calm glow, no confetti: the record is the reward. */
export function PrList({ prs, units }: { prs: PrDto[]; units: UnitSystem }) {
  if (!prs.length) {
    return <EmptyState title="No personal records yet" body="When you beat your best estimated 1RM in a workout, it's saved here. Log a workout to get started." icon={<Trophy className="h-8 w-8" />} />;
  }
  return (
    <ul className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 pt-1 md:mx-0 md:px-0" aria-label="Personal records, newest first">
      {prs.map((p, i) => {
        const est = typeof p.data?.est1rm === "number" ? p.data.est1rm : null;
        const r = parse(p.title, units);
        return (
          <li
            key={p.id}
            className="rise relative w-[11.5rem] shrink-0 snap-start overflow-hidden rounded-[1.5rem] border border-brand/30 p-4"
            style={{
              ["--i" as string]: Math.min(i, 7),
              background: "linear-gradient(160deg, rgb(var(--brand-a) / 0.16), rgb(var(--brand-b) / 0.05) 70%), rgb(var(--surface))",
              boxShadow: "var(--shadow-tile), 0 0 28px -10px rgb(var(--brand) / 0.35)",
            }}
          >
            <span className="grad-brand flex h-9 w-9 items-center justify-center rounded-full text-brand-fg"><Trophy className="h-[18px] w-[18px]" aria-hidden /></span>
            <p className="display mt-3 line-clamp-2 min-h-[2.5rem] text-[0.95rem] font-bold leading-tight">{r.name}</p>
            {r.load ? (
              <p className="num mt-2 text-[1.6rem]">{r.load}<span className="ml-1 text-sm font-semibold text-muted">× {r.reps}</span></p>
            ) : (
              <p className="mt-2 text-sm text-muted">New personal record</p>
            )}
            <p className="mt-2 text-xs text-muted">{fmtDay(p.date)}</p>
            {est != null && <p className="text-xs text-muted">est. 1RM {fmtWeight(est, units, 1)}</p>}
          </li>
        );
      })}
    </ul>
  );
}
