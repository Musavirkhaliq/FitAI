import { llmConfigured } from "@/lib/providers/llm";
import { sttConfigured } from "@/lib/providers/stt";
import { ttsConfigured } from "@/lib/providers/tts";
import { json, requireUser, route } from "@/server/api";

export const dynamic = "force-dynamic";

/**
 * What the server can do right now, so the client can pick the best path: server transcription vs the browser's own
 * speech recognition, cloud voice vs browser voice. Booleans only: no keys or provider details leave the server.
 */
export const GET = route(async () => {
  await requireUser();
  return json({ llm: llmConfigured(), stt: sttConfigured(), tts: ttsConfigured() ?? "browser" });
});
