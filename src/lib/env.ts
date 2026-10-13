import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().optional(),
  LLM_BASE_URL: z.string().url().default("https://api.groq.com/openai/v1"),
  LLM_API_KEY: z.string().optional(),
  /** Conversation / coaching model. */
  LLM_MODEL: z.string().default("llama-3.3-70b-versatile"),
  /** Small, fast model for intent classification and JSON extraction (the "analysis" model). */
  LLM_EXTRACT_MODEL: z.string().default("llama-3.1-8b-instant"),
  LLM_FALLBACK_BASE_URL: z.string().url().optional().or(z.literal("")),
  LLM_FALLBACK_API_KEY: z.string().optional(),
  LLM_FALLBACK_MODEL: z.string().optional(),

  STT_PROVIDER: z.enum(["groq", "deepgram"]).default("groq"),
  STT_BASE_URL: z.string().url().default("https://api.groq.com/openai/v1"),
  STT_API_KEY: z.string().optional(),
  STT_MODEL: z.string().default("whisper-large-v3-turbo"),
  DEEPGRAM_API_KEY: z.string().optional(),

  TTS_PROVIDER: z.enum(["google", "browser"]).default("google"),
  GOOGLE_TTS_API_KEY: z.string().optional(),
  GOOGLE_TTS_VOICE: z.string().default("en-US-Neural2-F"),

  USDA_API_KEY: z.string().default("DEMO_KEY"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

/** Parsed lazily so `next build` doesn't need secrets. Server-only: never import from client code. */
export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error("Invalid environment: " + parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    }
    cached = parsed.data;
  }
  return cached;
}

/** The STT key falls back to the LLM key because Groq uses one key for both. */
export const sttKey = () => env().STT_API_KEY || env().LLM_API_KEY;
