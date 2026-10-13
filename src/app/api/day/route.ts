import { isDateStr } from "@/lib/dates";
import { HttpError, json, requireUser, route } from "@/server/api";
import { loadUserContext } from "@/server/context";
import { getDaySummary } from "@/server/summary";

export const dynamic = "force-dynamic";

/** GET /api/day?date=YYYY-MM-DD → full DaySummary (meals, totals, activity, targets, estimates). */
export const GET = route(async (req) => {
  const userId = await requireUser();
  const ctx = await loadUserContext(userId);
  const d = new URL(req.url).searchParams.get("date") ?? ctx.today;
  if (!isDateStr(d)) throw new HttpError(400, "date must be YYYY-MM-DD");
  return json(await getDaySummary(ctx, d));
});
