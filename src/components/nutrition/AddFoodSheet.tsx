"use client";
import { MessageSquareText, Repeat, ScanBarcode, Search, Send } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useCoach } from "@/components/coach/CoachProvider";
import { clsx, Field, Notice, Sheet, Spinner, Toggle, haptic } from "@/components/ui";
import { ApiError, api, isOfflineError, logTool, post } from "@/lib/client/api";
import { fmtNum, MEAL_LABEL } from "@/lib/client/format";
import type { MealType } from "@/lib/client/types";
import { getCachedFoods, type FrequentFood } from "@/lib/client/queue";
import type { EstimatedFood } from "@/lib/food/portion";
import { BarcodeLog } from "./BarcodeLog";
import { MEAL_ORDER, type SavedInfo } from "./dayMath";
import { ConfidenceBadge } from "./mealMeta";

export type { SavedInfo };

const UNITS = ["g", "kg", "oz", "piece", "cup", "bowl", "plate", "katori", "tbsp", "tsp", "glass", "slice", "scoop", "can"];
const PREPS = ["fried", "curry", "grilled", "boiled", "roasted", "steamed", "baked", "raw"];
const EXAMPLES = ["Two eggs, toast and a coffee with milk", "Chicken curry with rice and a small salad", "A banana and a handful of almonds"];

type Tab = "search" | "frequent" | "barcode" | "describe";
const TABS: { value: Tab; label: string; icon: typeof Search }[] = [
  { value: "search", label: "Search", icon: Search },
  { value: "frequent", label: "Frequent", icon: Repeat },
  { value: "barcode", label: "Barcode", icon: ScanBarcode },
  { value: "describe", label: "Describe", icon: MessageSquareText },
];

interface Suggestion { name: string; kcal: number; protein: number; units: string[] }
interface Preview { estimate: EstimatedFood; match: { name: string; score: number; source: string } }

/** The payload the log_food tool wants, from a computed estimate. */
const entryFrom = (est: EstimatedFood, fallbackName: string) => ({
  food: est.name || fallbackName,
  foodItemId: est.foodItemId,
  quantity: est.quantity,
  unit: est.unit,
  grams: est.grams,
  prep: est.prep,
  calories: est.calories,
  protein: est.protein,
  carbs: est.carbs,
  fat: est.fat,
  fiber: est.fiber,
  sodium: est.sodium,
  micros: est.micros,
  confidence: est.estimate.confidence,
  estimateMin: est.estimate.min,
  estimateMax: est.estimate.max,
  assumptions: est.assumptions,
  uncertaintySources: est.estimate.sources,
});

function Macro({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-xl bg-surface px-2.5 py-2">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}<span className="ml-0.5 text-xs font-normal text-muted">{unit}</span></dd>
    </div>
  );
}

function AddFoodForm({ date, today, defaultMeal, onClose, onSaved }: { date: string; today: string; defaultMeal: MealType; onClose: () => void; onSaved: (info: SavedInfo) => void }) {
  const coach = useCoach();
  const uid = useId();
  const [meal, setMeal] = useState<MealType>(defaultMeal);
  const [mealPicked, setMealPicked] = useState(false);
  const [userTab, setUserTab] = useState<Tab | null>(null);
  const [frequent, setFrequent] = useState<FrequentFood[]>([]);
  const [freqLoaded, setFreqLoaded] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // Search
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("piece");
  const [extraUnits, setExtraUnits] = useState<string[]>([]);
  const [prep, setPrep] = useState("");
  const [boneIn, setBoneIn] = useState(false);
  const [restaurant, setRestaurant] = useState(false);
  const [measured, setMeasured] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [preview, setPreview] = useState<{ key: string; data: Preview } | null>(null);
  const [busy, setBusy] = useState<"preview" | "log" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const picked = useRef("");

  // Describe
  const [text, setText] = useState("");

  const tab: Tab = userTab ?? (freqLoaded && frequent.length > 0 ? "frequent" : "search");
  const tabIdx = TABS.findIndex((t) => t.value === tab);

  useEffect(() => {
    void getCachedFoods().then((f) => {
      setFrequent(f.slice(0, 16));
      setFreqLoaded(true);
    });
  }, []);

  // Debounced autocomplete; offline just means no suggestions.
  useEffect(() => {
    const q = name.trim();
    if (q.length < 2 || q === picked.current) {
      setSuggestions([]);
      return;
    }
    let live = true;
    const t = setTimeout(() => {
      api<{ foods: Suggestion[] }>(`/api/foods?q=${encodeURIComponent(q)}`)
        .then((r) => live && setSuggestions(r.foods.slice(0, 6)))
        .catch(() => live && setSuggestions([]));
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [name]);

  const q = Number(qty.replace(",", "."));
  const qtyOk = Number.isFinite(q) && q > 0;
  const key = JSON.stringify([name.trim(), q, unit, prep.trim(), boneIn, restaurant, measured, meal]);
  const current = preview && preview.key === key ? preview.data : null; // any edit invalidates the preview
  const unitOptions = [...UNITS, ...extraUnits.filter((u) => !UNITS.includes(u))];

  const pick = (s: Suggestion) => {
    picked.current = s.name;
    setName(s.name);
    setExtraUnits(s.units);
    setSuggestions([]);
  };

  const onEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && name.trim() && qtyOk && !busy) {
      e.preventDefault();
      void runPreview();
    }
  };

  const runPreview = async () => {
    setMsg(null);
    setBusy("preview");
    try {
      const data = await post<Preview>("/api/foods", {
        name: name.trim(), quantity: q, unit, prep: prep.trim() || null, boneIn: boneIn || null, measured, restaurant, meal,
      });
      setPreview({ key, data });
    } catch (e) {
      if (isOfflineError(e)) setMsg("The preview needs a connection. Try the Frequent tab, or say it to the coach and I'll queue it until you're back online.");
      else if (e instanceof ApiError && e.status === 404) setMsg(`I couldn't find "${name.trim()}". Try a simpler name, like "chicken curry" or "banana".`);
      else if (e instanceof ApiError && e.status === 429) setMsg("That's a lot of previews at once. Give it a moment and try again.");
      else setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const log = async () => {
    if (!current) return;
    const est = current.estimate;
    setMsg(null);
    setBusy("log");
    try {
      const res = await logTool<{ ids: string[] }>("log_food", { date, meal, source: "MANUAL", entries: [entryFrom(est, name.trim())] });
      haptic("success");
      onSaved({ queued: res.queued, label: `${est.quantity} ${est.unit} ${est.name || name.trim()} · ~${fmtNum(est.calories)} kcal`, undoId: res.queued ? null : res.result.ids[0] ?? null });
      onClose();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  /** One tap: estimate the usual portion and save it. Offline, save the remembered average instead (clearly low confidence). */
  const logFrequent = async (f: FrequentFood) => {
    setBusyKey(`${f.food}|${f.unit}`);
    setMsg(null);
    try {
      let entry: Record<string, unknown>;
      let kcal = f.kcal;
      try {
        const { estimate: est } = await post<{ estimate: EstimatedFood }>("/api/foods", { name: f.food, quantity: f.typicalQuantity, unit: f.unit, meal });
        entry = entryFrom(est, f.food);
        kcal = est.calories;
      } catch (e) {
        if (!isOfflineError(e)) throw e;
        entry = {
          food: f.food, quantity: f.typicalQuantity, unit: f.unit, calories: f.kcal, protein: f.protein, carbs: 0, fat: 0, fiber: 0, sodium: 0, micros: {},
          confidence: "LOW", estimateMin: Math.round(f.kcal * 0.7), estimateMax: Math.round(f.kcal * 1.3),
          assumptions: ["Saved offline from your usual portion of this food."],
          uncertaintySources: ["Carbs, fat and fiber weren't counted because this was saved without a connection."],
        };
      }
      const res = await logTool<{ ids: string[] }>("log_food", { date, meal, source: "MANUAL", entries: [entry] });
      haptic("success");
      onSaved({ queued: res.queued, label: `${f.typicalQuantity} ${f.unit} ${f.food} · ~${fmtNum(kcal)} kcal`, undoId: res.queued ? null : res.result.ids[0] ?? null });
      onClose();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : "I couldn't log that. Try again.");
    } finally {
      setBusyKey(null);
    }
  };

  const describe = () => {
    const t = text.trim();
    if (t.length < 2) return;
    const parts = [t];
    if (mealPicked) parts.push(`for ${meal === "SNACK" ? "a snack" : MEAL_LABEL[meal].toLowerCase()}`);
    if (date !== today) parts.push(`on ${date}`);
    haptic("success");
    void coach.send(parts.join(", "), "TEXT");
    onClose();
    coach.openSheet(); // so the coach's answer and the logged card are visible right away
  };

  const onTabKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = TABS[(tabIdx + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length].value;
    setUserTab(next);
    document.getElementById(`${uid}-tab-${next}`)?.focus();
  };

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Meal" className="grid grid-cols-4 gap-2">
        {MEAL_ORDER.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={meal === m}
            onClick={() => { haptic(); setMeal(m); setMealPicked(true); }}
            className={clsx("press min-h-[44px] rounded-full border px-1 text-[13px] font-semibold transition-colors", meal === m ? "border-brand bg-brand/10 text-brand" : "border-border bg-surface text-muted hover:bg-surface-2")}
          >
            {MEAL_LABEL[m]}
          </button>
        ))}
      </div>

      <div role="tablist" aria-label="How to add food" onKeyDown={onTabKeys} className="relative grid grid-cols-4 rounded-2xl border border-border bg-surface-2 p-1">
        <span aria-hidden className="absolute inset-y-1 left-1 rounded-xl bg-surface shadow-tile transition-transform duration-300 ease-out" style={{ width: "calc((100% - 0.5rem) / 4)", transform: `translateX(${tabIdx * 100}%)` }} />
        {TABS.map((t) => {
          const on = t.value === tab;
          return (
            <button
              key={t.value}
              id={`${uid}-tab-${t.value}`}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls={`${uid}-panel`}
              tabIndex={on ? 0 : -1}
              onClick={() => { haptic(); setMsg(null); setUserTab(t.value); }}
              className={clsx("relative z-10 flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold transition-colors", on ? "text-fg" : "text-muted hover:text-fg")}
            >
              <t.icon className="h-5 w-5" aria-hidden /> {t.label}
            </button>
          );
        })}
      </div>

      <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-tab-${tab}`} className="space-y-4">
        {tab === "search" && (
          <div className="space-y-3">
            {/* A div, not a form: the Toggle switches are buttons and would submit it. */}
            <Field label="Food" htmlFor="af-name">
              <input id="af-name" className="input" value={name} onChange={(e) => { setName(e.target.value); picked.current = ""; }} onKeyDown={onEnter} autoComplete="off" placeholder="e.g. chicken curry, banana, roti" />
            </Field>
            <p className="sr-only" aria-live="polite">{suggestions.length ? `${suggestions.length} suggestions below` : ""}</p>
            {suggestions.length > 0 && (
              <ul aria-label="Food suggestions" className="pop divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface-2">
                {suggestions.map((s) => (
                  <li key={s.name}>
                    <button type="button" className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-2 text-left hover:bg-surface-3" onClick={() => pick(s)}>
                      <span className="min-w-0 break-words text-sm font-medium">{s.name}</span>
                      <span className="shrink-0 text-right text-[11px] text-muted">{fmtNum(s.kcal)} kcal · {fmtNum(s.protein, 1)} g protein<br />per 100 g</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Quantity" htmlFor="af-qty">
                <input id="af-qty" className="input" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} onKeyDown={onEnter} />
              </Field>
              <Field label="Unit" htmlFor="af-unit">
                <select id="af-unit" className="input" value={unit} onChange={(e) => setUnit(e.target.value)}>
                  {unitOptions.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </Field>
            </div>
            <Field label="How it was made (optional)" htmlFor="af-prep">
              <input id="af-prep" className="input" list="af-preps" value={prep} onChange={(e) => setPrep(e.target.value)} placeholder="fried, grilled…" />
              <datalist id="af-preps">{PREPS.map((p) => <option key={p} value={p} />)}</datalist>
            </Field>

            <details className="group rounded-2xl bg-surface-2 px-4">
              <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between text-sm font-semibold [&::-webkit-details-marker]:hidden">
                Portion details
                <span className="text-xs font-normal text-muted">{[boneIn && "bone-in", restaurant && "restaurant", measured && "measured"].filter(Boolean).join(" · ") || "optional"}</span>
              </summary>
              <div className="divide-y divide-border pb-1">
                <Toggle checked={boneIn} onChange={setBoneIn} label="Bone-in" description="Weight includes bones, so less of it is edible." />
                <Toggle checked={restaurant} onChange={setRestaurant} label="Restaurant" description="Restaurant portions and oil vary, so the range gets wider." />
                <Toggle checked={measured} onChange={setMeasured} label="I measured it" description="Weighed or read off a label, so the range gets narrower." />
              </div>
            </details>

            <button className="btn w-full" onClick={() => void runPreview()} disabled={!name.trim() || !qtyOk || busy !== null}>
              {busy === "preview" ? <Spinner label="Estimating" /> : "Preview estimate"}
            </button>

            <div aria-live="polite" className="space-y-3">
              {current && (
                <div className="pop space-y-3 rounded-2xl border border-brand/30 bg-brand/5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{current.estimate.quantity} {current.estimate.unit} {current.estimate.name}</p>
                    <ConfidenceBadge confidence={current.estimate.estimate.confidence} />
                  </div>
                  <p>
                    About <span className="num text-[2rem]">{fmtNum(current.estimate.calories)}</span> kcal{" "}
                    <span className="text-sm text-muted">(est. range {fmtNum(current.estimate.estimate.min)}–{fmtNum(current.estimate.estimate.max)})</span>
                  </p>
                  <dl className="grid grid-cols-4 gap-2 text-sm">
                    <Macro label="Protein" value={fmtNum(current.estimate.protein, 1)} unit="g" />
                    <Macro label="Carbs" value={fmtNum(current.estimate.carbs, 1)} unit="g" />
                    <Macro label="Fat" value={fmtNum(current.estimate.fat, 1)} unit="g" />
                    <Macro label="Fiber" value={fmtNum(current.estimate.fiber, 1)} unit="g" />
                  </dl>
                  <p className="text-xs text-muted">Sodium {fmtNum(current.estimate.sodium)} mg · matched to “{current.match.name}”, counted as roughly {fmtNum(current.estimate.grams)} g.</p>
                  {(current.estimate.assumptions.length > 0 || current.estimate.estimate.sources.length > 0) && (
                    <details className="text-sm">
                      <summary className="min-h-[44px] cursor-pointer py-2.5 font-medium text-brand">How I got this number</summary>
                      {current.estimate.assumptions.length > 0 && (
                        <div>
                          <p className="font-semibold">What I assumed</p>
                          <ul className="list-disc pl-5 text-muted">{current.estimate.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
                        </div>
                      )}
                      {current.estimate.estimate.sources.length > 0 && (
                        <div className="mt-2">
                          <p className="font-semibold">What could move the number</p>
                          <ul className="list-disc pl-5 text-muted">{current.estimate.estimate.sources.map((a, i) => <li key={i}>{a}</li>)}</ul>
                        </div>
                      )}
                    </details>
                  )}
                  <button className="btn btn-primary w-full" onClick={() => void log()} disabled={busy !== null}>
                    {busy === "log" ? <Spinner label="Saving" /> : `Log it to ${MEAL_LABEL[meal]}`}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "frequent" && (
          <section aria-label="Frequent foods" className="space-y-3">
            {frequent.length > 0 ? (
              <>
                <p className="text-sm text-muted">One tap logs your usual portion to {MEAL_LABEL[meal].toLowerCase()}. You can edit or undo it right after.</p>
                <ul className="flex flex-wrap gap-2">
                  {frequent.map((f) => {
                    const k = `${f.food}|${f.unit}`;
                    return (
                      <li key={k}>
                        <button
                          type="button"
                          className="chip !min-h-[48px] !gap-2 !px-4"
                          disabled={busyKey !== null}
                          aria-label={`Log ${f.typicalQuantity} ${f.unit} ${f.food}, about ${fmtNum(f.kcal)} kcal, to ${MEAL_LABEL[meal].toLowerCase()}`}
                          onClick={() => void logFrequent(f)}
                        >
                          {busyKey === k ? <Spinner label="Logging" /> : null}
                          <span className="font-semibold">{f.food}</span>
                          <span className="text-xs text-muted">{f.typicalQuantity} {f.unit} · {fmtNum(f.kcal)} kcal</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-border px-5 py-8 text-center">
                <p className="display text-base font-bold">Your go-to foods will live here</p>
                <p className="mx-auto mt-1 max-w-xs text-sm text-muted">Log a few meals and the things you eat most become one-tap chips.</p>
                <button type="button" className="btn mt-4" onClick={() => setUserTab("search")}><Search className="h-4 w-4" aria-hidden /> Search for a food</button>
              </div>
            )}
          </section>
        )}

        {tab === "barcode" && (
          <BarcodeLog date={date} meal={meal} onSaved={(info) => { onSaved(info); onClose(); }} />
        )}

        {tab === "describe" && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); describe(); }}>
            <Field label="Describe what you ate" htmlFor="af-describe" hint="Say it the way you'd tell a friend. Your coach estimates portions, shows a range, and logs it.">
              <textarea
                id="af-describe"
                className="input !min-h-[7rem] py-3"
                rows={4}
                maxLength={500}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); describe(); } }}
                placeholder="e.g. two eggs, toast with butter and a coffee with milk"
              />
            </Field>
            <ul className="flex flex-wrap gap-2" aria-label="Examples">
              {EXAMPLES.map((ex) => (
                <li key={ex}><button type="button" className="chip !min-h-[44px] text-left text-muted" onClick={() => setText(ex)}>{ex}</button></li>
              ))}
            </ul>
            <button className="btn btn-primary w-full" disabled={text.trim().length < 2}>
              <Send className="h-4 w-4" aria-hidden /> Log with my coach
            </button>
          </form>
        )}

        <div aria-live="polite">{msg && <Notice tone="warn">{msg}</Notice>}</div>
      </div>
    </div>
  );
}

/** Four ways to add food in one sheet: search, one-tap frequent foods, barcode, or just describe it. Remounts on each open. */
export function AddFoodSheet({ open, onClose, date, today, defaultMeal, onSaved }: {
  open: boolean; onClose: () => void; date: string; today?: string; defaultMeal: MealType; onSaved: (info: SavedInfo) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Add food">
      <AddFoodForm date={date} today={today ?? date} defaultMeal={defaultMeal} onClose={onClose} onSaved={onSaved} />
    </Sheet>
  );
}
