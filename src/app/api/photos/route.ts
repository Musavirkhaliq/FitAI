import { z } from "zod";
import { db } from "@/lib/db";
import { isDateStr } from "@/lib/dates";
import { HttpError, json, rateLimit, requireUser, route } from "@/server/api";
import { loadUserContext } from "@/server/context";
import { MAX_PHOTO_BYTES, MAX_PHOTOS_PER_USER, POSES, sniffImage } from "@/server/photos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET → photo metadata, newest first (image bytes are served by /api/photos/[id]). */
export const GET = route(async () => {
  const userId = await requireUser();
  const photos = await db.progressPhoto.findMany({
    where: { userId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: { id: true, date: true, pose: true, notes: true, size: true, mime: true, createdAt: true },
    take: MAX_PHOTOS_PER_USER,
  });
  return json({ photos: photos.map((p) => ({ ...p, url: `/api/photos/${p.id}` })) });
});

const meta = z.object({
  date: z.string().refine(isDateStr, "date must be YYYY-MM-DD").optional(),
  pose: z.enum(POSES).default("FRONT"),
  notes: z.string().trim().max(300).optional(),
});

/** POST multipart: file (jpeg/png/webp ≤ 1.5 MB), date, pose, notes. */
export const POST = route(async (req) => {
  const userId = await requireUser();
  rateLimit(`photo:${userId}`, 20, 60 * 60_000);
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) throw new HttpError(400, "No photo received.");
  if (file.size > MAX_PHOTO_BYTES) throw new HttpError(413, "That photo is too large. Try a smaller one.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = sniffImage(bytes);
  if (!mime) throw new HttpError(415, "Please upload a JPEG, PNG or WebP image.");

  const ctx = await loadUserContext(userId);
  const m = meta.parse({
    date: (form.get("date") as string) || ctx.today,
    pose: (form.get("pose") as string) || "FRONT",
    notes: (form.get("notes") as string) || undefined,
  });
  if (await db.progressPhoto.count({ where: { userId } }) >= MAX_PHOTOS_PER_USER) throw new HttpError(409, "You've reached the photo limit. Delete some older photos first.");

  const row = await db.progressPhoto.create({
    data: { userId, date: m.date ?? ctx.today, pose: m.pose, notes: m.notes ?? null, mime, bytes, size: bytes.length },
    select: { id: true, date: true, pose: true, notes: true, size: true, mime: true, createdAt: true },
  });
  return json({ photo: { ...row, url: `/api/photos/${row.id}` } }, { status: 201 });
});

export const DELETE = route(async (req) => {
  const userId = await requireUser();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) throw new HttpError(400, "id required");
  const r = await db.progressPhoto.deleteMany({ where: { id, userId } });
  return json({ deleted: r.count });
});
