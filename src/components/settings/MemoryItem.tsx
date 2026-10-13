"use client";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge, Spinner } from "@/components/ui";
import { ApiError, del, patch } from "@/lib/client/api";
import type { MemoryCategory, MemoryDto } from "./types";

export const CATEGORIES: { value: MemoryCategory; label: string }[] = [
  { value: "GOAL", label: "Goals" },
  { value: "IDENTITY", label: "About you" },
  { value: "LIFESTYLE", label: "Lifestyle and routine" },
  { value: "PREFERENCE", label: "Preferences" },
  { value: "EVENT", label: "Events" },
  { value: "HEALTH_HISTORY", label: "Health history" },
  { value: "MOOD", label: "Mood and motivation" },
];

/** "protein_source" becomes "Protein source". */
export function readableKey(key: string): string {
  const t = key.replace(/[_-]+/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

interface Props {
  memory: MemoryDto;
  onChanged: (m: MemoryDto) => void;
  onDeleted: (id: string) => void;
}

export function MemoryItem({ memory: m, onChanged, onDeleted }: Props) {
  const [mode, setMode] = useState<"view" | "edit" | "confirm">("view");
  const [value, setValue] = useState(m.value);
  const [category, setCategory] = useState<MemoryCategory>(m.category);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fail = (e: unknown) => setError(e instanceof ApiError ? e.message : "That didn't work. Please check your connection and try again.");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = value.trim();
    if (!v) return setError("Please write something, or delete this memory instead.");
    setBusy(true);
    setError(null);
    try {
      const r = await patch<{ memory: MemoryDto }>("/api/memory", { id: m.id, value: v, ...(category !== m.category ? { category } : {}) });
      onChanged(r.memory);
      setMode("view");
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await del(`/api/memory?id=${encodeURIComponent(m.id)}`);
      onDeleted(m.id);
    } catch (err) {
      fail(err);
      setBusy(false);
    }
  };

  const title = readableKey(m.key);

  if (mode === "edit") {
    return (
      <li className="py-3">
        <form onSubmit={save} className="space-y-3" aria-label={`Edit ${title}`}>
          <p className="text-sm font-medium">{title}</p>
          <div>
            <label className="label" htmlFor={`mv-${m.id}`}>What I remember</label>
            <input id={`mv-${m.id}`} className="input" maxLength={300} value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="label" htmlFor={`mc-${m.id}`}>Group</label>
            <select id={`mc-${m.id}`} className="input sm:max-w-xs" value={category} onChange={(e) => setCategory(e.target.value as MemoryCategory)}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <p className="text-xs text-muted">Saving marks this as something you told me directly.</p>
          {error && <p role="alert" className="text-sm text-bad">{error}</p>}
          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={busy}>{busy ? <Spinner label="Saving" /> : "Save"}</button>
            <button type="button" className="btn" disabled={busy} onClick={() => { setMode("view"); setValue(m.value); setCategory(m.category); setError(null); }}>Cancel</button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="break-words">{m.value}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            {m.source === "EXPLICIT" ? <Badge tone="good">You told me</Badge> : <Badge tone="warn">Inferred, {Math.round(m.confidence * 100)}% sure</Badge>}
            <span>{m.lastUsedAt ? `Last used ${fmtDate(m.lastUsedAt)}` : "Not used yet"}</span>
          </p>
        </div>
        {mode === "view" && (
          <div className="flex shrink-0 gap-1">
            <button className="btn btn-ghost !px-3" onClick={() => setMode("edit")} aria-label={`Edit ${title}`}><Pencil className="h-4 w-4" aria-hidden /> Edit</button>
            <button className="btn btn-ghost !px-3" onClick={() => setMode("confirm")} aria-label={`Delete ${title}`}><Trash2 className="h-4 w-4" aria-hidden /> Delete</button>
          </div>
        )}
      </div>
      {mode === "confirm" && (
        <div role="alertdialog" aria-label={`Delete ${title}?`} className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-bad/40 bg-bad/10 p-3 text-sm">
          <span className="mr-auto">Delete this memory? I&apos;ll forget it.</span>
          <button className="btn border-transparent bg-bad text-white hover:opacity-90" disabled={busy} onClick={() => void remove()}>{busy ? <Spinner label="Deleting" /> : "Yes, delete"}</button>
          <button className="btn" disabled={busy} onClick={() => { setMode("view"); setError(null); }} autoFocus>Keep it</button>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-bad">{error}</p>}
    </li>
  );
}
