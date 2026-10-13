import { db } from "@/lib/db";
import { json, requireUser, route } from "@/server/api";

export const dynamic = "force-dynamic";

/** GET ?limit=40 → recent chat messages (oldest first) with their structured cards. */
export const GET = route(async (req) => {
  const userId = await requireUser();
  const limit = Math.min(100, Math.max(1, Number(new URL(req.url).searchParams.get("limit")) || 40));
  const rows = await db.aiConversation.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit });
  return json({
    messages: rows.reverse().map((r) => ({
      id: r.id,
      role: r.role,
      content: r.content,
      createdAt: r.createdAt,
      cards: (r.meta as { cards?: unknown[] } | null)?.cards ?? [],
      pending: !!(r.meta as { pending?: unknown } | null)?.pending,
    })),
  });
});

export const DELETE = route(async () => {
  const userId = await requireUser();
  const r = await db.aiConversation.deleteMany({ where: { userId } });
  return json({ deleted: r.count });
});
