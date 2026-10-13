"use client";
import { useId, useState } from "react";
import { Segmented } from "@/components/ui";
import { addDays, daysBetween } from "@/lib/dates";

export type Preset = "14" | "30" | "90" | "180" | "365" | "custom";
export interface Range { preset: Preset; from: string; to: string }

const OPTIONS: { value: Preset; label: string }[] = [
  { value: "14", label: "14d" },
  { value: "30", label: "30d" },
  { value: "90", label: "90d" },
  { value: "180", label: "6m" },
  { value: "365", label: "1y" },
  { value: "custom", label: "Custom" },
];

export const presetRange = (preset: Exclude<Preset, "custom">, today: string): Range => ({ preset, from: addDays(today, -(Number(preset) - 1)), to: today });

export function RangePicker({ range, today, onChange }: { range: Range; today: string; onChange: (r: Range) => void }) {
  const id = useId();
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [error, setError] = useState<string | null>(null);

  const pick = (p: Preset) => {
    setError(null);
    if (p === "custom") {
      setFrom(range.from);
      setTo(range.to);
      onChange({ ...range, preset: "custom" });
    } else onChange(presetRange(p, today));
  };

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!from || !to) return setError("Choose both a start and an end date.");
    if (from > to) return setError("The start date needs to be before the end date.");
    if (daysBetween(from, to) > 730) return setError("Pick a range of two years or less.");
    setError(null);
    onChange({ preset: "custom", from, to });
  };

  return (
    <div className="space-y-3">
      <div className="max-w-full overflow-x-auto">
        <Segmented label="Date range" value={range.preset} onChange={pick} options={OPTIONS} />
      </div>
      {range.preset === "custom" && (
        <form onSubmit={apply} className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor={`${id}-from`} className="label">From</label>
            <input id={`${id}-from`} type="date" className="input" value={from} max={to || today} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <label htmlFor={`${id}-to`} className="label">To</label>
            <input id={`${id}-to`} type="date" className="input" value={to} max={today} onChange={(e) => setTo(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary">Apply</button>
          {error && <p role="alert" className="w-full text-sm text-bad">{error}</p>}
        </form>
      )}
    </div>
  );
}
