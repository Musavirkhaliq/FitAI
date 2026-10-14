import OpenAI from "openai";
import type { ZodType, ZodTypeDef } from "zod";
import { env } from "../env";

/**
 * Provider-agnostic LLM layer. Groq and Gemini both speak the OpenAI protocol, so one SDK serves all:
 * swapping providers means changing LLM_BASE_URL / LLM_API_KEY / LLM_MODEL, not code.
 * On rate limits (429) or 5xx the request is retried once on the configured fallback provider.
 */

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type ModelRole = "chat" | "extract";

export class LlmUnavailableError extends Error {
  constructor(message = "No LLM provider is configured. Set LLM_API_KEY in .env.local.") {
    super(message);
    this.name = "LlmUnavailableError";
  }
}

interface Endpoint {
  client: OpenAI;
  chatModel: string;
  extractModel: string;
  name: string;
}

let endpoints: Endpoint[] | null = null;

function getEndpoints(): Endpoint[] {
  if (endpoints) return endpoints;
  const e = env();
  const list: Endpoint[] = [];
  if (e.LLM_API_KEY) {
    list.push({
      client: new OpenAI({ apiKey: e.LLM_API_KEY, baseURL: e.LLM_BASE_URL, maxRetries: 0, timeout: 30_000 }),
      chatModel: e.LLM_MODEL,
      extractModel: e.LLM_EXTRACT_MODEL,
      name: "primary",
    });
  }
  if (e.LLM_FALLBACK_API_KEY && e.LLM_FALLBACK_BASE_URL) {
    const m = e.LLM_FALLBACK_MODEL || e.LLM_MODEL;
    list.push({
      client: new OpenAI({ apiKey: e.LLM_FALLBACK_API_KEY, baseURL: e.LLM_FALLBACK_BASE_URL, maxRetries: 0, timeout: 30_000 }),
      chatModel: m,
      extractModel: m,
      name: "fallback",
    });
  }
  endpoints = list;
  return list;
}

export const llmConfigured = () => getEndpoints().length > 0;

function retryable(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  return status === 429 || (status != null && status >= 500) || (err as Error)?.name === "APIConnectionError" || (err as Error)?.name === "APIConnectionTimeoutError";
}

async function withFallback<T>(fn: (ep: Endpoint) => Promise<T>): Promise<T> {
  const eps = getEndpoints();
  if (!eps.length) throw new LlmUnavailableError();
  let lastErr: unknown;
  for (const ep of eps) {
    try {
      return await fn(ep);
    } catch (err) {
      lastErr = err;
      if (!retryable(err)) throw err;
    }
  }
  throw lastErr;
}

const modelFor = (ep: Endpoint, role: ModelRole) => (role === "extract" ? ep.extractModel : ep.chatModel);

export async function completeText(messages: ChatMessage[], opts: { role?: ModelRole; temperature?: number; maxTokens?: number } = {}): Promise<string> {
  return withFallback(async (ep) => {
    const res = await ep.client.chat.completions.create({
      model: modelFor(ep, opts.role ?? "chat"),
      messages,
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 700,
    });
    return res.choices[0]?.message?.content?.trim() ?? "";
  });
}

/** Strip code fences / prose around a JSON object or array. */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : text).trim();
  const objStart = body.indexOf("{");
  const objEnd = body.lastIndexOf("}");
  const arrStart = body.indexOf("[");
  const arrEnd = body.lastIndexOf("]");

  if (objStart !== -1 && objEnd > objStart && (arrStart === -1 || objStart < arrStart)) {
    return JSON.parse(body.slice(objStart, objEnd + 1));
  }
  if (arrStart !== -1 && arrEnd > arrStart) {
    return JSON.parse(body.slice(arrStart, arrEnd + 1));
  }
  if (objStart !== -1 && objEnd > objStart) {
    return JSON.parse(body.slice(objStart, objEnd + 1));
  }
  throw new Error("no JSON object in model output");
}

/**
 * Ask for JSON and validate it with Zod. One repair attempt on invalid output. The model never
 * touches the database: its output is only ever data that code validates and then acts on.
 */
export async function completeJson<T>(
  messages: ChatMessage[],
  schema: ZodType<T, ZodTypeDef, unknown>,
  opts: { role?: ModelRole; maxTokens?: number } = {},
): Promise<T> {
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const msgs: ChatMessage[] =
      attempt === 0
        ? messages
        : [...messages, { role: "user", content: `Your previous reply was invalid (${lastError}). Reply again with ONLY a valid JSON object matching the schema.` }];
    const raw = await withFallback(async (ep) => {
      const tokens = Math.max(opts.maxTokens ?? 1200, 1500);
      try {
        const res = await ep.client.chat.completions.create({
          model: modelFor(ep, opts.role ?? "extract"),
          messages: msgs,
          temperature: 0,
          max_tokens: tokens,
          response_format: { type: "json_object" },
        });
        const choice = res.choices[0]?.message;
        return choice?.content || (choice as { reasoning?: string })?.reasoning || "";
      } catch (err: unknown) {
        // Groq sometimes returns 400 json_validate_failed / failed_generation when strict schema mode is forced
        const code = (err as { code?: string; error?: { code?: string } })?.code || (err as { error?: { code?: string } })?.error?.code;
        if (code === "json_validate_failed" || (err as Error)?.message?.includes("Failed to generate JSON") || (err as Error)?.message?.includes("Failed to validate JSON")) {
          console.warn("[llm] response_format json_object failed, retrying without json_object constraint:", (err as Error).message);
          const fallbackRes = await ep.client.chat.completions.create({
            model: modelFor(ep, opts.role ?? "extract"),
            messages: msgs,
            temperature: 0,
            max_tokens: tokens,
          });
          const choice = fallbackRes.choices[0]?.message;
          return choice?.content || (choice as { reasoning?: string })?.reasoning || "";
        }
        throw err;
      }
    });
    try {
      const parsed = schema.safeParse(extractJson(raw));
      if (parsed.success) return parsed.data;
      lastError = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    } catch (e) {
      lastError = (e as Error).message;
    }
  }
  throw new Error(`LLM returned invalid JSON twice: ${lastError}`);
}

/** Stream text tokens. Falls back to the next endpoint only if the stream fails before the first token. */
export async function* streamText(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number; signal?: AbortSignal } = {},
): AsyncGenerator<string> {
  const eps = getEndpoints();
  if (!eps.length) throw new LlmUnavailableError();
  let lastErr: unknown;
  for (const ep of eps) {
    let started = false;
    try {
      const stream = await ep.client.chat.completions.create(
        { model: ep.chatModel, messages, temperature: opts.temperature ?? 0.5, max_tokens: opts.maxTokens ?? 600, stream: true },
        { signal: opts.signal },
      );
      for await (const chunk of stream) {
        const t = chunk.choices[0]?.delta?.content;
        if (t) {
          started = true;
          yield t;
        }
      }
      return;
    } catch (err) {
      lastErr = err;
      if (started || !retryable(err)) throw err;
    }
  }
  throw lastErr;
}
