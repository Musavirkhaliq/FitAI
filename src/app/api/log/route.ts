import { z } from "zod";
import { HttpError, json, rateLimit, requireUser, route } from "@/server/api";
import { callTool } from "@/server/tools";

/**
 * Manual / optimistic-UI logging. Same validated tools the AI uses, exposed for forms, quick-add buttons
 * and the offline queue. Only whitelisted tools are reachable; arguments are validated inside callTool.
 */
const ALLOWED = [
  "log_food", "log_weight", "log_activity", "log_sleep", "log_water", "log_produce", "log_measurement", "log_note",
  "log_workout_set", "delete_entry", "edit_food_entry", "update_goal",
] as const;

const schema = z.object({ tool: z.enum(ALLOWED), args: z.record(z.unknown()) });

export const POST = route(async (req) => {
  const userId = await requireUser();
  rateLimit(`log:${userId}`, 120, 60_000);
  const { tool, args } = schema.parse(await req.json());
  try {
    return json({ ok: true, result: await callTool(userId, tool, args) });
  } catch (err) {
    const msg = (err as Error).message;
    if (msg.startsWith("Invalid arguments")) throw new HttpError(400, msg);
    throw err;
  }
});
