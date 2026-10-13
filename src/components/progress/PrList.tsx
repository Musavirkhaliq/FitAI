import { Trophy } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { fmtDay, fmtWeight, type UnitSystem } from "@/lib/client/format";
import type { PrDto } from "./types";

// Titles are saved as "Bench press: 60kg × 5"; re-render the load in the user's units.
const TITLE = /^(.*): ([\d.]+)\s*kg\s*[×x]\s*(\d+)$/;

function label(title: string, units: UnitSystem): string {
  const m = TITLE.exec(title);
  return m ? `${m[1]}: ${fmtWeight(Number(m[2]), units, 1)} × ${m[3]}` : title;
}

export function PrList({ prs, units }: { prs: PrDto[]; units: UnitSystem }) {
  if (!prs.length) {
    return <EmptyState title="No personal records yet" body="When you beat your best estimated 1RM in a workout, it's saved here. Log a workout to get started." icon={<Trophy className="h-8 w-8" />} />;
  }
  return (
    <ul className="divide-y divide-border">
      {prs.map((p) => {
        const est = typeof p.data?.est1rm === "number" ? p.data.est1rm : null;
        return (
          <li key={p.id} className="flex items-center gap-3 py-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warn/15 text-warn"><Trophy className="h-4 w-4" aria-hidden /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{label(p.title, units)}</p>
              <p className="text-xs text-muted">{fmtDay(p.date)}{est != null ? ` · est. 1RM ${fmtWeight(est, units, 1)}` : ""}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
