"use client";
import { Check, Plus, Undo2 } from "lucide-react";
import { useState } from "react";
import { Chip, haptic } from "@/components/ui";
import { ApiError, logTool, post, useApi } from "@/lib/client/api";

interface Frequent { food: string; unit: string; count: number; typicalQuantity: number; kcal: number; protein: number }
interface Estimate {
  name: string; foodItemId?: string; quantity: number; unit: string; grams: number; prep: string | null;
  calories: number; protein: number; carbs: number; fat: number; fiber: number; sodium: number; micros: Record<string, number>;
  estimate: { min: number; max: number; confidence: "HIGH" | "MEDIUM" | "LOW"; sources: string[] }; assumptions: string[];
}

const mealNow = () => {
  const h = new Date().getHours();
  return h < 11 ? "BREAKFAST" : h < 16 ? "LUNCH" : h < 21 ? "DINNER" : "SNACK";
};

/**
 * One-tap "log again" for the foods you eat most. Logging speed is the strongest retention lever in food tracking, so
 * the common case is a single tap: estimate with the usual portion, save, and offer Undo.
 */
export function QuickFoods({ date, onLogged }: { date: string; onLogged?: () => void }) {
  const { data } = useApi<{ foods: Frequent[] }>("/api/foods?frequent=1");
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string | null; label: string; queued: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const foods = (data?.foods ?? []).slice(0, 8);
  if (foods.length === 0 && !done) return null;

  const log = async (f: Frequent) => {
    setBusy(f.food);
    setError(null);
    try {
      const { estimate: e } = await post<{ estimate: Estimate }>("/api/foods", { name: f.food, quantity: f.typicalQuantity, unit: f.unit });
      const r = await logTool<{ ids: string[] }>("log_food", {
        date, meal: mealNow(), source: "MANUAL",
        entries: [{
          food: f.food, foodItemId: e.foodItemId, quantity: e.quantity, unit: e.unit, grams: e.grams, prep: e.prep,
          calories: e.calories, protein: e.protein, carbs: e.carbs, fat: e.fat, fiber: e.fiber, sodium: e.sodium, micros: e.micros,
          confidence: e.estimate.confidence, estimateMin: e.estimate.min, estimateMax: e.estimate.max, assumptions: e.assumptions, uncertaintySources: e.estimate.sources,
        }],
      });
      haptic("success");
      setDone({ id: r.queued ? null : r.result.ids[0], label: `${f.typicalQuantity} ${f.unit} ${f.food} · ~${Math.round(e.calories)} kcal`, queued: r.queued });
      onLogged?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "I couldn't log that. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const undo = async () => {
    if (!done?.id) return;
    await logTool("delete_entry", { kind: "food", id: done.id });
    setDone(null);
  };

  return (
    <section aria-label="Log again" className="rise">
      <h2 className="eyebrow mb-2">Log again · one tap</h2>
      <div className="-mx-4 overflow-x-auto px-4 scrollbar-none">
        <div className="flex w-max gap-2 pb-1">
          {foods.map((f) => (
            <Chip key={f.food + f.unit} onClick={() => void log(f)} disabled={busy !== null} aria-label={`Log ${f.typicalQuantity} ${f.unit} ${f.food} again`}>
              <Plus className="h-4 w-4 text-brand" aria-hidden /> {f.food}
              <span className="text-xs text-muted">{f.kcal} kcal</span>
            </Chip>
          ))}
        </div>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-bad">{error}</p>}
      {done && (
        <p role="status" className="pop mt-2 flex items-center gap-2 rounded-2xl bg-good/10 px-3.5 py-2.5 text-sm">
          <Check className="h-4 w-4 shrink-0 text-good" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{done.queued ? "Saved on this device, will sync: " : "Logged "}{done.label}</span>
          {done.id && <button className="inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2 font-semibold text-brand" onClick={undo}><Undo2 className="h-3.5 w-3.5" aria-hidden /> Undo</button>}
        </p>
      )}
    </section>
  );
}
