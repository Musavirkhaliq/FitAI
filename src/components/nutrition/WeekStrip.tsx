"use client";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { clsx } from "@/components/ui";
import { api } from "@/lib/client/api";
import { fmtDay } from "@/lib/client/format";
import type { DailyPointDto } from "@/lib/client/types";
import { isDay, shiftDay } from "./dayMath";

/** Which days in a window have food logged. Cached per window so paging back and forth paints instantly (then quietly revalidates). */
const loggedCache = new Map<string, string[]>();

function useLoggedDays(from: string, to: string): ReadonlySet<string> {
  const key = `${from}|${to}`;
  const [days, setDays] = useState<string[]>(() => loggedCache.get(key) ?? []);
  useEffect(() => {
    setDays(loggedCache.get(key) ?? []);
    let live = true;
    api<{ days: DailyPointDto[] }>(`/api/analytics?from=${from}&to=${to}`)
      .then((r) => {
        const logged = r.days.filter((d) => d.calories != null && d.calories > 0).map((d) => d.date);
        loggedCache.set(key, logged);
        if (live) setDays(logged);
      })
      .catch(() => undefined); // dots are a nicety: offline or failed just means no dots
    return () => {
      live = false;
    };
  }, [key, from, to]);
  return new Set(days);
}

const windowEndFor = (date: string, today: string) => {
  const end = shiftDay(date, 3);
  return end > today ? today : end;
};

/**
 * Seven day-chips ending at `end` (today by default), swipeable with snap, plus prev/next-week arrows and a native date
 * picker fallback. A dot under a day means food is logged on it.
 */
export function WeekStrip({ date, today, selectedHasFood, onSelect }: {
  date: string; today: string; selectedHasFood: boolean | null; onSelect: (d: string) => void;
}) {
  const [end, setEnd] = useState(() => (date >= shiftDay(today, -6) ? today : windowEndFor(date, today)));
  const start = shiftDay(end, -6);
  const scroller = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const logged = useLoggedDays(start, end);

  // Follow the selected day when it is set from elsewhere (?date=, search results, the picker).
  // (Only when `date` changes, so paging weeks with the arrows isn't undone.)
  useEffect(() => {
    setEnd((cur) => (date < shiftDay(cur, -6) || date > cur ? windowEndFor(date, today) : cur));
  }, [date, today]);

  // Keep the selected chip centred when the window or selection changes.
  useEffect(() => {
    const el = scroller.current;
    const sel = el?.querySelector<HTMLElement>("[data-sel='true']");
    if (el && sel) el.scrollLeft = sel.offsetLeft - (el.clientWidth - sel.offsetWidth) / 2;
  }, [date, end]);

  const days = Array.from({ length: 7 }, (_, i) => shiftDay(start, i));
  const range = `${fmtDay(start, { day: "numeric", month: "short" })} – ${fmtDay(end, { day: "numeric", month: "short" })}`;

  const openPicker = () => {
    const el = picker.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
      el.click();
    }
  };

  return (
    <nav aria-label="Choose day" className="rise space-y-2.5">
      <div className="flex items-center gap-1.5">
        <p className="eyebrow mr-auto pl-1">{end === today ? "This week" : range}</p>
        <button type="button" className="btn btn-ghost !w-12 !px-0" aria-label="Previous week" onClick={() => setEnd(shiftDay(end, -7))}>
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </button>
        <button type="button" className="btn btn-ghost !w-12 !px-0" aria-label="Next week" disabled={end >= today} onClick={() => { const n = shiftDay(end, 7); setEnd(n > today ? today : n); }}>
          <ChevronRight className="h-5 w-5" aria-hidden />
        </button>
        <div className="relative">
          <button type="button" className="btn btn-ghost !w-12 !px-0" aria-label="Pick a date" onClick={openPicker}>
            <CalendarDays className="h-5 w-5" aria-hidden />
          </button>
          <label htmlFor="day-input" className="sr-only">Choose a date</label>
          <input
            ref={picker}
            id="day-input"
            type="date"
            tabIndex={-1}
            className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
            value={date}
            max={today}
            onChange={(e) => isDay(e.target.value) && e.target.value <= today && onSelect(e.target.value)}
          />
        </div>
      </div>

      <div ref={scroller} className="relative -mx-4 snap-x snap-mandatory overflow-x-auto scroll-smooth px-4 pb-1 scrollbar-none">
        <ul className="flex w-max min-w-full gap-2 md:w-full">
          {days.map((d) => {
            const sel = d === date;
            const isToday = d === today;
            const has = sel && selectedHasFood != null ? selectedHasFood : logged.has(d);
            return (
              <li key={d} className="md:flex-1">
                <button
                  type="button"
                  data-sel={sel}
                  aria-current={sel ? "date" : undefined}
                  aria-label={`${fmtDay(d, { weekday: "long", day: "numeric", month: "long" })}${isToday ? ", today" : ""}, ${has ? "food logged" : "nothing logged"}`}
                  onClick={() => onSelect(d)}
                  className={clsx(
                    "press flex min-h-[72px] w-[3.25rem] snap-center flex-col items-center justify-center gap-0.5 rounded-2xl border transition-colors duration-300 md:w-full",
                    sel ? "border-transparent text-brand-fg shadow-float" : "border-border bg-surface hover:bg-surface-2",
                    !sel && isToday && "!border-brand/60",
                  )}
                  style={sel ? { background: "var(--btn-bg)" } : undefined}
                >
                  <span className={clsx("text-[11px] font-semibold uppercase tracking-wide", sel ? "opacity-80" : "text-muted")}>{fmtDay(d, { weekday: "short" })}</span>
                  <span className="num text-[1.25rem]">{Number(d.slice(8))}</span>
                  <span aria-hidden className={clsx("mt-0.5 h-1.5 w-1.5 rounded-full transition-opacity", has ? "opacity-100" : "opacity-0", sel ? "bg-brand-fg" : "bg-brand")} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
