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

type ProviderName = "groq" | "local" | "deepgram" | "assemblyai";

/** Which providers have what they need. "local" only needs a base URL that isn't the Groq default. */
export function sttAvailable(): Record<ProviderName, boolean> {
  const e = env();
  return {
    groq: !!sttKey(),
    local: e.STT_PROVIDER === "local" && !!e.STT_BASE_URL,
    deepgram: !!e.DEEPGRAM_API_KEY,
    assemblyai: !!e.ASSEMBLYAI_API_KEY,
  };
}

export const sttConfigured = () => Object.values(sttAvailable()).some(Boolean);

/** Whisper over an OpenAI-compatible endpoint: Groq's hosted one, or your own faster-whisper / whisper.cpp server. */
async function whisper(audio: Buffer, mime: string, language: string | undefined, local: boolean): Promise<Transcription> {
  const key = local ? env().STT_API_KEY || "local" : sttKey();
  if (!key) throw new SttUnavailableError();
  const client = new OpenAI({ apiKey: key, baseURL: env().STT_BASE_URL, maxRetries: 0, timeout: local ? 60_000 : 30_000 });
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
  return { text: res.text.trim(), confidence, provider: local ? "local-whisper" : "groq-whisper" };
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

/**
 * AssemblyAI pre-recorded transcription: upload the bytes, create a transcript, poll until done. Billed per audio minute
 * (not streaming sessions), so there's no WebSocket to leave open.
 */
async function assemblyai(audio: Buffer): Promise<Transcription> {
  const key = env().ASSEMBLYAI_API_KEY;
  if (!key) throw new SttUnavailableError();
  const base = "https://api.assemblyai.com/v2";
  const headers = { authorization: key };
  const up = await fetch(`${base}/upload`, { method: "POST", headers: { ...headers, "content-type": "application/octet-stream" }, body: new Uint8Array(audio), signal: AbortSignal.timeout(30_000) });
  if (!up.ok) throw new Error(`AssemblyAI upload ${up.status}`);
  const { upload_url } = (await up.json()) as { upload_url: string };
  const created = await fetch(`${base}/transcript`, {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify({ audio_url: upload_url, language_code: "en", punctuate: true, format_text: true, word_boost: ["dal", "paneer", "curd", "katori", "RPE", "reps"] }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!created.ok) throw new Error(`AssemblyAI create ${created.status}`);
  const { id } = (await created.json()) as { id: string };
  const deadline = Date.now() + 40_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 900));
    const poll = await fetch(`${base}/transcript/${id}`, { headers, signal: AbortSignal.timeout(10_000) });
    if (!poll.ok) throw new Error(`AssemblyAI poll ${poll.status}`);
    const j = (await poll.json()) as { status: string; text?: string; confidence?: number; error?: string };
    if (j.status === "completed") return { text: (j.text ?? "").trim(), confidence: j.confidence ?? 0.6, provider: "assemblyai" };
    if (j.status === "error") throw new Error(`AssemblyAI: ${j.error ?? "failed"}`);
  }
  throw new Error("AssemblyAI timed out");
}

/** Primary provider first, then every other configured one. */
export async function transcribe(audio: Buffer, mime: string, language?: string): Promise<Transcription> {
  const avail = sttAvailable();
  const primary = env().STT_PROVIDER;
  const order = [primary, ...(["groq", "deepgram", "assemblyai", "local"] as ProviderName[]).filter((p) => p !== primary)].filter((p) => avail[p]);
  if (!order.length) throw new SttUnavailableError();
  let lastErr: unknown = new SttUnavailableError();
  for (const p of order) {
    try {
      if (p === "groq") return await whisper(audio, mime, language, false);
      if (p === "local") return await whisper(audio, mime, language, true);
      if (p === "deepgram") return await deepgram(audio, mime);
      return await assemblyai(audio);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}
