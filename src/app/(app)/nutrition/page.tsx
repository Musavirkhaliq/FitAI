"use client";
import { ChevronLeft, ChevronRight, Droplets, Flame, Footprints, Plus, Sigma, Sparkles, Sun, Utensils } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { AddFoodSheet } from "@/components/nutrition/AddFoodSheet";
import { guessMeal, isDay, normalizeMeals, scaleEntry, shiftDay, withEntries } from "@/components/nutrition/dayMath";
import { FoodEntryRow, type EntryPatch } from "@/components/nutrition/FoodEntryRow";
import { MicrosPanel } from "@/components/nutrition/MicrosPanel";
import { ProduceStepper } from "@/components/nutrition/ProduceStepper";
import { ErrorState, LoadingBlock, MetricCard, Notice, PageHeader } from "@/components/ui";
import { logTool, useApi } from "@/lib/client/api";
import { fmtDay, fmtNum, fmtWeight, MEAL_LABEL, todayLocal } from "@/lib/client/format";
import type { DaySummaryDto, MealType, TodayDto } from "@/lib/client/types";

const QUEUED = "I couldn't save that. Your entry is queued and will sync when you're back online.";

type Note = { tone: "good" | "warn"; text: string };

/** One stop on the day's timeline: a dot on the rail plus a card. */
function Step({ icon, title, aside, children }: { icon: ReactNode; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <li className="relative">
      <span aria-hidden className="absolute -left-[37px] top-5 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-brand">{icon}</span>
      <section className="card" aria-label={title}>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="text-sm font-semibold">{title}</h2>
          {aside}
        </div>
        {children}
      </section>
    </li>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
      {hint && <dd className="text-xs text-muted">{hint}</dd>}
    </div>
  );
}

function NutritionView() {
  const params = useSearchParams();
  const paramDate = params.get("date");
  const todayApi = useApi<TodayDto>("/api/today");
  const [sel, setSel] = useState<string | null>(isDay(paramDate) ? paramDate : null);
  const [note, setNote] = useState<Note | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addMeal, setAddMeal] = useState<MealType>("BREAKFAST");

  useEffect(() => {
    if (isDay(paramDate)) setSel(paramDate);
  }, [paramDate]);

  const today = todayApi.data?.today ?? (todayApi.error ? todayLocal() : null);
  const date = sel ?? today;
  const { data, error, refresh, setData } = useApi<DaySummaryDto>(date ? `/api/day?date=${date}` : null);
  const units = todayApi.data?.profile.unitSystem ?? "METRIC";

  const closeAdd = useCallback(() => setAddOpen(false), []);
  const openAdd = (m?: MealType) => {
    setAddMeal(m ?? guessMeal());
    setAddOpen(true);
  };
  const go = (d: string) => {
    setSel(d);
    setNote(null);
  };

  /** Run a save: surface queued/offline and errors as notices, roll back optimistic changes with a refetch on failure. */
  const run = async (fn: () => Promise<{ queued: boolean }>, ok: string) => {
    try {
      const r = await fn();
      setNote(r.queued ? { tone: "warn", text: QUEUED } : { tone: "good", text: ok });
    } catch (e) {
      setNote({ tone: "warn", text: (e as Error).message });
      void refresh();
    }
  };

  const removeEntry = (id: string) => {
    setData((prev) => prev && withEntries(prev, prev.meals.flatMap((m) => m.entries).filter((e) => e.id !== id)));
    return run(() => logTool("delete_entry", { kind: "food", id }), "Entry deleted.");
  };

  const editEntry = (id: string, patch: EntryPatch) => {
    setData((prev) =>
      prev && withEntries(prev, prev.meals.flatMap((m) => m.entries).map((e) => (e.id !== id ? e : { ...(patch.quantity ? scaleEntry(e, patch.quantity) : e), ...(patch.meal ? { meal: patch.meal } : {}) }))),
    );
    return run(() => logTool("edit_food_entry", { id, rescale: true, ...patch }), "Entry updated.");
  };

  const addWater = (ml: number) => {
    setData((prev) => prev && { ...prev, water: prev.water + ml });
    return run(() => logTool("log_water", { date, ml }), `Added ${ml} ml of water.`);
  };

  const addProduce = (kind: "veg" | "fruit", delta: 1 | -1) => {
    const bump = (n: number) => Math.max(0, Math.round((n + delta) * 10) / 10);
    setData((prev) => prev && (kind === "veg" ? { ...prev, vegServings: bump(prev.vegServings) } : { ...prev, fruitServings: bump(prev.fruitServings) }));
    const what = kind === "veg" ? "vegetables" : "fruit";
    return run(() => logTool("log_produce", { date, [kind === "veg" ? "vegServings" : "fruitServings"]: delta }), delta > 0 ? `Added a serving of ${what}.` : `Removed a serving of ${what}.`);
  };

  if (!date) return <LoadingBlock label="Loading nutrition" rows={4} />;

  const dq = todayApi.data?.dietQuality;
  const ready = data && data.date === date ? data : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Nutrition"
        subtitle={<>{fmtDay(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}{date === today ? " · Today" : ""}</>}
        actions={<button className="btn btn-primary" onClick={() => openAdd()}><Plus className="h-4 w-4" aria-hidden /> Add food</button>}
      />

      <nav aria-label="Choose day" className="card flex flex-wrap items-center gap-2 !p-3 sm:!p-3">
        <button className="btn !px-3" aria-label="Previous day" onClick={() => go(shiftDay(date, -1))}><ChevronLeft className="h-5 w-5" aria-hidden /></button>
        <div className="min-w-[9rem] flex-1">
          <label htmlFor="day-input" className="sr-only">Choose a date</label>
          <input id="day-input" type="date" className="input" value={date} max={today ?? undefined} onChange={(e) => isDay(e.target.value) && go(e.target.value)} />
        </div>
        <button className="btn !px-3" aria-label="Next day" disabled={!!today && date >= today} onClick={() => go(shiftDay(date, 1))}><ChevronRight className="h-5 w-5" aria-hidden /></button>
        <button className="btn" disabled={date === today} onClick={() => today && go(today)}>Today</button>
      </nav>

      <div aria-live="polite" className="space-y-2">
        {error && ready && <Notice tone="warn">{error}</Notice>}
        {note && <Notice tone={note.tone}>{note.text}</Notice>}
      </div>

      {!ready ? (
        error ? <ErrorState message={error} onRetry={() => void refresh()} /> : <LoadingBlock label="Loading this day" rows={4} />
      ) : (
        <DayTimeline s={ready} units={units} isToday={date === today} onAdd={openAdd} onDelete={removeEntry} onEdit={editEntry} onWater={addWater} onProduce={addProduce} />
      )}

      {dq && (
        <section className="card" aria-labelledby="dq-h">
          <h2 id="dq-h" className="text-sm font-semibold">Past week, in plain terms</h2>
          <p className="mt-1 text-sm text-muted">{dq.text}</p>
          <p className="mt-2 text-xs text-muted">
            Daily averages: about {fmtNum(dq.avgProtein)} g protein, {fmtNum(dq.avgFiber)} g fiber, {fmtNum(dq.vegPerDay, 1)} veg and {fmtNum(dq.fruitPerDay, 1)} fruit servings. Just a picture of the pattern, not a grade.
          </p>
        </section>
      )}

      <AddFoodSheet open={addOpen} onClose={closeAdd} date={date} defaultMeal={addMeal}
        onSaved={(queued) => setNote(queued ? { tone: "warn", text: QUEUED } : { tone: "good", text: "Logged. Your totals are updated." })} />
    </div>
  );
}

function DayTimeline({ s, units, isToday, onAdd, onDelete, onEdit, onWater, onProduce }: {
  s: DaySummaryDto;
  units: "METRIC" | "IMPERIAL";
  isToday: boolean;
  onAdd: (m: MealType) => void;
  onDelete: (id: string) => Promise<void>;
  onEdit: (id: string, patch: EntryPatch) => Promise<void>;
  onWater: (ml: number) => Promise<void>;
  onProduce: (kind: "veg" | "fruit", delta: 1 | -1) => Promise<void>;
}) {
  const t = s.targets;
  const kcal = Math.round(s.totals.calories);

  return (
    <ol className="relative ml-3 space-y-4 border-l border-border pl-6">
      <Step icon={<Sun className="h-3.5 w-3.5" />} title="Morning">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Stat label="Weight" value={s.weight ? fmtWeight(s.weight.kg, units) : "Not logged"} hint={s.weight?.time ? `at ${s.weight.time}` : undefined} />
          <Stat label="Sleep" value={s.sleep ? `${fmtNum(s.sleep.hours, 1)} h` : "Not logged"} hint={s.sleep?.quality ? `quality ${s.sleep.quality}/5` : undefined} />
        </dl>
      </Step>

      {normalizeMeals(s.meals).map((m) => (
        <Step key={m.meal} icon={<Utensils className="h-3.5 w-3.5" />} title={MEAL_LABEL[m.meal]}
          aside={m.entries.length > 0 && (
            <p className="text-sm text-muted">~{fmtNum(m.totals.calories)} kcal <span className="text-xs">(est. {fmtNum(m.totals.minKcal)}–{fmtNum(m.totals.maxKcal)})</span> · {fmtNum(m.totals.protein)} g protein</p>
          )}>
          {m.entries.length ? (
            <ul className="divide-y divide-border">
              {m.entries.map((e) => <FoodEntryRow key={e.id} entry={e} onDelete={onDelete} onEdit={onEdit} />)}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nothing logged for {MEAL_LABEL[m.meal].toLowerCase()}.</p>
          )}
          <button className="btn btn-ghost mt-1 !px-2" onClick={() => onAdd(m.meal)}>
            <Plus className="h-4 w-4" aria-hidden /> Add to {MEAL_LABEL[m.meal].toLowerCase()}
          </button>
        </Step>
      ))}

      <Step icon={<Footprints className="h-3.5 w-3.5" />} title="Activity">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Stat label="Steps" value={fmtNum(s.activity.steps)} hint={t ? `target ${fmtNum(t.steps)}` : undefined} />
          <Stat label="Training" value={`${fmtNum(s.activity.trainingMin)} min`} />
        </dl>
        {s.activity.entries.length > 0 ? (
          <ul className="mt-3 divide-y divide-border text-sm">
            {s.activity.entries.map((a) => (
              <li key={a.id} className="py-1.5">
                <span className="font-medium capitalize">{a.type.toLowerCase()}</span>
                <span className="text-muted">
                  {a.steps ? ` · ${fmtNum(a.steps)} steps` : ""}{a.durationMin ? ` · ${a.durationMin} min` : ""}{a.notes ? ` · ${a.notes}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">No activity logged.</p>
        )}
      </Step>

      <Step icon={<Sigma className="h-3.5 w-3.5" />} title="Daily totals (estimates)">
        <div className="grid gap-3 sm:grid-cols-2">
          <MetricCard label="Calories" value={kcal} target={t?.calories ?? null} unit="kcal" ranged={kcal ? [Math.round(s.totals.minKcal), Math.round(s.totals.maxKcal)] : null}
            hint={s.remaining ? (s.remaining.calories >= 0 ? `about ${fmtNum(s.remaining.calories)} left (estimate)` : `about ${fmtNum(-s.remaining.calories)} over. It's one day.`) : undefined} />
          <MetricCard label="Protein" value={Math.round(s.totals.protein)} target={t?.proteinG ?? null} unit="g" />
          <MetricCard label="Fiber" value={Math.round(s.totals.fiber)} target={t?.fiberG ?? null} unit="g" />
          <div className="card !p-3 sm:!p-4">
            <dl className="grid grid-cols-3 gap-2 text-sm">
              <Stat label="Carbs" value={`${fmtNum(s.totals.carbs)} g`} />
              <Stat label="Fat" value={`${fmtNum(s.totals.fat)} g`} />
              <Stat label="Sodium" value={`${fmtNum(s.totals.sodium)} mg`} />
            </dl>
          </div>
        </div>
      </Step>

      <Step icon={<Sparkles className="h-3.5 w-3.5" />} title="Vitamins & minerals (estimated)" aside={isToday ? <span className="text-xs text-muted">so far today</span> : undefined}>
        <MicrosPanel s={s} isToday={isToday} />
      </Step>

      <Step icon={<Flame className="h-3.5 w-3.5" />} title="Energy (estimates, not measurements)">
        {s.expenditure ? (
          <div className="space-y-2 text-sm">
            <p>Estimated burn: about <span className="font-semibold tabular-nums">{fmtNum(s.expenditure.mid)}</span> kcal <span className="text-muted">(est. range {fmtNum(s.expenditure.low)}–{fmtNum(s.expenditure.high)})</span></p>
            {s.deficit && (
              <p>Estimated deficit: about <span className="font-semibold tabular-nums">{fmtNum(s.deficit.mid)}</span> kcal <span className="text-muted">(est. range {fmtNum(s.deficit.low)} to {fmtNum(s.deficit.high)})</span></p>
            )}
            <p className="text-xs text-muted">Deficit is burn minus intake, so a negative number means more came in than went out. Both sides are estimates, so treat this as a rough guide. Weekly weight trends tell you more than any single day.</p>
          </div>
        ) : (
          <p className="text-sm text-muted">I need a weigh-in and your profile to estimate energy use for this day.</p>
        )}
      </Step>

      <Step icon={<Droplets className="h-3.5 w-3.5" />} title="Water, vegetables and fruit">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted">Water</p>
              <p className="font-semibold tabular-nums">{fmtNum(s.water)} ml{t ? <span className="text-sm font-normal text-muted"> / {fmtNum(t.waterMl)} ml</span> : null}</p>
            </div>
            <button className="btn" onClick={() => void onWater(250)}><Droplets className="h-4 w-4" aria-hidden /> +250 ml</button>
          </div>
          <ProduceStepper label="Vegetable servings" noun="vegetable" value={s.vegServings} onChange={(d) => void onProduce("veg", d)} />
          <ProduceStepper label="Fruit servings" noun="fruit" value={s.fruitServings} onChange={(d) => void onProduce("fruit", d)} />
          <p className="text-xs text-muted">A rough guide: aim for roughly 200–300 g vegetables (2–3 servings) and 1–2 fruit servings a day. Tap − if you added one by mistake.</p>
        </div>
      </Step>
    </ol>
  );
}

export default function NutritionPage() {
  return (
    <Suspense fallback={<LoadingBlock label="Loading nutrition" rows={4} />}>
      <NutritionView />
    </Suspense>
  );
}
