import OpenAI, { toFile } from "openai";
import { env, sttKey } from "../env";

export interface Transcription {
  text: string;
  /** 0–1. Below 0.7 the UI asks "Did you mean…?" */
  confidence: number;
  provider: string;
}

export class SttUnavailableError extends Error {
  constructor() {
    super("Speech-to-text isn't configured. Set STT_API_KEY (or LLM_API_KEY for Groq) in .env.local.");
    this.name = "SttUnavailableError";
  }
}

/** Groq Whisper via the OpenAI-compatible endpoint. Confidence is derived from segment log-probs. */
async function groqWhisper(audio: Buffer, mime: string, language?: string): Promise<Transcription> {
  const key = sttKey();
  if (!key) throw new SttUnavailableError();
  const client = new OpenAI({ apiKey: key, baseURL: env().STT_BASE_URL, maxRetries: 0, timeout: 30_000 });
  const ext = mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg" : mime.includes("wav") ? "wav" : "webm";
  const file = await toFile(audio, `speech.${ext}`, { type: mime });
  const res = (await client.audio.transcriptions.create({
    file,
    model: env().STT_MODEL,
    response_format: "verbose_json",
    language,
    temperature: 0,
    // Biases decoding toward the vocabulary users actually say.
    prompt: "Fitness and nutrition log: grams, kilos, reps, sets, dal, curd, paneer, chicken, egg whites, bench press, RPE.",
  })) as unknown as { text: string; segments?: { avg_logprob: number; no_speech_prob?: number }[] };
  const segs = res.segments ?? [];
  let confidence = 0.85;
  if (segs.length) {
    const mean = segs.reduce((s, x) => s + x.avg_logprob, 0) / segs.length;
    confidence = Math.max(0, Math.min(1, Math.exp(mean)));
    const noSpeech = Math.max(...segs.map((s) => s.no_speech_prob ?? 0));
    if (noSpeech > 0.8) confidence = Math.min(confidence, 0.2);
  }
  return { text: res.text.trim(), confidence, provider: "groq-whisper" };
}

async function deepgram(audio: Buffer, mime: string): Promise<Transcription> {
  const key = env().DEEPGRAM_API_KEY;
  if (!key) throw new SttUnavailableError();
  const res = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true", {
    method: "POST",
    headers: { Authorization: `Token ${key}`, "Content-Type": mime },
    body: new Uint8Array(audio),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Deepgram ${res.status}`);
  const j = (await res.json()) as { results?: { channels?: { alternatives?: { transcript: string; confidence: number }[] }[] } };
  const alt = j.results?.channels?.[0]?.alternatives?.[0];
  return { text: alt?.transcript?.trim() ?? "", confidence: alt?.confidence ?? 0.5, provider: "deepgram" };
}

/** Primary provider first, then the other if it's configured. */
export async function transcribe(audio: Buffer, mime: string, language?: string): Promise<Transcription> {
  const order = env().STT_PROVIDER === "deepgram" ? [deepgram, groqWhisper] : [groqWhisper, deepgram];
  let lastErr: unknown = new SttUnavailableError();
  for (const fn of order) {
    try {
      return await (fn === groqWhisper ? groqWhisper(audio, mime, language) : deepgram(audio, mime));
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}
