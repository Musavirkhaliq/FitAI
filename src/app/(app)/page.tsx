"use client";
import { ArrowDownRight, ArrowRight, ArrowUpRight, ChevronRight, Dumbbell, Lightbulb, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { MessageList, SafetyFooter } from "@/components/coach/Messages";
import { useCoach } from "@/components/coach/CoachProvider";
import { VoicePanel } from "@/components/coach/VoicePanel";
import { MealList } from "@/components/today/MealList";
import { QuickFoods } from "@/components/today/QuickFoods";
import { QuickLog } from "@/components/today/QuickLog";
import { TodayHero } from "@/components/today/TodayHero";
import { AnimatedNumber, Badge, ErrorState, MetricCard, Notice, Skeleton, Sparkline, Tile, haptic } from "@/components/ui";
import { logTool, useApi } from "@/lib/client/api";
import { fmtDay, fmtDelta, fmtNum, fmtWeight, greeting, kgToLb, STATUS_LABEL } from "@/lib/client/format";
import type { TodayDto } from "@/lib/client/types";

const STATUS_TONE = { FAST_LOSS: "warn", TARGET_LOSS: "good", SLOW_LOSS: "neutral", PLATEAU: "neutral", GAINING: "warn", INSUFFICIENT_DATA: "neutral" } as const;

/** Skeleton shaped like the final layout, so nothing jumps when data arrives. */
function TodaySkeleton() {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">Loading today…</span>
      <div className="space-y-2"><Skeleton className="h-9 w-3/4 !rounded-xl" /><Skeleton className="h-4 w-1/3 !rounded-lg" /></div>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="col-span-2 h-60" />
        <Skeleton className="h-44" /><Skeleton className="h-44" />
        <Skeleton className="h-28" /><Skeleton className="h-28" />
      </div>
    </div>
  );
}

export default function TodayPage() {
  const { data, error, loading, refresh, setData } = useApi<TodayDto>("/api/today");
  const coach = useCoach();

  // Live numbers from the last chat turn make the cards update instantly, before the quiet background refetch lands.
  const live = coach.liveDay && data && coach.liveDay.date === data.date ? coach.liveDay : null;

  const removeFood = (id: string) =>
    setData((prev) => {
      if (!prev) return prev;
      const meals = prev.summary.meals.map((m) => ({ ...m, entries: m.entries.filter((e) => e.id !== id) }));
      const gone = prev.summary.meals.flatMap((m) => m.entries).find((e) => e.id === id);
      if (!gone) return prev;
      const t = { ...prev.summary.totals, calories: prev.summary.totals.calories - gone.calories, protein: prev.summary.totals.protein - gone.protein, fiber: prev.summary.totals.fiber - gone.fiber };
      return { ...prev, summary: { ...prev.summary, meals, totals: t } };
    });

  const recent = useMemo(() => coach.messages.slice(-2), [coach.messages]);

  if (loading && !data) return <TodaySkeleton />;
  if (!data) return <ErrorState message={error ?? "I couldn't load today. Check your connection."} onRetry={() => void refresh()} />;

  const { summary: s, trend, goal, profile } = data;
  const units = profile.unitSystem;
  const t = s.targets;
  const isToday = data.date === data.today;
  const calories = live ? live.calories : Math.round(s.totals.calories);
  const range: [number, number] = live ? live.caloriesRange : [Math.round(s.totals.minKcal), Math.round(s.totals.maxKcal)];
  const protein = live ? live.protein : Math.round(s.totals.protein);
  const fiber = live ? live.fiber : Math.round(s.totals.fiber);
  const steps = live ? live.steps : s.activity.steps;
  const sleepH = live ? live.sleepH : s.sleep?.hours ?? null;
  const weightKg = live?.weightKg ?? s.weight?.kg ?? null;
  const delta = weightKg != null && data.yesterdayWeightKg != null ? weightKg - data.yesterdayWeightKg : trend.changeFromYesterdayKg;
  const DeltaIcon = delta == null ? ArrowRight : delta < -0.05 ? ArrowDownRight : delta > 0.05 ? ArrowUpRight : ArrowRight;
  const adv = data.calorieAdvice;
  const sparkVals = data.weeklyDays.map((d) => (d.weightKg == null ? null : units === "IMPERIAL" ? kgToLb(d.weightKg) : d.weightKg));
  const hasAnything = calories > 0 || weightKg != null || steps > 0;
  const weightText = weightKg != null ? fmtWeight(weightKg, units, 1).split(" ") : null;

  return (
    <div className="space-y-4">
      {error && <Notice tone="warn">{error}</Notice>}

      <header className="rise flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <h1 className="display text-[1.65rem] font-extrabold leading-[1.15] tracking-tight sm:text-3xl">{greeting(data.user?.name)}</h1>
          <p className="mt-1 text-sm text-muted">{fmtDay(data.date, { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
        {data.consistency && (
          <Badge tone="brand" className="shrink-0 !px-3 !py-1.5">
            <Sparkles className="mr-1 h-3.5 w-3.5" aria-hidden /> {data.consistency.label}
          </Badge>
        )}
      </header>

      {/* Bento: the hero first, then glanceable tiles of different sizes */}
      <section aria-label="Today at a glance" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="col-span-2 md:col-span-2 md:row-span-2 [&>*]:h-full">
          <TodayHero
            calories={calories} caloriesTarget={t?.calories ?? null} caloriesRange={calories ? range : null}
            protein={protein} proteinTarget={t?.proteinG ?? null} steps={steps} stepsTarget={t?.steps ?? null} isToday={isToday}
          />
        </div>

        <Tile index={1} className="flex flex-col justify-between">
          <div>
            <p className="eyebrow">Weight</p>
            <p className="num mt-1.5 text-[2rem]">
              {weightText ? <>{weightText[0]}<span className="ml-1 text-sm font-medium text-muted">{weightText[1]}</span></> : "—"}
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted">
              <DeltaIcon className="h-3.5 w-3.5" aria-hidden />
              {weightKg == null ? "Not weighed in yet" : delta == null ? "First weigh-in" : `${fmtDelta(delta, units)} vs yesterday`}
            </p>
          </div>
          <div className="mt-2">
            <Sparkline values={sparkVals} color="brand" />
            <Badge tone={STATUS_TONE[trend.status]} className="mt-1">{STATUS_LABEL[trend.status]}</Badge>
          </div>
        </Tile>

        <Tile
          index={2}
          className="flex flex-col justify-between"
          style={{ background: "linear-gradient(145deg, rgb(var(--brand-a) / 0.16), rgb(var(--brand-b) / 0.07)), rgb(var(--surface))" }}
        >
          <div>
            <p className="eyebrow flex items-center gap-1.5"><Dumbbell className="h-3.5 w-3.5" aria-hidden /> Today&apos;s workout</p>
            {data.workout ? (
              <>
                <p className="display mt-1.5 text-xl font-extrabold leading-tight">{data.workout.day.name}</p>
                <p className="mt-0.5 text-xs text-muted">{data.workout.exerciseCount} exercises{data.workout.deloadSuggested ? " · deload" : ""}</p>
              </>
            ) : (
              <p className="mt-1.5 text-sm text-muted">No plan yet. Say “create me a 4-day gym plan”.</p>
            )}
          </div>
          {data.workout ? (
            data.workout.completedToday ? (
              <Badge tone="good" className="mt-3 w-fit">Done today ✓</Badge>
            ) : (
              <Link href="/workouts" onClick={() => haptic()} className="btn btn-primary mt-3 !min-h-[44px] w-full">{data.workout.inProgress ? "Continue" : "Start"} <ChevronRight className="h-4 w-4" aria-hidden /></Link>
            )
          ) : (
            <button className="btn mt-3 !min-h-[44px] w-full" onClick={() => void coach.send("Create me a workout plan", "TEXT")}>Create a plan</button>
          )}
        </Tile>

        <MetricCard index={3} label="Fiber" value={fiber} target={t?.fiberG ?? null} unit="g" color="fiber" />
        <MetricCard index={4} label="Sleep" value={sleepH} target={t?.sleepH ?? null} unit="h" color="sleep" format={(n) => fmtNum(n, 1)} hint={sleepH == null ? "Not logged" : undefined} />
      </section>

      <Tile index={5} className="!py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-sm">
          <p className="eyebrow">Energy · estimates</p>
          <p>Burn ≈ <span className="num !text-base !font-bold">{s.expenditure ? `${fmtNum(s.expenditure.low)}–${fmtNum(s.expenditure.high)}` : "—"}</span> kcal</p>
          <p>{isToday ? "Deficit so far" : "Deficit"} ≈ <span className="num !text-base !font-bold">{s.deficit ? `${fmtNum(s.deficit.low)} to ${fmtNum(s.deficit.high)}` : "—"}</span> kcal</p>
        </div>
        <p className="mt-1.5 text-xs text-muted">{isToday ? "The day is still in progress, so this shrinks as you eat. " : ""}Estimated, not measured. Water: {fmtNum(live?.water ?? s.water)} ml.</p>
      </Tile>

      <QuickFoods date={data.date} onLogged={() => void refresh()} />

      {!hasAnything && (
        <Tile index={6} className="text-center">
          <p className="display text-lg font-extrabold">Start with one sentence</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">Tap the glowing mic and say something like “I weighed 84.5 and had two eggs for breakfast”. I&apos;ll log it, estimate honestly, and plan the rest of your day.</p>
        </Tile>
      )}

      {/* Meals */}
      <section className="card rise" aria-labelledby="meals-h">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="meals-h" className="display text-lg font-extrabold">Meals</h2>
          <Link href="/nutrition" className="inline-flex min-h-[40px] items-center gap-0.5 text-sm font-semibold text-brand">Open log <ChevronRight className="h-4 w-4" aria-hidden /></Link>
        </div>
        <MealList meals={s.meals} onRemoved={removeFood} />
      </section>

      <QuickLog date={data.date} units={units} onLogged={() => void refresh()} />

      {/* Weekly recap: a variable reward worth coming back for */}
      <Link href="/recap" onClick={() => haptic()} className="press rise relative flex items-center justify-between gap-3 overflow-hidden rounded-[1.5rem] border border-border p-4"
        style={{ background: "linear-gradient(120deg, rgb(var(--c-sleep) / 0.16), rgb(var(--brand-b) / 0.12) 60%, rgb(var(--surface)))" }}>
        <div>
          <p className="eyebrow">Your week</p>
          <p className="display text-lg font-extrabold leading-tight">See your week, wrapped</p>
          <p className="mt-0.5 text-xs text-muted">A 30-second story of what you did and what to try next.</p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted" aria-hidden />
      </Link>

      {/* Coach insight */}
      <section aria-labelledby="insight-h" className="rise relative overflow-hidden rounded-[1.5rem] border border-brand/30 p-5" style={{ background: "linear-gradient(150deg, rgb(var(--brand-a) / 0.14), rgb(var(--brand-b) / 0.06) 60%), rgb(var(--surface))" }}>
        <h2 id="insight-h" className="flex items-center gap-2 text-sm font-bold"><span className="grad-brand flex h-7 w-7 items-center justify-center rounded-full text-brand-fg"><Sparkles className="h-4 w-4" aria-hidden /></span> Coach note</h2>
        <p className="mt-3 text-[1.05rem] leading-relaxed"><span className="mr-2 rounded-md bg-brand/15 px-1.5 py-0.5 align-middle text-[10px] font-bold uppercase tracking-wider text-brand">Recommendation</span>{data.coachNote}</p>
        {data.nutritionSuggestion && (
          <p className="mt-3 text-sm"><Lightbulb className="mr-1 inline h-4 w-4 text-warn" aria-hidden />{data.nutritionSuggestion.text}{data.nutritionSuggestion.approx && <span className="text-muted"> (≈{data.nutritionSuggestion.approx.kcal} kcal, {data.nutritionSuggestion.approx.protein} g protein, estimate)</span>}</p>
        )}
        {data.recovery.notes[0] && <p className="mt-2 text-sm text-muted">{data.recovery.notes[0]}</p>}
        {data.dietQuality && <p className="mt-2 text-sm text-muted">This week: {data.dietQuality.text}</p>}
        {adv && adv.action !== "WAIT" && adv.action !== "KEEP" && goal && (
          <div className="mt-3 rounded-2xl border border-border bg-surface p-3.5 text-sm">
            <p className="font-bold">Suggestion (you decide)</p>
            <p className="mt-0.5 text-muted">{adv.reason}</p>
            {!adv.blockedByFloor && adv.deltaKcal !== 0 && (
              <button className="btn mt-2.5" onClick={async () => { await logTool("update_goal", { calorieTarget: adv.suggestedTarget }); void refresh(); }}>
                Set target to {fmtNum(adv.suggestedTarget)} kcal
              </button>
            )}
          </div>
        )}
        {data.consistency && (
          <p className="mt-3 text-xs text-muted">Consistency this week: <span className="font-bold text-fg"><AnimatedNumber value={data.consistency.score} />/100</span>. A missed day dents the score; it never resets it.</p>
        )}
      </section>

      {/* Voice: the primary interaction */}
      <section className="card rise flex flex-col items-center gap-4 py-7" aria-label="Voice coach">
        <VoicePanel variant="hero" />
        {recent.length > 0 && (
          <div className="w-full max-w-xl border-t border-border pt-4"><MessageList messages={recent} compact /></div>
        )}
        <SafetyFooter className="max-w-md text-center" />
      </section>
    </div>
  );
}
