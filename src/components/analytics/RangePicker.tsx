"use client";
import { CalendarRange } from "lucide-react";
import { useId, useState } from "react";
import { Segmented, Sheet } from "@/components/ui";
import { addDays, daysBetween } from "@/lib/dates";
import { fmtDay } from "@/lib/client/format";

export type Preset = "14" | "30" | "90" | "180" | "365" | "custom";
export interface Range { preset: Preset; from: string; to: string }

const OPTIONS: { value: Exclude<Preset, "custom">; label: string }[] = [
  { value: "14", label: "14d" },
  { value: "30", label: "30d" },
  { value: "90", label: "90d" },
  { value: "180", label: "6m" },
  { value: "365", label: "1y" },
];

export const presetRange = (preset: Exclude<Preset, "custom">, today: string): Range => ({ preset, from: addDays(today, -(Number(preset) - 1)), to: today });

const short = (d: string) => fmtDay(d, { day: "numeric", month: "short", year: "2-digit" });

/** Presets as a sliding pill, plus a custom range in a sheet. While a custom range is active the presets give way to a summary of it. */
export function RangePicker({ range, today, onChange }: { range: Range; today: string; onChange: (r: Range) => void }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [error, setError] = useState<string | null>(null);

  const openSheet = () => {
    setFrom(range.from);
    setTo(range.to);
    setError(null);
    setOpen(true);
  };

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!from || !to) return setError("Choose both a start and an end date.");
    if (from > to) return setError("The start date needs to be before the end date.");
    if (daysBetween(from, to) > 730) return setError("Pick a range of two years or less.");
    setError(null);
    onChange({ preset: "custom", from, to });
    setOpen(false);
  };

  return (
    <div className="rise">
      {range.preset === "custom" ? (
        <div className="flex items-center gap-2">
          <button type="button" className="btn min-w-0 flex-1 justify-start" onClick={openSheet} aria-label={`Custom range ${short(range.from)} to ${short(range.to)}. Change it.`}>
            <CalendarRange className="h-4 w-4 shrink-0 text-brand" aria-hidden /> <span className="truncate">{short(range.from)} to {short(range.to)}</span>
          </button>
          <button type="button" className="btn" onClick={() => onChange(presetRange("90", today))}>Presets</button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="min-w-0 max-w-full overflow-x-auto scrollbar-none">
            <Segmented label="Date range" value={range.preset} onChange={(v) => onChange(presetRange(v, today))} options={OPTIONS} />
          </div>
          <button type="button" className="btn shrink-0 !px-3.5" onClick={openSheet} aria-label="Pick a custom date range" aria-haspopup="dialog">
            <CalendarRange className="h-5 w-5" aria-hidden />
          </button>
        </div>
      )}

      <Sheet open={open} onClose={() => setOpen(false)} title="Custom range">
        <form onSubmit={apply} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${id}-from`} className="label">From</label>
              <input id={`${id}-from`} type="date" className="input" value={from} max={to || today} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label htmlFor={`${id}-to`} className="label">To</label>
              <input id={`${id}-to`} type="date" className="input" value={to} max={today} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Quick fills">
            {([["This month", addDays(today, -(Number(today.slice(8)) - 1))], ["Last 60 days", addDays(today, -59)], ["Since January", `${today.slice(0, 4)}-01-01`]] as const).map(([label, f]) => (
              <button key={label} type="button" className="chip" onClick={() => { setFrom(f); setTo(today); }}>{label}</button>
            ))}
          </div>
          {error && <p role="alert" className="text-sm text-bad">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn !min-h-[56px]" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary !min-h-[56px]">Apply range</button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
