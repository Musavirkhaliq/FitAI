/** Normalise a food name for matching: lower-case, strip punctuation and filler words. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|a|an|of|some|my|homemade|home made|fresh|and|with)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Classic Levenshtein edit distance, O(n·m) with two rows. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

const stem = (w: string) => (w.length > 3 ? w.replace(/ies$/, "y").replace(/([^s])s$/, "$1") : w);

/**
 * Similarity 0–1 between a query and a candidate name. Combines whole-string edit similarity with
 * token overlap (each query token matched to its closest candidate token), so "egg whites" matches
 * "egg white" and "masur dal" matches "masoor dal" despite the spelling difference.
 */
export function similarity(queryRaw: string, candidateRaw: string): number {
  const q = normalize(queryRaw);
  const c = normalize(candidateRaw);
  if (!q || !c) return 0;
  if (q === c) return 1;
  const whole = 1 - levenshtein(q, c) / Math.max(q.length, c.length);

  const qt = q.split(" ").map(stem);
  const ct = c.split(" ").map(stem);
  let sum = 0;
  for (const t of qt) {
    let best = 0;
    for (const u of ct) {
      const s = t === u ? 1 : 1 - levenshtein(t, u) / Math.max(t.length, u.length);
      if (s > best) best = s;
    }
    sum += best >= 0.65 ? best : 0;
  }
  const qCoverage = sum / qt.length;
  // Penalise candidates with many extra tokens ("chicken" should prefer "chicken breast" over a long dish name).
  const extra = Math.max(0, ct.length - qt.length);
  const tokenScore = qCoverage * (1 - Math.min(0.3, extra * 0.06));
  return Math.max(whole, tokenScore);
}

export function bestMatches<T>(query: string, items: T[], nameOf: (t: T) => string, limit = 5, minScore = 0.55) {
  return items
    .map((item) => ({ item, score: similarity(query, nameOf(item)) }))
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
