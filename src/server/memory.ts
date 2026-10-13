import type { AiMemory, MemoryCategory, MemorySource } from "@prisma/client";
import { db } from "@/lib/db";

/** Words too common to signal relevance. */
const STOP = new Set(["the", "a", "an", "i", "my", "to", "and", "of", "is", "it", "in", "for", "on", "me", "what", "how", "can", "do", "have", "had"]);

const tokens = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w));

/**
 * Memories to inject into the prompt for this message. Preferences, goals and health history are always
 * included (they shape every answer); others only when they share words with the message.
 */
export async function relevantMemories(userId: string, text: string, max = 25): Promise<AiMemory[]> {
  const all = await db.aiMemory.findMany({ where: { userId }, orderBy: { updatedAt: "desc" }, take: 120 });
  const q = new Set(tokens(text));
  const ALWAYS: MemoryCategory[] = ["GOAL", "PREFERENCE", "HEALTH_HISTORY", "IDENTITY"];
  const picked = all
    .map((m) => {
      const overlap = tokens(`${m.key} ${m.value}`).filter((t) => q.has(t)).length;
      return { m, score: (ALWAYS.includes(m.category) ? 1 : 0) + overlap * 2 + m.confidence };
    })
    .filter((x) => ALWAYS.includes(x.m.category) || x.score > x.m.confidence)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((x) => x.m);
  if (picked.length) {
    await db.aiMemory.updateMany({ where: { id: { in: picked.map((m) => m.id) } }, data: { lastUsedAt: new Date() } });
  }
  return picked;
}

export function memoryPrompt(mems: AiMemory[]): string {
  if (!mems.length) return "None yet.";
  return mems.map((m) => `- [${m.category}] ${m.key}: ${m.value}${m.source === "INFERRED" ? " (inferred)" : ""}`).join("\n");
}

export async function remember(
  userId: string,
  m: { category: MemoryCategory; key: string; value: string; source?: MemorySource; confidence?: number },
) {
  const key = m.key.toLowerCase().trim().replace(/\s+/g, "_").slice(0, 60);
  const source = m.source ?? "EXPLICIT";
  const existing = await db.aiMemory.findUnique({ where: { userId_category_key: { userId, category: m.category, key } } });
  // An inferred memory never overwrites something the user said explicitly.
  if (existing && existing.source === "EXPLICIT" && source === "INFERRED") return existing;
  return db.aiMemory.upsert({
    where: { userId_category_key: { userId, category: m.category, key } },
    update: { value: m.value.slice(0, 300), source, confidence: m.confidence ?? (source === "EXPLICIT" ? 1 : 0.6) },
    create: { userId, category: m.category, key, value: m.value.slice(0, 300), source, confidence: m.confidence ?? (source === "EXPLICIT" ? 1 : 0.6) },
  });
}

/** Remembered bone-in preference for chicken/meat: true, false, or null if unknown. */
export async function boneInPreference(userId: string): Promise<boolean | null> {
  const prefs = await db.aiMemory.findMany({ where: { userId, category: "PREFERENCE" }, orderBy: { updatedAt: "desc" } });
  // The model names keys freely ("chicken_cut", "bone_in_chicken"…), so match on meaning, not exact key.
  for (const m of prefs) {
    const text = `${m.key} ${m.value}`.toLowerCase();
    if (!/chicken|meat|mutton|lamb|bone/.test(text)) continue;
    if (/boneless|without bone|no bone/.test(text)) return false;
    if (/bone/.test(text)) return true;
  }
  return null;
}
