import { z } from "zod";
import { HttpError, rateLimit, requireUser, route } from "@/server/api";
import { synthesize, TtsUnavailableError, TTS_MAX_CHARS } from "@/lib/providers/tts";

export const runtime = "nodejs";
export const maxDuration = 20;

const schema = z.object({ text: z.string().min(1).max(TTS_MAX_CHARS * 2) });

/** MP3 from Google Cloud TTS. 501 tells the client to fall back to the browser's built-in voice. */
export const POST = route(async (req) => {
  const userId = await requireUser();
  rateLimit(`tts:${userId}`, 60, 60_000);
  const { text } = schema.parse(await req.json());
  try {
    const audio = await synthesize(text);
    return new Response(new Uint8Array(audio), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=3600" } });
  } catch (err) {
    if (err instanceof TtsUnavailableError) throw new HttpError(501, "Cloud voice not configured.");
    console.error("[tts]", err);
    throw new HttpError(502, "Voice is unavailable right now.");
  }
});
