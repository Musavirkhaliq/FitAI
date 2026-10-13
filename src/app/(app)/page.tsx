"use client";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Dumbbell, Lightbulb, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { MessageList, SafetyFooter } from "@/components/coach/Messages";
import { useCoach } from "@/components/coach/CoachProvider";
import { VoicePanel } from "@/components/coach/VoicePanel";
import { MealList } from "@/components/today/MealList";
import { QuickLog } from "@/components/today/QuickLog";
import { WeightSpark } from "@/components/today/WeightSpark";
import { Badge, ErrorState, LoadingBlock, MetricCard, Notice } from "@/components/ui";
import { logTool, useApi } from "@/lib/client/api";
import { fmtDay, fmtDelta, fmtNum, fmtWeight, greeting, STATUS_LABEL } from "@/lib/client/format";
import type { TodayDto } from "@/lib/client/types";

const STATUS_TONE = { FAST_LOSS: "warn", TARGET_LOSS: "good", SLOW_LOSS: "neutral", PLATEAU: "neutral", GAINING: "warn", INSUFFICIENT_DATA: "neutral" } as const;

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

  if (loading && !data) return <LoadingBlock label="Loading today" rows={4} />;
  if (!data) return <ErrorState message={error ?? "I couldn't load today. Check your connection."} onRetry={() => void refresh()} />;

  const { summary: s, trend, goal, profile } = data;
  const units = profile.unitSystem;
  const t = s.targets;
  const calories = live ? live.calories : Math.round(s.totals.calories);
  const range: [number, number] = live ? live.caloriesRange : [Math.round(s.totals.minKcal), Math.round(s.totals.maxKcal)];
  const protein = live ? live.protein : Math.round(s.totals.protein);
  const fiber = live ? live.fiber : Math.round(s.totals.fiber);
  const steps = live ? live.steps : s.activity.steps;
  const sleepH = live ? live.sleepH : s.sleep?.hours ?? null;
  const weightKg = live?.weightKg ?? s.weight?.kg ?? null;
  const remaining = live?.remaining ?? s.remaining;
  const delta = weightKg != null && data.yesterdayWeightKg != null ? weightKg - data.yesterdayWeightKg : trend.changeFromYesterdayKg;
  const DeltaIcon = delta == null ? ArrowRight : delta < -0.05 ? ArrowDownRight : delta > 0.05 ? ArrowUpRight : ArrowRight;
  const adv = data.calorieAdvice;

  return (
    <div className="space-y-5">
      {error && <Notice tone="warn">{error}</Notice>}

      <header>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{greeting(data.user?.name)}</h1>
        <p className="text-sm text-muted">{fmtDay(data.date, { weekday: "long", day: "numeric", month: "long" })}</p>
      </header>

      {/* Weight + 7-day trend */}
      <section className="grid gap-4 md:grid-cols-5" aria-label="Weight">
        <div className="card md:col-span-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Weight today</p>
          <p className="mt-1 text-4xl font-semibold tabular-nums">{weightKg != null ? fmtWeight(weightKg, units) : "—"}</p>
          {weightKg == null ? (
            <p className="mt-1 text-sm text-muted">Not weighed in yet. Say “I weighed 84.5 this morning”.</p>
          ) : (
            <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted">
              <DeltaIcon className="h-4 w-4" aria-hidden /> {delta == null ? "No yesterday to compare" : `${fmtDelta(delta, units)} vs yesterday`}
            </p>
          )}
          <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
            <div><dt className="text-xs text-muted">7-day avg</dt><dd className="font-semibold tabular-nums">{fmtWeight(trend.ma7, units)}</dd></div>
            <div><dt className="text-xs text-muted">14-day avg</dt><dd className="font-semibold tabular-nums">{fmtWeight(trend.ma14, units)}</dd></div>
            <div><dt className="text-xs text-muted">From start</dt><dd className="font-semibold tabular-nums">{fmtDelta(trend.changeFromStartKg, units)}</dd></div>
          </dl>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[trend.status]}>{STATUS_LABEL[trend.status]}</Badge>
            {trend.weeklyRateKg != null && <span className="text-xs text-muted">{fmtDelta(trend.weeklyRateKg, units, 2)}/week (14-day trend)</span>}
          </div>
          <p className="mt-2 text-xs text-muted">{trend.note}</p>
        </div>
        <div className="md:col-span-3"><WeightSpark days={data.weeklyDays} units={units} /></div>
      </section>

      {/* Targets */}
      <section aria-label="Today's targets" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard label="Calories" value={calories} target={t?.calories ?? null} unit="kcal" ranged={calories ? range : null}
          hint={remaining ? (remaining.calories >= 0 ? `~${fmtNum(remaining.calories)} left (estimate)` : `~${fmtNum(-remaining.calories)} over — it's one day`) : "Set a target in Settings"} />
        <MetricCard label="Protein" value={protein} target={t?.proteinG ?? null} unit="g" hint={remaining ? (remaining.proteinG > 0 ? `${fmtNum(remaining.proteinG)} g to go` : "Target reached") : undefined} />
        <MetricCard label="Fiber" value={fiber} target={t?.fiberG ?? null} unit="g" />
        <MetricCard label="Steps" value={steps} target={t?.steps ?? null} />
        <MetricCard label="Sleep" value={sleepH} target={t?.sleepH ?? null} unit="h" format={(n) => fmtNum(n, 1)} hint={sleepH == null ? "Not logged" : undefined} />
        <div className="card flex flex-col justify-center !p-3 sm:!p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Energy (estimates)</p>
          <p className="text-sm">Burn ≈ <span className="font-semibold tabular-nums">{s.expenditure ? `${fmtNum(s.expenditure.low)}–${fmtNum(s.expenditure.high)}` : "—"}</span> kcal</p>
          <p className="text-sm">{data.date === data.today ? "Deficit so far" : "Deficit"} ≈ <span className="font-semibold tabular-nums">{s.deficit ? `${fmtNum(s.deficit.low)} to ${fmtNum(s.deficit.high)}` : "—"}</span> kcal</p>
          <p className="mt-1 text-xs text-muted">{data.date === data.today ? "Day still in progress, so this shrinks as you eat. " : ""}Estimated, not measured. Water: {fmtNum(live?.water ?? s.water)} ml.</p>
        </div>
      </section>

      {/* Today's workout */}
      <section className="card flex flex-wrap items-center justify-between gap-3" aria-labelledby="wk-h">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/15 text-brand"><Dumbbell className="h-6 w-6" aria-hidden /></span>
          <div>
            <h2 id="wk-h" className="text-sm font-semibold">Today&apos;s workout</h2>
            {data.workout ? (
              <p className="text-sm text-muted">{data.workout.day.name} · {data.workout.day.focus} · {data.workout.exerciseCount} exercises{data.workout.deloadSuggested ? " · deload suggested" : ""}</p>
            ) : (
              <p className="text-sm text-muted">No plan yet. Say “create me a 4-day gym plan”.</p>
            )}
          </div>
        </div>
        {data.workout ? (
          data.workout.completedToday ? <Badge tone="good">Done today</Badge> : <Link href="/workouts" className="btn btn-primary">{data.workout.inProgress ? "Continue" : "Start workout"}</Link>
        ) : (
          <button className="btn" onClick={() => void coach.send("Create me a workout plan", "TEXT")}>Create a plan</button>
        )}
      </section>

      {/* Meals */}
      <section className="card" aria-labelledby="meals-h">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="meals-h" className="text-sm font-semibold">Meals</h2>
          <Link href="/nutrition" className="text-sm text-brand underline">Open nutrition log</Link>
        </div>
        <MealList meals={s.meals} onRemoved={removeFood} />
      </section>

      <QuickLog date={data.date} units={units} onLogged={() => void refresh()} />

      {/* Coach insight */}
      <section className="card space-y-3 border-brand/30 bg-brand/5" aria-labelledby="insight-h">
        <h2 id="insight-h" className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-brand" aria-hidden /> Coach note</h2>
        <p><span className="mr-2 rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">Recommendation</span>{data.coachNote}</p>
        {data.nutritionSuggestion && (
          <p className="text-sm"><Lightbulb className="mr-1 inline h-4 w-4 text-warn" aria-hidden />{data.nutritionSuggestion.text}{data.nutritionSuggestion.approx && <span className="text-muted"> (≈{data.nutritionSuggestion.approx.kcal} kcal, {data.nutritionSuggestion.approx.protein} g protein — estimate)</span>}</p>
        )}
        {data.recovery.notes[0] && <p className="text-sm text-muted">{data.recovery.notes[0]}</p>}
        {data.dietQuality && <p className="text-sm text-muted">This week: {data.dietQuality.text}</p>}
        {adv && adv.action !== "WAIT" && adv.action !== "KEEP" && goal && (
          <div className="rounded-xl border border-border bg-surface p-3 text-sm">
            <p className="font-medium">Suggestion (you decide)</p>
            <p className="text-muted">{adv.reason}</p>
            {!adv.blockedByFloor && adv.deltaKcal !== 0 && (
              <button className="btn mt-2" onClick={async () => { await logTool("update_goal", { calorieTarget: adv.suggestedTarget }); void refresh(); }}>
                Set target to {fmtNum(adv.suggestedTarget)} kcal
              </button>
            )}
          </div>
        )}
        {data.consistency && <p className="text-xs text-muted">Consistency this week: <span className="font-semibold text-fg">{data.consistency.score}/100 · {data.consistency.label}</span>. Misses dent the score; they never reset it.</p>}
      </section>

      {/* Voice: the primary interaction */}
      <section className="card flex flex-col items-center gap-4 py-8" aria-label="Voice coach">
        <VoicePanel variant="hero" />
        {recent.length > 0 && (
          <div className="w-full max-w-xl border-t border-border pt-4"><MessageList messages={recent} compact /></div>
        )}
        <SafetyFooter className="max-w-md text-center" />
      </section>
    </div>
  );
}
