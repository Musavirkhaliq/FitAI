# FitTrack AI

A voice-first AI fitness coach. Talk (or type) naturally — "I weighed 84.5, had five egg whites for breakfast, and I want to stay under 2,000 calories" — and the app logs each piece, estimates with **honest uncertainty**, and coaches adaptively.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind · Recharts · Zod · Prisma + PostgreSQL · Auth.js v5 · Groq (LLM + Whisper STT) · Google Cloud TTS · USDA FoodData Central / Open Food Facts.

## Quick start

```bash
npm install
cp .env.example .env.local          # then fill in the keys below
npm run db:local                    # (own terminal) no Postgres? this starts one on localhost:5433, see below
npm run db:push                     # create tables (reads .env.local)
npm run db:seed                     # optional: seed the shared food catalog
npm run dev                         # http://localhost:3000
```

**Local database (no install, no Docker):** `npm run db:local` runs an embedded Postgres on port 5433 with data in `./.local-db`. Use `DATABASE_URL=DIRECT_URL="postgresql://fit:fit@localhost:5433/fittrack"`. Handy on networks that block outbound database ports.

Create an account at `/register`; a short conversational onboarding builds your starting plan.

### Free-tier setup ($0/month for development)

| Need | Provider | Where to get a key | Env vars |
|---|---|---|---|
| Postgres | Supabase or Neon (free) | project → connection string | `DATABASE_URL`, `DIRECT_URL` |
| Auth secret | — | `npx auth secret` | `AUTH_SECRET` |
| LLM | **Groq** (primary) | console.groq.com → API keys | `LLM_API_KEY` (+ base URL/model default) |
| LLM fallback | Google Gemini (optional) | aistudio.google.com | `LLM_FALLBACK_*` |
| Speech-to-text | **Groq Whisper** (same key) | — | `STT_API_KEY` optional, falls back to `LLM_API_KEY` |
| STT fallback | Deepgram (optional) | console.deepgram.com | `DEEPGRAM_API_KEY` |
| Text-to-speech | Google Cloud TTS | enable *Text-to-Speech API*, create an API key | `GOOGLE_TTS_API_KEY` |
| Foods | USDA FoodData Central | fdc.nal.usda.gov/api-key-signup | `USDA_API_KEY` (`DEMO_KEY` works for light use) |

Everything degrades gracefully: with no TTS key the browser's Web Speech voice is used; with no USDA/OFF access the built-in catalog of ~80 everyday foods (incl. Indian staples) answers; with no LLM key you can still log manually on the Nutrition, Weight and Workout pages.

**Free-tier warnings** (also in the build brief): Groq limits are per organisation; Gemini's daily cap drops to 50/day until you spend $10, so keep Groq primary; Deepgram/AssemblyAI credits are one-time; Google Cloud TTS needs billing enabled — **set a budget alert before testing in a loop**; some free tiers may train on your data (check terms before sending health data); limits change often — re-check the provider pages.

Swap providers by config only: Groq and Gemini are both OpenAI-compatible, so change `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`. `LLM_EXTRACT_MODEL` is the small fast model used for intent classification and JSON extraction ("analysis" model); `LLM_MODEL` is the conversational coach.

## How a message flows

```
text/voice ─► safety (deterministic) ─► intent classification (confidence ≥ 0.7 or ask) ─► entity extraction
           ─► food lookup (history → catalog → USDA → Open Food Facts; Levenshtein fuzzy) ─► estimation (kcal range + confidence)
           ─► validated tool calls (the ONLY writes) ─► coach reply (streamed, FACT / ESTIMATE / ASSUMPTION / RECOMMENDATION)
```

- **The LLM never writes to the database.** It only produces JSON that Zod validates; code then calls typed tools (`src/server/tools.ts`: `log_food`, `log_weight`, `log_activity`, `log_sleep`, `log_workout_set`, `create_workout_plan`, `update_goal`, `remember_preference`, …). No raw SQL anywhere; every query is scoped to the signed-in user.
- **Honest uncertainty** (`src/lib/engines/estimation.ts`): HIGH ±10 %, MEDIUM ±15–25 %, LOW ±25–40 %, widened per uncertainty source (bone-in yield, oil, restaurant, mixed dish, raw/cooked, guessed portion). A 14-day calibration loop nudges a bias factor if logged intake disagrees with the weight trend. "I measured it" upgrades to HIGH; "log on the higher side" uses the range maximum.
- **Ambiguity:** "400 g chicken" triggers *bone-in or boneless?* once; the answer is stored as an inferred memory (editable on **Settings → Memory**) and never asked again.
- **Safety** (`src/lib/engines/safety.ts`): GREEN/YELLOW/RED. RED (chest pain, fainting, breathlessness, eating-disorder behaviour, very rapid loss) returns a fixed referral response and logs nothing. Calorie floors (1200 F / 1500 M) are enforced in the goal tool and onboarding; sustained loss > 1 % body weight/week for 2+ weeks escalates.
- **Weight trend & calories** (`weightTrend.ts`, `calories.ts`): 7/14/30-day averages, regression slope, FAST_LOSS / TARGET_LOSS / SLOW_LOSS / PLATEAU / GAINING; calorie changes are *suggestions* and only after ~14 days of data with decent logging.
- **Progressive overload** (`overload.ts`): double progression, RPE/RIR, robust 1RM (Epley/Brzycki median), ≤ +10 % jumps, −10 % after two missed sessions, deload on 3 hard weeks or RPE ≥ 9 twice, MEV/MRV tracking.

## Voice

Mic → voice-activity detection with live waveform → auto-stop after ~1.5 s silence → Groq Whisper → **editable transcript preview** (retry keeps context; low STT confidence offers "Did you mean…?") → streamed reply spoken sentence-by-sentence via Google TTS (browser fallback). Talking over the reply interrupts it. 10 s of silence asks "Are you still there?". A text box is always below the mic. Offline entries queue in IndexedDB and sync on reconnect.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` | `tsc --noEmit` |
| `npm test` | unit tests (engines, food/estimation, planners) — no DB or keys needed |
| `INTEGRATION=1 DATABASE_URL=… npx vitest run src/server/integration.test.ts` | end-to-end against a real Postgres (LLM mocked) |
| `npm run db:push` / `db:migrate` / `db:seed` | Prisma |

## Project map

```
prisma/schema.prisma        19 tables (the 18 in the brief + daily_logs for water/produce), user_id + created_at/updated_at, ON DELETE CASCADE, indexes
src/lib/engines/            pure, tested logic: weightTrend, calories, estimation, safety, overload, workoutPlan, mealPlan, bodycomp, habits
src/lib/food/               catalog, fuzzy match, USDA, Open Food Facts, lookup, portion/estimate calculator
src/lib/providers/          llm / stt / tts abstraction (swap by config)
src/server/                 tools (validated writes), summary, insight, calibration, memory, exporter, ai/{agents,pipeline,schemas}
src/app/api/                chat (SSE), stt, tts, today, day, log, foods, weight, workouts, analytics, memory, profile, onboarding, export, search, notifications
src/components/coach/       CoachProvider (chat + voice state machine), VoicePanel, Messages, speech, voiceEngine
src/app/(app)/              Today, Dashboard, Nutrition, Weight, Workouts (+session), Progress, Analytics, AI Coach, History, Settings (+Memory)
```

## Notes & known limits

- Calories, TDEE, deficit, fat lost and body-fat figures are **estimates** and are labelled as such everywhere. This is a coaching tool, not a medical device; it never diagnoses.
- Rate limiting is in-process (fine for one instance). Use a shared store (Redis/Upstash) if you scale out.
- Day strings (`YYYY-MM-DD`) are in each user's own timezone; set it in Settings.
- Progress-photo upload is not built (the schema has a `photo_url` column ready).
