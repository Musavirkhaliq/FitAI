"use client";
import { Check } from "lucide-react";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { Field, Spinner } from "@/components/ui";
import { ApiError, patch, type ApiState } from "@/lib/client/api";
import type { ProfilePatch, ProfileResponse } from "./types";

export type SaveState = "idle" | "saving" | "saved" | "error";

export interface Saver {
  state: SaveState;
  error: string | null;
  /** Server warnings from the last save (e.g. calorie floor), shown verbatim. */
  warnings: string[];
  /** Resolves with the saved profile and goal, or null on failure. `optimistic` updates the screen at once and is rolled back on failure. */
  save: (body: ProfilePatch, optimistic?: (prev: ProfileResponse) => ProfileResponse) => Promise<Pick<ProfileResponse, "profile" | "goal"> | null>;
}

/** One saver per card so each shows its own "Saved" / error status. */
export function useSaver(api: ApiState<ProfileResponse>): Saver {
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const latest = useRef(0);
  const { setData, refresh } = api;

  const save = useCallback(
    async (body: ProfilePatch, optimistic?: (prev: ProfileResponse) => ProfileResponse) => {
      const id = ++latest.current;
      setState("saving");
      setError(null);
      if (optimistic) setData((prev) => (prev ? optimistic(prev) : prev));
      try {
        const r = await patch<Pick<ProfileResponse, "profile" | "goal"> & { warnings: string[] }>("/api/profile", body);
        // A newer save is already in flight and will land last; don't flash older values over it.
        if (id === latest.current) {
          setData((prev) => ({
            user: body.name !== undefined && prev?.user ? { ...prev.user, name: body.name || null } : prev?.user ?? null,
            profile: r.profile,
            goal: r.goal,
          }));
          setWarnings(r.warnings ?? []);
          setState("saved");
        }
        return r;
      } catch (e) {
        if (optimistic) void refresh();
        if (id === latest.current) {
          setError(e instanceof ApiError ? e.message : "I couldn't save that. Please check your connection and try again.");
          setState("error");
        }
        return null;
      }
    },
    [setData, refresh],
  );

  return { state, error, warnings, save };
}

/** Polite live region so "Saved" is announced without stealing focus. */
export function SaveStatus({ saver }: { saver: Saver }) {
  return (
    <div aria-live="polite" className="min-h-[20px] text-sm">
      {saver.state === "saving" && <span className="inline-flex items-center gap-1.5 text-muted"><Spinner label="Saving" /> Saving…</span>}
      {saver.state === "saved" && <span className="inline-flex items-center gap-1 text-good"><Check className="h-4 w-4" aria-hidden /> Saved</span>}
      {saver.state === "error" && <span role="alert" className="text-bad">{saver.error}</span>}
    </div>
  );
}

export function SectionCard({ id, title, description, children }: { id: string; title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="card space-y-4" aria-labelledby={id}>
      <div>
        <h2 id={id} className="text-lg font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function NumberField({
  label, value, onChange, unit, hint, error, id, inputMode = "decimal",
}: {
  label: string; value: string; onChange: (v: string) => void; unit?: string; hint?: ReactNode; error?: string | null; id: string; inputMode?: "decimal" | "numeric";
}) {
  const errId = `${id}-err`;
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <div className="flex items-center gap-2">
        <input id={id} className="input" inputMode={inputMode} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={error ? true : undefined} aria-describedby={error ? errId : undefined} />
        {unit && <span className="shrink-0 text-sm text-muted">{unit}</span>}
      </div>
      {error && <p id={errId} role="alert" className="mt-1 text-sm text-bad">{error}</p>}
    </Field>
  );
}

/** Accepts "72,5" as well as "72.5"; empty or non-numeric gives null. */
export function num(s: string): number | null {
  const t = s.trim().replace(",", ".");
  return t && /^-?\d*\.?\d+$/.test(t) ? Number(t) : null;
}

export function inRange(s: string, min: number, max: number, whole: boolean, what: string): string | null {
  const n = num(s);
  if (n == null || (whole && !Number.isInteger(n))) return `${what}: please enter ${whole ? "a whole number" : "a number"}.`;
  if (n < min || n > max) return `${what}: should be between ${min.toLocaleString("en-US")} and ${max.toLocaleString("en-US")}.`;
  return null;
}

export const DISCLAIMER_TEXT = "AI can make mistakes. Double-check important results.";
export const MEDICAL_TEXT = "For pain, symptoms, or a medical condition, the next step is a doctor or physiotherapist.";
