"use client";
import { get, set } from "idb-keyval";

/**
 * Offline-first write queue backed by IndexedDB. Anything that fails because the network is down is stored
 * and replayed in order when connectivity returns. Server errors (4xx) are dropped — retrying can't fix them.
 */
export interface QueuedItem {
  id: string;
  kind: "chat" | "log";
  url: string;
  body: unknown;
  createdAt: number;
  attempts: number;
}

const KEY = "fittrack-queue";
const FOODS_KEY = "fittrack-frequent-foods";
const EVT = "fittrack:queue";

const read = async (): Promise<QueuedItem[]> => (await get<QueuedItem[]>(KEY)) ?? [];
const emit = (n: number) => typeof window !== "undefined" && window.dispatchEvent(new CustomEvent(EVT, { detail: n }));

export async function queueSize(): Promise<number> {
  try {
    return (await read()).length;
  } catch {
    return 0;
  }
}

export async function enqueue(item: Omit<QueuedItem, "id" | "createdAt" | "attempts">) {
  const q = await read();
  q.push({ ...item, id: crypto.randomUUID(), createdAt: Date.now(), attempts: 0 });
  await set(KEY, q);
  emit(q.length);
}

let flushing = false;

/** Replay queued writes in order. Stops at the first network failure so ordering is preserved. */
export async function flushQueue(): Promise<number> {
  if (flushing || typeof navigator === "undefined" || !navigator.onLine) return 0;
  flushing = true;
  let done = 0;
  try {
    let q = await read();
    while (q.length) {
      const item = q[0];
      try {
        const res = await fetch(item.url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item.body) });
        if (item.kind === "chat" && res.body) await res.body.cancel().catch(() => null); // fire-and-forget: the server still completes the turn
        if (res.status >= 500 && item.attempts < 5) {
          q[0] = { ...item, attempts: item.attempts + 1 };
          await set(KEY, q);
          break;
        }
        q = q.slice(1);
        await set(KEY, q);
        done++;
      } catch {
        break; // still offline
      }
    }
    emit(q.length);
  } finally {
    flushing = false;
  }
  if (done && typeof window !== "undefined") window.dispatchEvent(new Event("fittrack:changed"));
  return done;
}

export function onQueueChange(fn: (n: number) => void) {
  const h = (e: Event) => fn((e as CustomEvent<number>).detail);
  window.addEventListener(EVT, h);
  return () => window.removeEventListener(EVT, h);
}

/** Cache the user's most-logged foods for instant, offline quick-add. */
export async function cacheFrequentFoods() {
  try {
    const res = await fetch("/api/foods?frequent=1");
    if (res.ok) await set(FOODS_KEY, (await res.json()).foods);
  } catch {
    /* offline: keep the previous cache */
  }
}

export interface FrequentFood { food: string; unit: string; count: number; typicalQuantity: number; kcal: number; protein: number }
export const getCachedFoods = async (): Promise<FrequentFood[]> => (await get<FrequentFood[]>(FOODS_KEY)) ?? [];
