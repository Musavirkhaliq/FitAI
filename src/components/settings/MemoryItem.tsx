"use client";
import { CalendarClock, Check, Coffee, Heart, HeartPulse, Pencil, Smile, Sparkles, Target, Trash2, UserRound, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge, Sheet, Spinner } from "@/components/ui";
import { ApiError, del, patch } from "@/lib/client/api";
import type { Tint } from "./common";
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

/** Soft tinted section headers. The tints are decorative; every header also carries its name in text. */
export const CATEGORY_META: Record<MemoryCategory, { icon: LucideIcon; tint: Tint; head: string }> = {
  GOAL: { icon: Target, tint: "brand", head: "bg-brand/10" },
  IDENTITY: { icon: UserRound, tint: "protein", head: "bg-protein/10" },
  LIFESTYLE: { icon: Coffee, tint: "steps", head: "bg-steps/10" },
  PREFERENCE: { icon: Heart, tint: "cal", head: "bg-cal/10" },
  EVENT: { icon: CalendarClock, tint: "sleep", head: "bg-sleep/10" },
  HEALTH_HISTORY: { icon: HeartPulse, tint: "neutral", head: "bg-surface-2" },
  MOOD: { icon: Smile, tint: "brand", head: "bg-brand/10" },
};

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

  const title = readableKey(m.key);

  // Stable identity: Sheet re-focuses itself whenever onClose changes.
  const reset = useCallback(() => {
    setMode("view");
    setValue(m.value);
    setCategory(m.category);
    setError(null);
  }, [m.value, m.category]);

  useEffect(() => {
    if (mode === "edit") document.getElementById(`mv-${m.id}`)?.focus();
  }, [mode, m.id]);

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

  return (
    <li className="rounded-[1.25rem] border border-border bg-surface p-4 shadow-tile">
      <p className="eyebrow">{title}</p>
      <p className="mt-1 break-words text-[1.02rem] leading-snug">{m.value}</p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          {m.source === "EXPLICIT" ? (
            <Badge tone="good" className="gap-1"><Check className="h-3 w-3" aria-hidden /> You told me</Badge>
          ) : (
            <Badge tone="warn" className="gap-1"><Sparkles className="h-3 w-3" aria-hidden /> Inferred, {Math.round(m.confidence * 100)}% sure</Badge>
          )}
          <span>{m.lastUsedAt ? `Last used ${fmtDate(m.lastUsedAt)}` : "Not used yet"}</span>
        </p>
        <div className="-mr-2 flex shrink-0 gap-0.5">
          <button className="btn btn-ghost !px-3" onClick={() => setMode("edit")} aria-label={`Edit ${title}`} aria-haspopup="dialog"><Pencil className="h-4 w-4" aria-hidden /> Edit</button>
          <button className="btn btn-ghost !px-3" onClick={() => setMode("confirm")} aria-label={`Delete ${title}`} aria-haspopup="dialog"><Trash2 className="h-4 w-4" aria-hidden /> Delete</button>
        </div>
      </div>
      {mode === "view" && error && <p role="alert" className="mt-2 text-sm text-bad">{error}</p>}

      <Sheet open={mode === "edit"} onClose={reset} title={`Edit ${title}`}>
        <form onSubmit={save} className="space-y-4" aria-label={`Edit ${title}`}>
          <div>
            <label className="label" htmlFor={`mv-${m.id}`}>What I remember</label>
            <input id={`mv-${m.id}`} className="input" maxLength={300} value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor={`mc-${m.id}`}>Group</label>
            <select id={`mc-${m.id}`} className="input" value={category} onChange={(e) => setCategory(e.target.value as MemoryCategory)}>
              {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <p className="text-xs text-muted">Saving marks this as something you told me directly.</p>
          {error && <p role="alert" className="rounded-2xl border border-bad/30 bg-bad/10 px-3.5 py-2.5 text-sm">{error}</p>}
          <div className="flex gap-2">
            <button type="button" className="btn flex-1" disabled={busy} onClick={reset}>Cancel</button>
            <button className="btn btn-primary flex-1" disabled={busy}>{busy ? <Spinner label="Saving" /> : "Save"}</button>
          </div>
        </form>
      </Sheet>

      <Sheet open={mode === "confirm"} onClose={reset} title={`Delete ${title}?`}>
        <div className="space-y-4">
          <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm">{m.value}</p>
          <p className="text-sm">Delete this memory? I&apos;ll forget it.</p>
          {error && <p role="alert" className="rounded-2xl border border-bad/30 bg-bad/10 px-3.5 py-2.5 text-sm">{error}</p>}
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1" disabled={busy} onClick={reset}>Keep it</button>
            <button className="btn flex-1 border-transparent bg-bad text-white hover:bg-bad hover:opacity-90 dark:text-bg" disabled={busy} onClick={() => void remove()}>{busy ? <Spinner label="Deleting" /> : "Yes, delete"}</button>
          </div>
        </div>
      </Sheet>
    </li>
  );
}
