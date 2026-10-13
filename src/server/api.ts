import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/auth";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Returns the signed-in user's id or throws a 401. Every API route starts here. */
export async function requireUser(): Promise<string> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new HttpError(401, "Please sign in.");
  return id;
}

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

/** Maps validation errors to 400, HttpError to its status, and hides internals on anything else. */
export function route(fn: Handler): Handler {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
      if (err instanceof ZodError) {
        return NextResponse.json({ error: "Invalid input", issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, { status: 400 });
      }
      console.error("[api]", req.method, new URL(req.url).pathname, err);
      return NextResponse.json({ error: "Something went wrong saving. Your data is safe — please retry." }, { status: 500 });
    }
  };
}

// ─── Tiny in-memory sliding-window rate limiter (per instance; good enough to protect free-tier quotas) ──
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    throw new HttpError(429, "You're going a bit fast. Give it a few seconds and try again.");
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) for (const [k, v] of buckets) if (!v.length || now - v[v.length - 1] > windowMs) buckets.delete(k);
}

export const json = <T>(data: T, init?: ResponseInit) => NextResponse.json(data, init);
