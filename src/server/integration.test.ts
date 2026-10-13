/**
 * End-to-end tests against a real Postgres (set INTEGRATION=1 and DATABASE_URL). Only the LLM-backed agents are
 * mocked; safety rules, lookup, estimation, validated tools, summaries and exports all run for real.
 *   INTEGRATION=1 DATABASE_URL=postgresql://… npx vitest run src/server/integration.test.ts
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  classification: { intents: [{ intent: "chitchat", confidence: 0.9, text: "" }] } as unknown,
  extraction: {} as unknown,
  classifyCalls: 0,
  coachText: "Got it.",
}));

vi.mock("@/server/ai/agents", () => ({
  classifyIntent: vi.fn(async () => {
    mocks.classifyCalls++;
    return mocks.classification;
  }),
  extractEntities: vi.fn(async () => ({ dateOffsetDays: 0, periodOffset: 0, ...(mocks.extraction as object) })),
  guessNutrition: vi.fn(async () => null),
  coachMessages: vi.fn(() => []),
  streamText: async function* () {
    for (const w of mocks.coachText.split(" ")) yield w + " ";
  },
}));

const run = process.env.INTEGRATION ? describe : describe.skip;

run("pipeline + tools against Postgres", () => {
  // Imported lazily so the module graph only loads (and connects) when the suite actually runs.
  let db: typeof import("@/lib/db").db;
  let runTurn: typeof import("./ai/pipeline").runTurn;
  let callTool: typeof import("./tools").callTool;
  let loadUserContext: typeof import("./context").loadUserContext;
  let getDaySummary: typeof import("./summary").getDaySummary;
  let userId: string;
  let otherId: string;

  beforeAll(async () => {
    ({ db } = await import("@/lib/db"));
    ({ runTurn } = await import("./ai/pipeline"));
    ({ callTool } = await import("./tools"));
    ({ loadUserContext } = await import("./context"));
    ({ getDaySummary } = await import("./summary"));
    const stamp = Date.now();
    const u = await db.user.create({ data: { email: `t1-${stamp}@example.com`, passwordHash: "x", profile: { create: { sex: "MALE", birthYear: 1990, heightCm: 178, startWeightKg: 86, onboarded: true } } } });
    const o = await db.user.create({ data: { email: `t2-${stamp}@example.com`, passwordHash: "x", profile: { create: {} } } });
    userId = u.id;
    otherId = o.id;
    await db.goal.create({ data: { userId, calorieTarget: 2200, proteinTargetG: 170, effectiveFrom: "2026-01-01" } });
  });

  afterAll(async () => {
    await db.user.deleteMany({ where: { id: { in: [userId, otherId] } } });
    await db.$disconnect();
  });

  beforeEach(async () => {
    mocks.classifyCalls = 0;
    mocks.coachText = "Got it.";
    await db.aiConversation.deleteMany({ where: { userId } });
  });

  const turn = async (text: string, source: "TEXT" | "VOICE" = "TEXT") => {
    const events: { type: string; [k: string]: unknown }[] = [];
    for await (const ev of runTurn(userId, { text, source })) events.push(ev as never);
    return events;
  };
  const types = (e: { type: string }[]) => e.map((x) => x.type);

  it("handles several intents in one sentence and logs each through validated tools", async () => {
    mocks.classification = {
      intents: [
        { intent: "log_weight", confidence: 0.95, text: "I weighed 84.5" },
        { intent: "log_meal", confidence: 0.95, text: "five egg whites for breakfast" },
        { intent: "goal_update", confidence: 0.9, text: "under 2000 calories" },
      ],
    };
    mocks.extraction = {
      weight: { value: 84.5, unit: "kg" },
      mealType: "BREAKFAST",
      foods: [{ name: "egg white", quantity: 5, unit: "piece", meal: "BREAKFAST" }],
      goal: { calorieTarget: 2000 },
    };
    const ev = await turn("I weighed 84.5 this morning, had five egg whites for breakfast, and I want to stay under 2000 calories", "VOICE");

    expect(types(ev)).toContain("cards");
    expect(types(ev)).toContain("token");
    expect(ev[ev.length - 1].type).toBe("done");

    const ctx = await loadUserContext(userId);
    const s = await getDaySummary(ctx, ctx.today);
    expect(s.weight?.kg).toBe(84.5);
    expect(s.totals.calories).toBeGreaterThan(75);
    expect(s.totals.calories).toBeLessThan(100);
    expect(s.totals.protein).toBeGreaterThan(15);
    expect(ctx.goal?.calorieTarget).toBe(2000);
    expect(s.remaining!.calories).toBeGreaterThan(1850);

    const cards = (ev.find((e) => e.type === "cards") as unknown as { cards: { kind: string; lines: { label: string }[] }[] }).cards;
    const food = cards.find((c) => c.kind === "food")!;
    expect(food.lines.map((l) => l.label)).toContain("ESTIMATE");
    const day = ev.find((e) => e.type === "day") as { summary: { calories: number } } | undefined;
    expect(day?.summary.calories).toBeGreaterThan(75);
  });

  it("asks bone-in or boneless once, logs the answer, and remembers it", async () => {
    await db.foodEntry.deleteMany({ where: { userId } });
    await db.aiMemory.deleteMany({ where: { userId } });
    mocks.classification = { intents: [{ intent: "log_meal", confidence: 0.95, text: "400g chicken" }] };
    mocks.extraction = { foods: [{ name: "chicken", quantity: 400, unit: "g" }], mealType: "LUNCH" };

    const ask = await turn("I had 400g chicken for lunch");
    const clarify = ask.find((e) => e.type === "clarify") as { question: string } | undefined;
    expect(clarify?.question).toMatch(/bone-in or boneless/i);
    expect(await db.foodEntry.count({ where: { userId } })).toBe(0); // nothing guessed

    const calls = mocks.classifyCalls;
    const answer = await turn("bone-in");
    expect(mocks.classifyCalls).toBe(calls); // the answer is resolved from pending state, no new classification
    const entry = await db.foodEntry.findFirst({ where: { userId } });
    expect(entry?.calories).toBeGreaterThan(450);
    expect(entry?.calories).toBeLessThan(800);
    expect(entry?.confidence).toBe("MEDIUM");
    expect((entry?.assumptions as string[]).join(" ")).toMatch(/Bone-in/);
    expect(types(answer)).toContain("done");

    const mem = await db.aiMemory.findFirst({ where: { userId, key: "chicken_cut" } });
    expect(mem?.value).toBe("bone-in");
    expect(mem?.source).toBe("INFERRED");

    // Next time the preference is used: no question.
    mocks.extraction = { foods: [{ name: "chicken", quantity: 300, unit: "g" }], mealType: "DINNER" };
    const again = await turn("had 300g chicken for dinner");
    expect(again.some((e) => e.type === "clarify")).toBe(false);
    expect(await db.foodEntry.count({ where: { userId } })).toBe(2);
  });

  it("'I measured it' upgrades the last entry without a model call, but 'I weighed 84.5' is a normal weigh-in", async () => {
    await db.foodEntry.deleteMany({ where: { userId } });
    mocks.classification = { intents: [{ intent: "log_meal", confidence: 0.95, text: "" }] };
    mocks.extraction = { foods: [{ name: "biryani", quantity: 1, unit: "plate", restaurant: true }], mealType: "DINNER" };
    await turn("I had a plate of biryani for dinner");
    const logged = await db.foodEntry.findFirst({ where: { userId } });
    expect(logged?.confidence).toBe("LOW");

    const calls = mocks.classifyCalls;
    await turn("I measured it");
    expect(mocks.classifyCalls).toBe(calls);
    const upgraded = await db.foodEntry.findFirst({ where: { userId } });
    expect(upgraded?.confidence).toBe("HIGH");
    expect(upgraded!.estimateMax - upgraded!.estimateMin).toBeLessThan(upgraded!.calories * 0.25);

    await turn("log it on the higher side");
    const higher = await db.foodEntry.findFirst({ where: { userId } });
    expect(higher!.calories).toBeGreaterThan(upgraded!.calories);

    // Same opening words, different meaning: must go through the normal pipeline.
    mocks.classification = { intents: [{ intent: "log_weight", confidence: 0.95, text: "" }] };
    mocks.extraction = { weight: { value: 83.9, unit: "kg" } };
    await turn("I weighed 83.9 this morning");
    expect(mocks.classifyCalls).toBe(calls + 1);
    expect((await db.weightEntry.findFirst({ where: { userId }, orderBy: { updatedAt: "desc" } }))?.weightKg).toBe(83.9);
  });

  it("RED triggers never log and never call a model", async () => {
    const before = await db.foodEntry.count({ where: { userId } });
    mocks.classification = { intents: [{ intent: "log_meal", confidence: 0.99, text: "" }] };
    mocks.extraction = { foods: [{ name: "rice", quantity: 100, unit: "g" }] };
    const calls = mocks.classifyCalls;
    const ev = await turn("I fainted at the gym and had some rice");
    expect(ev.find((e) => e.type === "safety")).toMatchObject({ level: "RED" });
    expect(mocks.classifyCalls).toBe(calls);
    expect(await db.foodEntry.count({ where: { userId } })).toBe(before);
    const last = ev[ev.length - 1] as unknown as { text: string };
    expect(last.text).toMatch(/medical professional/);
  });

  it("YELLOW responses lead the coaching reply but still allow logging", async () => {
    mocks.classification = { intents: [{ intent: "general_fitness_question", confidence: 0.9, text: "" }] };
    mocks.extraction = {};
    const ev = await turn("my knee hurts when I squat, any tips?");
    expect(ev.find((e) => e.type === "safety")).toMatchObject({ level: "YELLOW" });
    const tokens = ev.filter((e) => e.type === "token").map((e) => e.text).join("");
    expect(tokens).toMatch(/physiotherapist or doctor/);
  });

  it("low-confidence intent asks a clarifying question instead of guessing", async () => {
    mocks.classification = { intents: [{ intent: "log_meal", confidence: 0.4, text: "" }], clarifyingQuestion: "Did you want to log that or ask about it?" };
    const ev = await turn("rice");
    expect(ev.find((e) => e.type === "clarify")).toMatchObject({ question: "Did you want to log that or ask about it?" });
    expect(ev.some((e) => e.type === "cards")).toBe(false);
  });

  it("enforces the calorie floor on goal updates", async () => {
    const ctx = await loadUserContext(userId);
    const res = (await callTool(userId, "update_goal", { calorieTarget: 900 }, ctx)) as { goal: { calorieTarget: number }; warnings: string[] };
    expect(res.goal.calorieTarget).toBe(1500); // male floor
    expect(res.warnings[0]).toMatch(/medical supervision/);
    await callTool(userId, "update_goal", { calorieTarget: 2000 }, await loadUserContext(userId));
  });

  it("validates tool arguments and scopes every write to the signed-in user", async () => {
    await expect(callTool(userId, "log_weight", { date: "2026-03-30", weightKg: 5 })).rejects.toThrow(/Invalid arguments/);
    await expect(callTool(userId, "log_food", { date: "not-a-date", meal: "LUNCH", entries: [] })).rejects.toThrow(/Invalid arguments/);

    const w = (await callTool(otherId, "log_weight", { date: "2026-03-30", weightKg: 70 })) as { id: string };
    const res = (await callTool(userId, "delete_entry", { kind: "weight", id: w.id })) as { deleted: number };
    expect(res.deleted).toBe(0);
    expect(await db.weightEntry.count({ where: { id: w.id } })).toBe(1);
  });

  it("logs workout sets, detects a personal record, and builds today's workout with a prescription", async () => {
    const ctx = await loadUserContext(userId);
    await callTool(userId, "create_workout_plan", { goal: "MUSCLE_GAIN", experience: "INTERMEDIATE", daysPerWeek: 4, sessionMinutes: 60, equipment: "FULL_GYM" }, ctx);
    const { getTodaysWorkout } = await import("./workouts");
    const wk = await getTodaysWorkout(await loadUserContext(userId));
    expect(wk?.day.name).toBe("Upper Body 1");
    expect(wk!.exercises.length).toBeGreaterThanOrEqual(5);

    const first = wk!.exercises[0];
    // Seed an earlier session so the new set can beat it.
    const old = await db.workoutSession.create({ data: { userId, date: "2026-01-05", status: "COMPLETED" } });
    await db.workoutSet.create({ data: { userId, sessionId: old.id, date: "2026-01-05", exerciseName: first.name, setNumber: 1, reps: 8, weightKg: 50, volume: 400 } });

    const r = (await callTool(userId, "log_workout_set", { date: ctx.today, exerciseName: first.name, reps: 8, weightKg: 60, rpe: 8 })) as { isPr: boolean; setNumber: number; sessionId: string };
    expect(r.isPr).toBe(true);
    expect(r.setNumber).toBe(1);
    const r2 = (await callTool(userId, "log_workout_set", { date: ctx.today, exerciseName: first.name, reps: 8, weightKg: 60, sessionId: r.sessionId })) as { setNumber: number };
    expect(r2.setNumber).toBe(2);
    expect(await db.progressRecord.count({ where: { userId, kind: "PR" } })).toBeGreaterThanOrEqual(1);

    const tomorrow = await getTodaysWorkout(await loadUserContext(userId));
    const brief = tomorrow!.exercises.find((e) => e.name === first.name)!;
    expect(brief.previous?.sets[0].weightKg).toBe(50);
    expect(brief.prescription.weightKg).toBe(50);
  });

  it("exports nutrition as CSV, XLSX and PDF", async () => {
    const { buildTable, toCsv, toXlsx, toPdf } = await import("./exporter");
    const t = await buildTable(userId, "nutrition");
    expect(t.rows.length).toBeGreaterThan(0);
    const csv = toCsv(t);
    expect(csv.split("\r\n")[0]).toContain("Calories (est.)");
    expect((await toXlsx(t)).length).toBeGreaterThan(1000);
    const pdf = await toPdf(t);
    expect(Buffer.from(pdf.slice(0, 4)).toString()).toBe("%PDF");
  });

  it("veg/fruit counters go up and down but never below zero", async () => {
    const date = "2026-03-01";
    const up = (await callTool(userId, "log_produce", { date, vegServings: 2, fruitServings: 1 })) as { vegServings: number; fruitServings: number };
    expect(up).toMatchObject({ vegServings: 2, fruitServings: 1 });
    const down = (await callTool(userId, "log_produce", { date, vegServings: -1 })) as { vegServings: number };
    expect(down.vegServings).toBe(1);
    const floor = (await callTool(userId, "log_produce", { date, vegServings: -5, fruitServings: -5 })) as { vegServings: number; fruitServings: number };
    expect(floor).toMatchObject({ vegServings: 0, fruitServings: 0 });
  });

  it("day summaries include micronutrient totals and references", async () => {
    const ctx = await loadUserContext(userId);
    await callTool(userId, "log_food", {
      date: "2026-03-02", meal: "LUNCH", source: "MANUAL",
      entries: [{ food: "curd", quantity: 200, unit: "g", calories: 122, protein: 7, carbs: 9.4, fat: 6.6, sodium: 92, micros: { calcium: 242, vitB12: 0.74 }, confidence: "HIGH", estimateMin: 110, estimateMax: 134 }],
    }, ctx);
    const s = await getDaySummary(ctx, "2026-03-02");
    expect(s.micros.calcium).toBe(242);
    expect(s.micros.sodium).toBe(92);
    expect(s.microRefs.find((r) => r.key === "sodium")?.kind).toBe("limit");
  });

  it("Google sign-in cannot be hijacked by a pre-registered, unverified password account", async () => {
    const { linkGoogleAccount } = await import("./googleLink");
    const email = `victim-${Date.now()}@example.com`;
    // Attacker registers the victim's email with their own password (never verified) and holds a pending token.
    const attacker = await db.user.create({ data: { email, passwordHash: "attacker-chosen-hash", emailVerified: null, profile: { create: {} } } });
    await db.verificationToken.create({ data: { identifier: email, token: `tok-${Date.now()}`, expiresAt: new Date(Date.now() + 3600_000) } });

    // The real owner later signs in with Google.
    const id = await linkGoogleAccount({ email: email.toUpperCase(), name: "Victim" }, { type: "oauth", provider: "google", providerAccountId: `g-${Date.now()}` });
    expect(id).toBe(attacker.id);
    const after = await db.user.findUnique({ where: { id }, include: { accounts: true } });
    expect(after?.emailVerified).not.toBeNull();
    expect(after?.passwordHash).toBeNull(); // the attacker's password no longer works
    expect(after?.accounts).toHaveLength(1);
    expect(await db.verificationToken.count({ where: { identifier: email } })).toBe(0);

    // Signing in again is idempotent (no duplicate account link).
    await linkGoogleAccount({ email, name: "Victim" }, { type: "oauth", provider: "google", providerAccountId: after!.accounts[0].providerAccountId });
    expect(await db.account.count({ where: { userId: id } })).toBe(1);
    await db.user.delete({ where: { id } });
  });

  it("a verified password account keeps its password when the same person adds Google", async () => {
    const { linkGoogleAccount } = await import("./googleLink");
    const email = `owner-${Date.now()}@example.com`;
    const u = await db.user.create({ data: { email, passwordHash: "real-hash", emailVerified: new Date(), profile: { create: {} } } });
    await linkGoogleAccount({ email }, { type: "oauth", provider: "google", providerAccountId: `g2-${Date.now()}` });
    expect((await db.user.findUnique({ where: { id: u.id } }))?.passwordHash).toBe("real-hash");
    await db.user.delete({ where: { id: u.id } });
  });

  it("progress photos are stored per user, listed without bytes, and cascade on user delete", async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const mine = await db.progressPhoto.create({ data: { userId, date: "2026-03-03", pose: "FRONT", mime: "image/png", bytes: png, size: png.length } });
    await db.progressPhoto.create({ data: { userId: otherId, date: "2026-03-03", pose: "SIDE", mime: "image/png", bytes: png, size: png.length } });
    const list = await db.progressPhoto.findMany({ where: { userId }, select: { id: true, pose: true, size: true } });
    expect(list.map((p) => p.id)).toContain(mine.id);
    expect(list.every((p) => !("bytes" in p))).toBe(true);
    // Another user cannot read or delete it by id.
    expect(await db.progressPhoto.findFirst({ where: { id: mine.id, userId: otherId } })).toBeNull();
    expect((await db.progressPhoto.deleteMany({ where: { id: mine.id, userId: otherId } })).count).toBe(0);
    const temp = await db.user.create({ data: { email: `ph-${Date.now()}@example.com`, passwordHash: "x" } });
    await db.progressPhoto.create({ data: { userId: temp.id, date: "2026-03-03", mime: "image/png", bytes: png, size: png.length } });
    await db.user.delete({ where: { id: temp.id } });
    expect(await db.progressPhoto.count({ where: { userId: temp.id } })).toBe(0);
  });

  it("deleting the user cascades to all owned rows", async () => {
    const temp = await db.user.create({ data: { email: `tmp-${Date.now()}@example.com`, passwordHash: "x" } });
    await callTool(temp.id, "log_weight", { date: "2026-03-30", weightKg: 80 });
    await callTool(temp.id, "remember_preference", { category: "PREFERENCE", key: "likes_rice", value: "likes rice" });
    await db.user.delete({ where: { id: temp.id } });
    expect(await db.weightEntry.count({ where: { userId: temp.id } })).toBe(0);
    expect(await db.aiMemory.count({ where: { userId: temp.id } })).toBe(0);
  });
});
