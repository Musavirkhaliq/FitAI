"use client";
import { Check, ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { Field, Spinner, clsx } from "@/components/ui";
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

/** One saver per group so each shows its own "Saved" / error status. */
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

/* ───────────────────────── iOS-style inset grouped lists ───────────────────────── */

export type Tint = "brand" | "cal" | "protein" | "steps" | "sleep" | "fiber" | "bad" | "neutral";
const TINT: Record<Tint, string> = {
  brand: "bg-brand/15 text-brand",
  cal: "bg-cal/15 text-cal",
  protein: "bg-protein/15 text-protein",
  steps: "bg-steps/15 text-steps",
  sleep: "bg-sleep/15 text-sleep",
  fiber: "bg-fiber/15 text-fiber",
  bad: "bg-bad/15 text-bad",
  neutral: "bg-surface-3 text-muted",
};

/** The little tinted rounded square that carries a row's icon. Decorative. */
export function IconTile({ icon: Icon, tint = "brand" }: { icon: LucideIcon; tint?: Tint }) {
  return (
    <span aria-hidden className={clsx("flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.6rem]", TINT[tint])}>
      <Icon className="h-[18px] w-[18px]" />
    </span>
  );
}

/**
 * A titled, rounded group with hairline dividers. `description` and `status` sit underneath, like iOS group footers.
 */
export function Group({ id, title, description, status, tone, children, index = 0 }: {
  id: string; title: string; description?: ReactNode; status?: ReactNode; tone?: "danger"; children: ReactNode; index?: number;
}) {
  return (
    <section aria-labelledby={id} className="rise" style={{ ["--i" as string]: index }}>
      <h2 id={id} className={clsx("eyebrow mb-2 px-2", tone === "danger" && "!text-bad")}>{title}</h2>
      <div className={clsx("divide-y divide-border overflow-hidden rounded-[1.5rem] border bg-surface shadow-tile", tone === "danger" ? "border-bad/40" : "border-border")}>
        {children}
      </div>
      {(description || status) && (
        <div className="mt-2 space-y-1 px-2">
          {description && <p className="text-xs leading-relaxed text-muted">{description}</p>}
          {status}
        </div>
      )}
    </section>
  );
}

const ROW = "flex min-h-[56px] w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-surface-2/70 active:bg-surface-2 disabled:opacity-60";

/** A list row: icon tile, label, value on the right, chevron when it opens something. */
export function Row({ icon, tint, label, hint, value, onClick, href, danger, disabled, opens }: {
  icon: LucideIcon; tint?: Tint; label: string; hint?: ReactNode; value?: ReactNode; onClick?: () => void; href?: string; danger?: boolean; disabled?: boolean;
  /** True when tapping opens a sheet (adds aria-haspopup). */
  opens?: boolean;
}) {
  const inner = (
    <>
      <IconTile icon={icon} tint={tint} />
      <span className="min-w-0 flex-1 py-1">
        <span className={clsx("block font-medium leading-snug", danger && "text-bad")}>{label}</span>
        {hint && <span className="mt-0.5 block text-sm leading-snug text-muted">{hint}</span>}
      </span>
      {value != null && value !== "" && <span className="max-w-[52%] truncate text-right text-sm text-muted">{value}</span>}
      {(onClick || href) && !danger && <ChevronRight className="h-4 w-4 shrink-0 text-muted/70" aria-hidden />}
    </>
  );
  if (href) return <Link href={href} className={ROW}>{inner}</Link>;
  if (onClick) return <button type="button" onClick={onClick} disabled={disabled} className={ROW} aria-haspopup={opens ? "dialog" : undefined}>{inner}</button>;
  return <div className={ROW}>{inner}</div>;
}

/** A row whose value is picked from a native list. The select sits invisibly over the whole row, so the OS picker opens on tap. */
export function SelectRow({ icon, tint, label, id, value, display, onChange, children }: {
  icon: LucideIcon; tint?: Tint; label: string; id: string; value: string | number; display: ReactNode; onChange: (v: string) => void; children: ReactNode;
}) {
  return (
    <div className="relative focus-within:bg-surface-2/70 focus-within:ring-2 focus-within:ring-inset focus-within:ring-brand">
      <div className={ROW} aria-hidden>
        <IconTile icon={icon} tint={tint} />
        <span className="min-w-0 flex-1 font-medium leading-snug">{label}</span>
        <span className="text-sm text-muted">{display}</span>
        <ChevronRight className="h-4 w-4 shrink-0 rotate-90 text-muted/70" />
      </div>
      <select id={id} aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0">
        {children}
      </select>
    </div>
  );
}

/** Padding wrapper for content that lives inside a group (toggles, free text). */
export function GroupBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("px-4", className)}>{children}</div>;
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
