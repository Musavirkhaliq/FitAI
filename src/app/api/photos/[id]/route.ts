import { db } from "@/lib/db";
import { HttpError, requireUser, route } from "@/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Serves one photo to its owner only. The content type comes from the validated upload, never from the URL. */
export const GET = route(async (_req, ctx) => {
  const userId = await requireUser();
  const { id } = await ctx.params;
  const photo = await db.progressPhoto.findFirst({ where: { id, userId }, select: { bytes: true, mime: true } });
  if (!photo) throw new HttpError(404, "Photo not found.");
  return new Response(new Uint8Array(photo.bytes), {
    headers: {
      "Content-Type": photo.mime,
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; sandbox",
    },
  });
});
