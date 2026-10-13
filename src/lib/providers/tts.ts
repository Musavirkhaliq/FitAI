import { env } from "../env";

export class TtsUnavailableError extends Error {
  constructor() {
    super("Cloud TTS isn't configured; the browser voice will be used.");
    this.name = "TtsUnavailableError";
  }
}

/** Hard cap per request: Neural2 free tier is 1M chars/month, ElevenLabs free is ~10k credits, so never send long text. */
export const TTS_MAX_CHARS = 600;

const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Strip markdown and symbols that sound bad when read aloud. */
export function speakable(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_`#>|]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/~(\d)/g, "about $1")
    .replace(/(\d)\s?kcal/gi, "$1 calories")
    .replace(/(\d)\s?kg\b/gi, "$1 kilos")
    .replace(/(\d)\s?g\b/gi, "$1 grams")
    .replace(/\s+/g, " ")
    .trim();
}

/** SSML with short pauses between sentences, which helps listeners process (WCAG-friendly speech). */
export function toSsml(text: string): string {
  const sentences = speakable(text).split(/(?<=[.!?])\s+/).filter(Boolean).map(escapeXml);
  return `<speak>${sentences.join('<break time="350ms"/>')}</speak>`;
}

export function ttsConfigured(): "google" | "elevenlabs" | null {
  const e = env();
  if (e.TTS_PROVIDER === "elevenlabs" && e.ELEVENLABS_API_KEY) return "elevenlabs";
  if (e.TTS_PROVIDER === "google" && e.GOOGLE_TTS_API_KEY) return "google";
  return null;
}

/** Google Cloud Text-to-Speech over REST. Returns MP3 bytes. */
async function googleTts(text: string): Promise<Buffer> {
  const e = env();
  const voice = e.GOOGLE_TTS_VOICE;
  const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(e.GOOGLE_TTS_API_KEY!)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { ssml: toSsml(text) },
      voice: { languageCode: voice.split("-").slice(0, 2).join("-"), name: voice },
      audioConfig: { audioEncoding: "MP3", speakingRate: 1.0 },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Google TTS ${res.status}`);
  const j = (await res.json()) as { audioContent?: string };
  if (!j.audioContent) throw new Error("Google TTS returned no audio");
  return Buffer.from(j.audioContent, "base64");
}

/** ElevenLabs text-to-speech: the most natural voices. Free-plan audio requires attribution (prototyping only). */
async function elevenLabsTts(text: string): Promise<Buffer> {
  const e = env();
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(e.ELEVENLABS_VOICE_ID)}?output_format=mp3_44100_64`, {
    method: "POST",
    headers: { "xi-api-key": e.ELEVENLABS_API_KEY!, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text: speakable(text), model_id: e.ELEVENLABS_MODEL, voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** MP3 bytes from the configured cloud voice. Throws TtsUnavailableError so the client falls back to the browser voice. */
export async function synthesize(text: string): Promise<Buffer> {
  const provider = ttsConfigured();
  if (!provider) throw new TtsUnavailableError();
  const clipped = text.slice(0, TTS_MAX_CHARS);
  return provider === "elevenlabs" ? elevenLabsTts(clipped) : googleTts(clipped);
}
