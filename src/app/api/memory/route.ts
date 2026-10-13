import { z } from "zod";
import { db } from "@/lib/db";
import { HttpError, json, requireUser, route } from "@/server/api";
import { remember } from "@/server/memory";

export const dynamic = "force-dynamic";

const category = z.enum(["GOAL", "IDENTITY", "LIFESTYLE", "PREFERENCE", "EVENT", "HEALTH_HISTORY", "MOOD"]);

/** The Memory page: see, add, edit and delete everything the coach remembers. */
export const GET = route(async () => {
  const userId = await requireUser();
  return json({ memories: await db.aiMemory.findMany({ where: { userId }, orderBy: [{ category: "asc" }, { updatedAt: "desc" }] }) });
});

export const POST = route(async (req) => {
  const userId = await requireUser();
  const b = z.object({ category, key: z.string().min(1).max(60), value: z.string().min(1).max(300) }).parse(await req.json());
  return json({ memory: await remember(userId, { ...b, source: "EXPLICIT" }) }, { status: 201 });
});

export const PATCH = route(async (req) => {
  const userId = await requireUser();
  const b = z.object({ id: z.string(), value: z.string().min(1).max(300).optional(), category: category.optional(), key: z.string().min(1).max(60).optional() }).parse(await req.json());
  const cur = await db.aiMemory.findFirst({ where: { id: b.id, userId } });
  if (!cur) throw new HttpError(404, "Memory not found.");
  const memory = await db.aiMemory.update({
    where: { id: cur.id },
    // Editing by hand makes it explicit and fully trusted.
    data: { value: b.value ?? cur.value, category: b.category ?? cur.category, key: b.key ? b.key.toLowerCase().replace(/\s+/g, "_") : cur.key, source: "EXPLICIT", confidence: 1 },
  });
  return json({ memory });
});

export const DELETE = route(async (req) => {
  const userId = await requireUser();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) throw new HttpError(400, "id required");
  const r = await db.aiMemory.deleteMany({ where: { id, userId } });
  return json({ deleted: r.count });
});
