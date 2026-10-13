"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { enqueue } from "./queue";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const isOfflineError = (e: unknown) => e instanceof TypeError || (typeof navigator !== "undefined" && !navigator.onLine);

export async function api<T = unknown>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, { ...init, headers: { ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...init.headers } });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, j.error ?? "Something went wrong. Please try again.");
  }
  return res.json() as Promise<T>;
}

export const post = <T = unknown>(url: string, body: unknown) => api<T>(url, { method: "POST", body: JSON.stringify(body) });
export const patch = <T = unknown>(url: string, body: unknown) => api<T>(url, { method: "PATCH", body: JSON.stringify(body) });
export const del = <T = unknown>(url: string) => api<T>(url, { method: "DELETE" });

/** Tell every mounted screen that stored data changed; they refetch quietly in the background. */
export const notifyChanged = () => typeof window !== "undefined" && window.dispatchEvent(new Event("fittrack:changed"));

export type LogTool =
  | "log_food" | "log_weight" | "log_activity" | "log_sleep" | "log_water" | "log_produce" | "log_measurement"
  | "log_note" | "log_workout_set" | "delete_entry" | "edit_food_entry" | "update_goal";

/**
 * Save through the validated tool endpoint. Offline → queued in IndexedDB and replayed later
 * (resolves with { queued: true } so the UI can stay optimistic).
 */
export async function logTool<T = unknown>(tool: LogTool, args: Record<string, unknown>): Promise<{ queued: false; result: T } | { queued: true }> {
  try {
    const r = await post<{ result: T }>("/api/log", { tool, args });
    notifyChanged();
    return { queued: false, result: r.result };
  } catch (e) {
    if (isOfflineError(e)) {
      await enqueue({ kind: "log", url: "/api/log", body: { tool, args } });
      return { queued: true };
    }
    throw e;
  }
}

// ─── Tiny stale-while-revalidate fetch hook ────────────────────────────────────────────────────
const cache = new Map<string, unknown>();

export interface ApiState<T> {
  data: T | undefined;
  error: string | null;
  /** True only for the first load with nothing cached (show skeletons). Background refreshes don't set it. */
  loading: boolean;
  refresh: () => Promise<void>;
  setData: (fn: (prev: T | undefined) => T | undefined) => void;
}

export function useApi<T>(url: string | null): ApiState<T> {
  const [data, setDataState] = useState<T | undefined>(url ? (cache.get(url) as T | undefined) : undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!url && !cache.has(url));
  const alive = useRef(true);
  const reqId = useRef(0);

  const load = useCallback(async () => {
    if (!url) return;
    const id = ++reqId.current;
    try {
      const d = await api<T>(url);
      if (!alive.current || id !== reqId.current) return;
      cache.set(url, d);
      setDataState(d);
      setError(null);
    } catch (e) {
      if (!alive.current || id !== reqId.current) return;
      setError(isOfflineError(e) ? "You're offline. Showing the last data I have." : (e as Error).message);
    } finally {
      if (alive.current && id === reqId.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    alive.current = true;
    setDataState(url ? (cache.get(url) as T | undefined) : undefined);
    setLoading(!!url && !cache.has(url!));
    void load();
    const h = () => void load();
    window.addEventListener("fittrack:changed", h);
    window.addEventListener("online", h);
    return () => {
      alive.current = false;
      window.removeEventListener("fittrack:changed", h);
      window.removeEventListener("online", h);
    };
  }, [url, load]);

  const setData = useCallback(
    (fn: (prev: T | undefined) => T | undefined) => {
      setDataState((prev) => {
        const next = fn(prev);
        if (url && next !== undefined) cache.set(url, next);
        return next;
      });
    },
    [url],
  );

  return { data, error, loading, refresh: load, setData };
}
