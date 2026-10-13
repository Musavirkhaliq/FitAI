import { NextResponse } from "next/server";
import { alternativeTranscript } from "@/server/ai/agents";
import { HttpError, rateLimit, requireUser, route } from "@/server/api";
import { SttUnavailableError, transcribe } from "@/lib/providers/stt";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 8 * 1024 * 1024;

export const POST = route(async (req) => {
  const userId = await requireUser();
  rateLimit(`stt:${userId}`, 18, 60_000); // Groq Whisper free tier: 20 requests/minute

  const form = await req.formData();
  const file = form.get("audio");
  if (!(file instanceof Blob) || file.size === 0) throw new HttpError(400, "No audio received.");
  if (file.size > MAX_BYTES) throw new HttpError(413, "That recording is too long. Try a shorter message.");

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const result = await transcribe(buf, file.type || "audio/webm");
    if (!result.text) return NextResponse.json({ text: "", confidence: 0, alternative: null, provider: result.provider });
    const alternative = result.confidence < 0.7 ? await alternativeTranscript(result.text) : null;
    return NextResponse.json({ ...result, alternative });
  } catch (err) {
    if (err instanceof SttUnavailableError) throw new HttpError(503, "Voice input isn't set up on the server yet. You can type instead.");
    throw err;
  }
});
