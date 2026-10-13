import { z } from "zod";
import { isDateStr } from "@/lib/dates";
import { rateLimit, requireUser, route } from "@/server/api";
import { buildTable, toCsv, toPdf, toXlsx } from "@/server/exporter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const q = z.object({
  type: z.enum(["nutrition", "weight", "activity", "workouts", "measurements"]),
  format: z.enum(["csv", "xlsx", "pdf"]).default("csv"),
  from: z.string().refine(isDateStr).optional(),
  to: z.string().refine(isDateStr).optional(),
});

/** GET /api/export?type=nutrition&format=csv|xlsx|pdf&from=&to= */
export const GET = route(async (req) => {
  const userId = await requireUser();
  rateLimit(`export:${userId}`, 10, 60_000);
  const p = Object.fromEntries(new URL(req.url).searchParams);
  const { type, format, from, to } = q.parse(p);
  const table = await buildTable(userId, type, from, to);
  const name = `sukoonfit-${type}-${new Date().toISOString().slice(0, 10)}`;
  const dl = (ext: string) => `attachment; filename="${name}.${ext}"`;
  if (format === "csv") return new Response(toCsv(table), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": dl("csv") } });
  if (format === "xlsx") return new Response(new Uint8Array(await toXlsx(table)), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": dl("xlsx") } });
  return new Response(new Uint8Array(await toPdf(table)), { headers: { "Content-Type": "application/pdf", "Content-Disposition": dl("pdf") } });
});
