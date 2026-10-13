"use client";
import { useState } from "react";
import { Field, Spinner } from "@/components/ui";
import { ApiError, post } from "@/lib/client/api";
import { CATEGORIES } from "./MemoryItem";
import type { MemoryCategory } from "./types";

/** The form body only: the page wraps it in a Sheet that carries the "Add a memory" title. */
export function AddMemoryForm({ onAdded, onCancel }: { onAdded: () => void; onCancel: () => void }) {
  const [category, setCategory] = useState<MemoryCategory>("PREFERENCE");
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const k = key.trim().toLowerCase().replace(/\s+/g, "_");
    const v = value.trim();
    if (!k || !v) return setError("Please fill in both a short label and what you'd like me to remember.");
    setBusy(true);
    setError(null);
    try {
      await post("/api/memory", { category, key: k, value: v });
      onAdded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "I couldn't save that. Please check your connection and try again.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" aria-label="Add a memory" noValidate>
      <Field label="Group" htmlFor="am-cat">
        <select id="am-cat" className="input" value={category} onChange={(e) => setCategory(e.target.value as MemoryCategory)}>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </Field>
      <Field label="Short label" htmlFor="am-key" hint="For example: protein source, work hours, upcoming trip.">
        <input id="am-key" className="input" maxLength={60} value={key} onChange={(e) => setKey(e.target.value)} />
      </Field>
      <Field label="What should I remember?" htmlFor="am-val">
        <input id="am-val" className="input" maxLength={300} value={value} onChange={(e) => setValue(e.target.value)} />
      </Field>
      {error && <p role="alert" className="rounded-2xl border border-bad/30 bg-bad/10 px-3.5 py-2.5 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn flex-1" onClick={onCancel} disabled={busy}>Cancel</button>
        <button className="btn btn-primary flex-1" disabled={busy}>{busy ? <Spinner label="Saving" /> : "Save memory"}</button>
      </div>
    </form>
  );
}
