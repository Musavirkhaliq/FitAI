"use client";
import { useState } from "react";
import { Field, Spinner } from "@/components/ui";
import { ApiError, post } from "@/lib/client/api";
import { CATEGORIES } from "./MemoryItem";
import type { MemoryCategory } from "./types";

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
    <form onSubmit={submit} className="card space-y-3" aria-labelledby="add-mem-h" noValidate>
      <h2 id="add-mem-h" className="text-lg font-semibold">Add a memory</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Group" htmlFor="am-cat">
          <select id="am-cat" className="input" value={category} onChange={(e) => setCategory(e.target.value as MemoryCategory)}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Short label" htmlFor="am-key" hint="For example: protein source, work hours, upcoming trip.">
          <input id="am-key" className="input" maxLength={60} value={key} onChange={(e) => setKey(e.target.value)} />
        </Field>
      </div>
      <Field label="What should I remember?" htmlFor="am-val">
        <input id="am-val" className="input" maxLength={300} value={value} onChange={(e) => setValue(e.target.value)} />
      </Field>
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={busy}>{busy ? <Spinner label="Saving" /> : "Save memory"}</button>
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}
