import { z } from "zod";
import { rateLimit, requireUser, HttpError } from "@/server/api";
import { runTurn } from "@/server/ai/pipeline";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const schema = z.object({ text: z.string().min(1).max(2000), source: z.enum(["VOICE", "TEXT"]).default("TEXT") });

/** Server-sent events: each message is one PipelineEvent as JSON. */
export async function POST(req: Request) {
  let userId: string;
  let body: z.infer<typeof schema>;
  try {
    userId = await requireUser();
    rateLimit(`chat:${userId}`, 25, 60_000); // keeps us inside Groq's 30 RPM free limit
    body = schema.parse(await req.json());
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 400;
    const message = err instanceof HttpError ? err.message : "I had trouble understanding that. Could you rephrase, or type it instead?";
    return Response.json({ error: message }, { status });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        for await (const ev of runTurn(userId, { text: body.text, source: body.source, signal: req.signal })) send(ev);
      } catch (err) {
        console.error("[chat]", err);
        send({ type: "error", message: "I had trouble understanding that. Could you rephrase, or type it instead?" });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" },
  });
}
