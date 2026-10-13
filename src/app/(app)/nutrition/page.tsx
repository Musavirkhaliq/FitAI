"use client";
import { Droplets, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AddFoodSheet } from "@/components/nutrition/AddFoodSheet";
import { DaySummary } from "@/components/nutrition/DaySummary";
import { guessMeal, isDay, normalizeMeals, scaleEntry, type SavedInfo, withEntries } from "@/components/nutrition/dayMath";
import type { EntryPatch } from "@/components/nutrition/FoodEntryRow";
import { MealCard } from "@/components/nutrition/MealCard";
import { MicrosPanel } from "@/components/nutrition/MicrosPanel";
import { ProduceStepper } from "@/components/nutrition/ProduceStepper";
import { Toast, type ToastData } from "@/components/nutrition/Toast";
import { WeekStrip } from "@/components/nutrition/WeekStrip";
import { ErrorState, Notice, PageHeader, ProgressBar, Skeleton, Tile, haptic } from "@/components/ui";
import { logTool, useApi } from "@/lib/client/api";
import { fmtDay, fmtNum, fmtWeight, todayLocal } from "@/lib/client/format";
import type { DaySummaryDto, MealType, TodayDto } from "@/lib/client/types";

const QUEUED = "I couldn't save that. Your entry is queued and will sync when you're back online.";
/** How long a delete can be undone before it is actually sent. */
const UNDO_MS = 6500;

function Section({ title, aside, index, children }: { title: string; aside?: ReactNode; index: number; children: ReactNode }) {
  return (
    <Tile index={index} className="!p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="display text-base font-extrabold">{title}</h2>
        {aside}
      </div>
      {children}
    </Tile>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-3.5 py-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="num mt-1 text-xl">{value}</dd>
      {hint && <dd className="mt-0.5 text-xs text-muted">{hint}</dd>}
    </div>
  );
}

/** Same shapes as the loaded day, so nothing jumps when data arrives. */
function DaySkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="space-y-3">
      <span className="sr-only">{label}…</span>
      <Skeleton className="h-[17rem]" />
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
      <Skeleton className="h-24" />
    </div>
  );
}

function NutritionView() {
  const params = useSearchParams();
  const paramDate = params.get("date");
  const todayApi = useApi<TodayDto>("/api/today");
  const [sel, setSel] = useState<string | null>(isDay(paramDate) ? paramDate : null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addMeal, setAddMeal] = useState<MealType>("BREAKFAST");
  const [hiddenId, setHiddenId] = useState<string | null>(null);
  const toastSeq = useRef(0);
  const pending = useRef<{ id: string; timer: ReturnType<typeof setTimeout> } | null>(null);

  useEffect(() => {
    if (isDay(paramDate)) setSel(paramDate);
  }, [paramDate]);

  const today = todayApi.data?.today ?? (todayApi.error ? todayLocal() : null);
  const date = sel ?? today;
  const { data, error, refresh, setData } = useApi<DaySummaryDto>(date ? `/api/day?date=${date}` : null);
  const units = todayApi.data?.profile.unitSystem ?? "METRIC";

  const showToast = useCallback((t: Omit<ToastData, "id">) => setToast({ ...t, id: ++toastSeq.current }), []);
  const dismissToast = useCallback((id: number) => setToast((cur) => (cur?.id === id ? null : cur)), []);
  const closeAdd = useCallback(() => setAddOpen(false), []);
  const openAdd = (m?: MealType) => {
    setAddMeal(m ?? guessMeal());
    setAddOpen(true);
  };

  /** Run a save: surface queued/offline and errors as a snackbar, roll back optimistic changes with a refetch on failure. */
  const run = async (fn: () => Promise<{ queued: boolean }>, ok: string) => {
    try {
      const r = await fn();
      showToast(r.queued ? { tone: "warn", text: QUEUED } : { tone: "good", text: ok });
    } catch (e) {
      showToast({ tone: "warn", text: (e as Error).message });
      void refresh();
    }
  };

  // Deletes are deferred: the row disappears at once, Undo cancels, and the real delete is sent after UNDO_MS (or when leaving).
  const commitDelete = useCallback(async () => {
    const p = pending.current;
    if (!p) return;
    clearTimeout(p.timer);
    pending.current = null;
    setData((prev) => prev && withEntries(prev, prev.meals.flatMap((m) => m.entries).filter((e) => e.id !== p.id)));
    setHiddenId(null);
    try {
      await logTool("delete_entry", { kind: "food", id: p.id });
    } catch (e) {
      showToast({ tone: "warn", text: (e as Error).message });
      void refresh();
    }
  }, [setData, refresh, showToast]);
  const commitRef = useRef(commitDelete);
  commitRef.current = commitDelete;

  useEffect(() => {
    const flush = () => void commitRef.current();
    const onVis = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      flush();
    };
  }, []);

  const undoDelete = useCallback(() => {
    const p = pending.current;
    if (!p) return;
    clearTimeout(p.timer);
    pending.current = null;
    setHiddenId(null);
    haptic();
    showToast({ tone: "good", text: "Put it back." });
  }, [showToast]);

  const go = (d: string) => {
    void commitDelete();
    setSel(d);
    setToast(null);
  };

  const view = useMemo(() => {
    if (!data || !date || data.date !== date) return null;
    return hiddenId ? withEntries(data, data.meals.flatMap((m) => m.entries).filter((e) => e.id !== hiddenId)) : data;
  }, [data, date, hiddenId]);

  const removeEntry = async (id: string) => {
    void commitDelete(); // an earlier pending delete is final once another begins
    const entry = view?.meals.flatMap((m) => m.entries).find((e) => e.id === id);
    if (!entry) return;
    setHiddenId(id);
    pending.current = { id, timer: setTimeout(() => void commitRef.current(), UNDO_MS) };
    showToast({ tone: "good", text: `Deleted ${entry.food}.`, ms: UNDO_MS, action: { label: "Undo", onClick: undoDelete } });
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

  const saved = (info: SavedInfo) => {
    if (info.queued) {
      showToast({ tone: "warn", text: QUEUED });
      return;
    }
    const id = info.undoId;
    showToast({
      tone: "good",
      text: `Logged ${info.label}`,
      ms: UNDO_MS,
      action: id ? {
        label: "Undo",
        onClick: () => {
          logTool("delete_entry", { kind: "food", id })
            .then(() => showToast({ tone: "good", text: "Removed." }))
            .catch((e: Error) => showToast({ tone: "warn", text: e.message }));
        },
      } : undefined,
    });
  };

  if (!date || !today) {
    return (
      <div className="space-y-4">
        <PageHeader title="Nutrition" subtitle="Your food log, one day at a time." />
        <Skeleton className="h-[5.5rem] !rounded-2xl" />
        <DaySkeleton label="Loading nutrition" />
      </div>
    );
  }

  const dq = todayApi.data?.dietQuality;
  const hasFood = view ? view.meals.some((m) => m.entries.length > 0) : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Nutrition"
        subtitle={<>{fmtDay(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}{date === today ? " · Today" : ""}</>}
        actions={<button className="btn btn-primary hidden md:inline-flex" onClick={() => openAdd()}><Plus className="h-4 w-4" aria-hidden /> Add food</button>}
      />

      <WeekStrip date={date} today={today} selectedHasFood={hasFood} onSelect={go} />

      <div aria-live="polite">{error && view && <Notice tone="warn">{error}</Notice>}</div>

      {!view ? (
        error ? <ErrorState message={error} onRetry={() => void refresh()} /> : <DaySkeleton label="Loading this day" />
      ) : (
        <DayView s={view} units={units} isToday={date === today} onAdd={openAdd} onDelete={removeEntry} onEdit={editEntry} onWater={addWater} onProduce={addProduce} />
      )}

      {dq && (
        <Section title="Past week, in plain terms" index={9}>
          <p className="text-sm">{dq.text}</p>
          <p className="mt-2 text-xs text-muted">
            Daily averages: about {fmtNum(dq.avgProtein)} g protein, {fmtNum(dq.avgFiber)} g fiber, {fmtNum(dq.vegPerDay, 1)} veg and {fmtNum(dq.fruitPerDay, 1)} fruit servings. Just a picture of the pattern, not a grade.
          </p>
        </Section>
      )}

      {/* Primary action: bottom-left thumb zone, clear of the docked orb on the right */}
      <button
        type="button"
        className="btn btn-primary fixed bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4.6rem)] left-4 z-30 !min-h-[56px] !gap-2 !rounded-full !px-6 text-base shadow-float md:hidden"
        onClick={() => { haptic(); openAdd(); }}
      >
        <Plus className="h-5 w-5" aria-hidden /> Add food
      </button>

      <Toast toast={toast} onDismiss={dismissToast} />

      <AddFoodSheet open={addOpen} onClose={closeAdd} date={date} today={today} defaultMeal={addMeal} onSaved={saved} />
    </div>
  );
}

function DayView({ s, units, isToday, onAdd, onDelete, onEdit, onWater, onProduce }: {
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
  const meals = normalizeMeals(s.meals);
  const anyFood = meals.some((m) => m.entries.length > 0);

  return (
    <div className="space-y-3">
      <section aria-label="Day summary"><DaySummary s={s} isToday={isToday} /></section>

      {!anyFood && (
        <p className="rise px-1 text-center text-sm text-muted" style={{ ["--i" as string]: 1 }}>
          Nothing logged {isToday ? "yet today" : "this day"}. Tap <span className="font-semibold text-fg">Add food</span>, or just tell your coach what you ate.
        </p>
      )}

      {meals.map((m, i) => <MealCard key={m.meal} m={m} index={i + 1} onAdd={onAdd} onDelete={onDelete} onEdit={onEdit} />)}

      <Section title="Body & movement" index={5}>
        <dl className="grid grid-cols-2 gap-2">
          <Stat label="Weight" value={s.weight ? fmtWeight(s.weight.kg, units) : "Not logged"} hint={s.weight?.time ? `at ${s.weight.time}` : undefined} />
          <Stat label="Sleep" value={s.sleep ? `${fmtNum(s.sleep.hours, 1)} h` : "Not logged"} hint={s.sleep?.quality ? `quality ${s.sleep.quality}/5` : undefined} />
          <Stat label="Steps" value={fmtNum(s.activity.steps)} hint={t ? `target ${fmtNum(t.steps)}` : undefined} />
          <Stat label="Training" value={`${fmtNum(s.activity.trainingMin)} min`} />
        </dl>
        {s.activity.entries.length > 0 ? (
          <ul className="mt-3 divide-y divide-border text-sm">
            {s.activity.entries.map((a) => (
              <li key={a.id} className="py-2">
                <span className="font-medium capitalize">{a.type.toLowerCase()}</span>
                <span className="text-muted">
                  {a.steps ? ` · ${fmtNum(a.steps)} steps` : ""}{a.durationMin ? ` · ${a.durationMin} min` : ""}{a.notes ? ` · ${a.notes}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">No activity logged.</p>
        )}
      </Section>

      <Section title="Water, vegetables and fruit" index={6}>
        <div className="space-y-2.5">
          <div className="rounded-2xl bg-surface-2 p-2.5 pl-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted">Water</p>
                <p className="num text-xl">{fmtNum(s.water)} ml{t ? <span className="text-sm font-medium text-muted"> / {fmtNum(t.waterMl)} ml</span> : null}</p>
              </div>
              <button className="btn !rounded-full !bg-surface" onClick={() => { haptic(); void onWater(250); }}><Droplets className="h-4 w-4" aria-hidden /> +250 ml</button>
            </div>
            {t && (
              <div className="mt-2 pr-1.5 [&>[role=progressbar]]:!h-1.5">
                <ProgressBar value={Math.min(s.water, t.waterMl)} max={t.waterMl} label={`Water: ${fmtNum(s.water)} of ${fmtNum(t.waterMl)} ml`} color="brand" />
              </div>
            )}
          </div>
          <ProduceStepper label="Vegetable servings" noun="vegetable" value={s.vegServings} onChange={(d) => void onProduce("veg", d)} />
          <ProduceStepper label="Fruit servings" noun="fruit" value={s.fruitServings} onChange={(d) => void onProduce("fruit", d)} />
          <p className="px-1 text-xs text-muted">A rough guide: aim for roughly 200–300 g vegetables (2–3 servings) and 1–2 fruit servings a day. Tap − if you added one by mistake.</p>
        </div>
      </Section>

      <Section title="Vitamins & minerals (estimated)" index={7} aside={isToday ? <span className="text-xs text-muted">so far today</span> : undefined}>
        <MicrosPanel s={s} isToday={isToday} />
      </Section>

      <Section title="Energy (estimates, not measurements)" index={8}>
        {s.expenditure ? (
          <div className="space-y-2 text-sm">
            <p>Estimated burn: about <span className="num !text-base">{fmtNum(s.expenditure.mid)}</span> kcal <span className="text-muted">(est. range {fmtNum(s.expenditure.low)}–{fmtNum(s.expenditure.high)})</span></p>
            {s.deficit && (
              <p>Estimated deficit: about <span className="num !text-base">{fmtNum(s.deficit.mid)}</span> kcal <span className="text-muted">(est. range {fmtNum(s.deficit.low)} to {fmtNum(s.deficit.high)})</span></p>
            )}
            <p className="text-xs text-muted">Deficit is burn minus intake, so a negative number means more came in than went out. Both sides are estimates, so treat this as a rough guide. Weekly weight trends tell you more than any single day.</p>
          </div>
        ) : (
          <p className="text-sm text-muted">I need a weigh-in and your profile to estimate energy use for this day.</p>
        )}
      </Section>
    </div>
  );
}

export default function NutritionPage() {
  return (
    <Suspense fallback={<DaySkeleton label="Loading nutrition" />}>
      <NutritionView />
    </Suspense>
  );
}
