"use client";
import { Download } from "lucide-react";
import { useState } from "react";
import { clsx, Field, Segmented } from "@/components/ui";

const TYPES = [
  { value: "nutrition", label: "Nutrition (food log)" },
  { value: "weight", label: "Weight" },
  { value: "activity", label: "Activity" },
  { value: "workouts", label: "Workouts" },
  { value: "measurements", label: "Body measurements" },
] as const;

type Format = "csv" | "xlsx" | "pdf";

/** Downloads are plain links: the server sets Content-Disposition, so the browser saves the file without leaving the page. */
export function ExportPanel() {
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>("nutrition");
  const [format, setFormat] = useState<Format>("csv");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const badRange = !!from && !!to && from > to;
  const qs = new URLSearchParams({ type, format });
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);

  return (
    <section className="card space-y-3" aria-labelledby="export-h">
      <h2 id="export-h" className="text-sm font-semibold">Export your data</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="What to export" htmlFor="ex-type">
          <select id="ex-type" className="input" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <div>
          <p className="label">Format</p>
          <Segmented<Format> label="Export format" value={format} onChange={setFormat} options={[{ value: "csv", label: "CSV" }, { value: "xlsx", label: "Excel" }, { value: "pdf", label: "PDF" }]} />
        </div>
        <Field label="From (optional)" htmlFor="ex-from">
          <input id="ex-from" type="date" className="input" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="To (optional)" htmlFor="ex-to">
          <input id="ex-to" type="date" className="input" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>
      {badRange && <p role="alert" className="text-sm text-bad">The start date needs to be on or before the end date.</p>}
      <a href={badRange ? undefined : `/api/export?${qs.toString()}`} aria-disabled={badRange} className={clsx("btn btn-primary", badRange && "pointer-events-none opacity-50")}>
        <Download className="h-4 w-4" aria-hidden /> Download {format.toUpperCase()}
      </a>
      <p className="text-xs text-muted">Calories and body-fat figures in exports are estimates, not measurements. Leave the dates empty to export everything.</p>
    </section>
  );
}
