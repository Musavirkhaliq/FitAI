import { env } from "../env";

export class TtsUnavailableError extends Error {
  constructor() {
    super("Cloud TTS isn't configured; the browser voice will be used.");
    this.name = "TtsUnavailableError";
  }
}

/** Hard cap per request: Neural2 free tier is 1M chars/month, so never send long text. */
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

/** Google Cloud Text-to-Speech over REST. Returns MP3 bytes. */
export async function synthesize(text: string): Promise<Buffer> {
  const e = env();
  if (e.TTS_PROVIDER !== "google" || !e.GOOGLE_TTS_API_KEY) throw new TtsUnavailableError();
  const clipped = text.slice(0, TTS_MAX_CHARS);
  const voice = e.GOOGLE_TTS_VOICE;
  const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${encodeURIComponent(e.GOOGLE_TTS_API_KEY)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { ssml: toSsml(clipped) },
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
