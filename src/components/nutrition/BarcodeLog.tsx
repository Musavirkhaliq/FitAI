"use client";
import { useState } from "react";
import { Field, Notice, Spinner } from "@/components/ui";
import { api, isOfflineError, logTool } from "@/lib/client/api";
import { fmtNum } from "@/lib/client/format";
import type { MealType } from "@/lib/client/types";
import type { FoodRecord } from "@/lib/food/types";

/** Packaged food by barcode: per-100 g label data, so the estimate is HIGH confidence (±10% for rounding on labels). */
export function BarcodeLog({ date, meal, onSaved }: { date: string; meal: MealType; onSaved: (queued: boolean) => void }) {
  const [code, setCode] = useState("");
  const [food, setFood] = useState<FoodRecord | null>(null);
  const [grams, setGrams] = useState("100");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const lookup = async () => {
    if (!code.trim()) return;
    setBusy(true);
    setMsg(null);
    setFood(null);
    try {
      const r = await api<{ food: FoodRecord }>(`/api/foods?barcode=${encodeURIComponent(code.trim())}`);
      setFood(r.food);
    } catch (e) {
      setMsg(isOfflineError(e) ? "Barcode lookup needs a connection. You can still add it by name." : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const g = Number(grams.replace(",", "."));
  const valid = Number.isFinite(g) && g > 0;

  const log = async () => {
    if (!food || !valid) return;
    const k = g / 100;
    const r1 = (n: number) => Math.round(n * k * 10) / 10;
    const kcal = Math.round(food.kcal * k);
    const micros = Object.fromEntries(
      (["calcium", "iron", "potassium", "vitA", "vitC", "vitD", "vitB12", "folate"] as const).map((key) => [key, r1(food[key] ?? 0)]),
    );
    setBusy(true);
    setMsg(null);
    try {
      const res = await logTool("log_food", {
        date,
        meal,
        source: "MANUAL",
        entries: [{
          food: food.brand ? `${food.name} (${food.brand})` : food.name,
          foodItemId: food.id,
          quantity: g,
          unit: "g",
          grams: g,
          calories: kcal,
          protein: r1(food.protein),
          carbs: r1(food.carbs),
          fat: r1(food.fat),
          fiber: r1(food.fiber),
          sodium: Math.round(food.sodium * k),
          micros,
          confidence: "HIGH",
          estimateMin: Math.round(kcal * 0.9),
          estimateMax: Math.round(kcal * 1.1),
          assumptions: ["Nutrition per 100 g comes from the package barcode data."],
          uncertaintySources: ["Label values are rounded, so the real number can differ a little."],
        }],
      });
      onSaved(res.queued);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="rounded-xl border border-border p-3">
      <summary className="min-h-[44px] cursor-pointer py-2 text-sm font-medium">Packaged food? Look up a barcode</summary>
      <div className="space-y-3 pt-2">
        <form className="flex items-end gap-2" onSubmit={(ev) => { ev.preventDefault(); void lookup(); }}>
          <div className="flex-1">
            <Field label="Barcode number" htmlFor="bc-code">
              <input id="bc-code" className="input" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 8901234567890" />
            </Field>
          </div>
          <button className="btn shrink-0" disabled={busy || !code.trim()}>{busy && !food ? <Spinner label="Looking up" /> : "Look up"}</button>
        </form>
        <div aria-live="polite">{msg && <Notice tone="warn">{msg}</Notice>}</div>
        {food && (
          <div className="space-y-3">
            <div>
              <p className="font-medium">{food.name}{food.brand ? <span className="font-normal text-muted"> · {food.brand}</span> : null}</p>
              <p className="text-sm text-muted">Per 100 g: {fmtNum(food.kcal)} kcal · protein {fmtNum(food.protein, 1)} g · carbs {fmtNum(food.carbs, 1)} g · fat {fmtNum(food.fat, 1)} g</p>
            </div>
            <Field label="How many grams did you have?" htmlFor="bc-grams" hint={valid ? `About ${fmtNum(food.kcal * g / 100)} kcal (high confidence, est. ±10%).` : "Enter a number of grams."}>
              <input id="bc-grams" className="input" inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} />
            </Field>
            <button className="btn btn-primary w-full" onClick={() => void log()} disabled={busy || !valid}>Log {valid ? `${fmtNum(g)} g` : ""}</button>
          </div>
        )}
      </div>
    </details>
  );
}
