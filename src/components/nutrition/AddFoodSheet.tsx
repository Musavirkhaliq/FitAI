"use client";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Badge, Field, Notice, Sheet, Spinner, Toggle } from "@/components/ui";
import { ApiError, api, isOfflineError, logTool, post } from "@/lib/client/api";
import { CONF_LABEL, fmtNum, MEAL_LABEL } from "@/lib/client/format";
import type { MealType } from "@/lib/client/types";
import { getCachedFoods, type FrequentFood } from "@/lib/client/queue";
import type { EstimatedFood } from "@/lib/food/portion";
import { BarcodeLog } from "./BarcodeLog";
import { MEAL_ORDER } from "./dayMath";

const UNITS = ["g", "kg", "oz", "piece", "cup", "bowl", "plate", "katori", "tbsp", "tsp", "glass", "slice", "scoop", "can"];
const PREPS = ["fried", "curry", "grilled", "boiled", "roasted", "steamed", "baked", "raw"];
const TONE = { HIGH: "good", MEDIUM: "warn", LOW: "bad" } as const;

interface Suggestion { name: string; kcal: number; protein: number; units: string[] }
interface Preview { estimate: EstimatedFood; match: { name: string; score: number; source: string } }

function AddFoodForm({ date, defaultMeal, onClose, onSaved }: { date: string; defaultMeal: MealType; onClose: () => void; onSaved: (queued: boolean) => void }) {
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("piece");
  const [extraUnits, setExtraUnits] = useState<string[]>([]);
  const [meal, setMeal] = useState<MealType>(defaultMeal);
  const [prep, setPrep] = useState("");
  const [boneIn, setBoneIn] = useState(false);
  const [restaurant, setRestaurant] = useState(false);
  const [measured, setMeasured] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [frequent, setFrequent] = useState<FrequentFood[]>([]);
  const [preview, setPreview] = useState<{ key: string; data: Preview } | null>(null);
  const [busy, setBusy] = useState<"preview" | "log" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const picked = useRef("");

  useEffect(() => {
    void getCachedFoods().then((f) => setFrequent(f.slice(0, 12)));
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

  const applyFrequent = (f: FrequentFood) => {
    picked.current = f.food;
    setName(f.food);
    setQty(String(f.typicalQuantity));
    setUnit(f.unit);
    setExtraUnits([f.unit]);
    setSuggestions([]);
    setMsg(null);
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
      if (isOfflineError(e)) setMsg("The preview needs a connection. Say it to the coach instead and I'll queue it until you're back online.");
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
      const res = await logTool("log_food", {
        date,
        meal,
        source: "MANUAL",
        entries: [{
          food: est.name || name.trim(),
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
        }],
      });
      onSaved(res.queued);
      onClose();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      {frequent.length > 0 && (
        <section aria-label="Frequent foods">
          <p className="label">Frequent foods</p>
          <ul className="flex flex-wrap gap-2">
            {frequent.map((f) => (
              <li key={`${f.food}|${f.unit}`}>
                <button className="btn !min-h-[44px] !px-3" onClick={() => applyFrequent(f)}>{f.food} · {f.typicalQuantity} {f.unit}</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* A div, not a form: the Toggle switches are buttons and would submit it. */}
      <div className="space-y-3">
        <Field label="Food" htmlFor="af-name">
          <input id="af-name" className="input" value={name} onChange={(e) => { setName(e.target.value); picked.current = ""; }} onKeyDown={onEnter} autoComplete="off" placeholder="e.g. chicken curry, banana, roti" />
        </Field>
        <p className="sr-only" aria-live="polite">{suggestions.length ? `${suggestions.length} suggestions below` : ""}</p>
        {suggestions.length > 0 && (
          <ul aria-label="Food suggestions" className="divide-y divide-border rounded-xl border border-border">
            {suggestions.map((s) => (
              <li key={s.name}>
                <button type="button" className="flex min-h-[44px] w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-surface-2" onClick={() => pick(s)}>
                  <span className="min-w-0 break-words">{s.name}</span>
                  <span className="shrink-0 text-xs text-muted">{fmtNum(s.kcal)} kcal · {fmtNum(s.protein, 1)} g protein /100 g</span>
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
          <Field label="Meal" htmlFor="af-meal">
            <select id="af-meal" className="input" value={meal} onChange={(e) => setMeal(e.target.value as MealType)}>
              {MEAL_ORDER.map((m) => <option key={m} value={m}>{MEAL_LABEL[m]}</option>)}
            </select>
          </Field>
          <Field label="How it was made (optional)" htmlFor="af-prep">
            <input id="af-prep" className="input" list="af-preps" value={prep} onChange={(e) => setPrep(e.target.value)} placeholder="fried, grilled…" />
            <datalist id="af-preps">{PREPS.map((p) => <option key={p} value={p} />)}</datalist>
          </Field>
        </div>

        <div className="divide-y divide-border">
          <Toggle checked={boneIn} onChange={setBoneIn} label="Bone-in" description="Weight includes bones, so less of it is edible." />
          <Toggle checked={restaurant} onChange={setRestaurant} label="Restaurant" description="Restaurant portions and oil vary, so the range gets wider." />
          <Toggle checked={measured} onChange={setMeasured} label="I measured it" description="Weighed or read off a label, so the range gets narrower." />
        </div>

        <button className="btn w-full" onClick={() => void runPreview()} disabled={!name.trim() || !qtyOk || busy !== null}>
          {busy === "preview" ? <Spinner label="Estimating" /> : "Preview estimate"}
        </button>
      </div>

      <div aria-live="polite" className="space-y-3">
        {msg && <Notice tone="warn">{msg}</Notice>}
        {current && (
          <div className="space-y-3 rounded-xl border border-brand/30 bg-brand/5 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{current.estimate.quantity} {current.estimate.unit} {current.estimate.name}</p>
              <Badge tone={TONE[current.estimate.estimate.confidence]}>{CONF_LABEL[current.estimate.estimate.confidence]}</Badge>
            </div>
            <p>
              About <span className="text-xl font-semibold tabular-nums">{fmtNum(current.estimate.calories)}</span> kcal{" "}
              <span className="text-sm text-muted">(est. range {fmtNum(current.estimate.estimate.min)}–{fmtNum(current.estimate.estimate.max)})</span>
            </p>
            <p className="text-sm text-muted">
              Protein {fmtNum(current.estimate.protein, 1)} g · Carbs {fmtNum(current.estimate.carbs, 1)} g · Fat {fmtNum(current.estimate.fat, 1)} g · Fiber {fmtNum(current.estimate.fiber, 1)} g · Sodium {fmtNum(current.estimate.sodium)} mg
            </p>
            <p className="text-xs text-muted">Matched to “{current.match.name}”, counted as roughly {fmtNum(current.estimate.grams)} g.</p>
            {current.estimate.assumptions.length > 0 && (
              <div className="text-sm">
                <p className="font-medium">What I assumed</p>
                <ul className="list-disc pl-5 text-muted">{current.estimate.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul>
              </div>
            )}
            {current.estimate.estimate.sources.length > 0 && (
              <div className="text-sm">
                <p className="font-medium">What could move the number</p>
                <ul className="list-disc pl-5 text-muted">{current.estimate.estimate.sources.map((a, i) => <li key={i}>{a}</li>)}</ul>
              </div>
            )}
            <button className="btn btn-primary w-full" onClick={() => void log()} disabled={busy !== null}>
              {busy === "log" ? <Spinner label="Saving" /> : `Log it to ${MEAL_LABEL[meal]}`}
            </button>
          </div>
        )}
      </div>

      <BarcodeLog date={date} meal={meal} onSaved={(queued) => { onSaved(queued); onClose(); }} />
    </div>
  );
}

/** Manual add: autocomplete, preview the estimate with its range and assumptions, then log. Remounts on each open. */
export function AddFoodSheet({ open, onClose, date, defaultMeal, onSaved }: { open: boolean; onClose: () => void; date: string; defaultMeal: MealType; onSaved: (queued: boolean) => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Add food">
      <AddFoodForm date={date} defaultMeal={defaultMeal} onClose={onClose} onSaved={onSaved} />
    </Sheet>
  );
}
