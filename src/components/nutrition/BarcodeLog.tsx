"use client";
import { Camera, ScanBarcode, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Field, Notice, Spinner, haptic } from "@/components/ui";
import { api, isOfflineError, logTool } from "@/lib/client/api";
import { fmtNum } from "@/lib/client/format";
import type { MealType } from "@/lib/client/types";
import type { FoodRecord } from "@/lib/food/types";
import type { SavedInfo } from "./dayMath";

interface DetectorLike { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> }
type DetectorCtor = new (opts?: { formats?: string[] }) => DetectorLike;
const detectorCtor = (): DetectorCtor | null =>
  typeof window === "undefined" ? null : (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector ?? null;

/** Live camera scan using the browser's BarcodeDetector (Chrome on Android and some desktops). Stops the camera on close or unmount. */
function Scanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const Ctor = detectorCtor();
    if (!Ctor) return;
    const detector = new Ctor({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
    let stream: MediaStream | null = null;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        const v = video.current;
        if (stopped || !v) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        v.srcObject = stream;
        await v.play();
        const tick = async () => {
          if (stopped) return;
          try {
            const found = await detector.detect(v);
            if (found[0]?.rawValue) {
              onCode(found[0].rawValue);
              return;
            }
          } catch {
            /* nothing readable yet: keep looking */
          }
          timer = setTimeout(() => void tick(), 350);
        };
        void tick();
      } catch {
        setErr("I couldn't open the camera. You can type the number instead.");
      }
    })();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onCode]);

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-2xl bg-surface-3">
        <video ref={video} className="aspect-[4/3] w-full object-cover" playsInline muted aria-label="Camera view for scanning a barcode" />
        <span aria-hidden className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-brand/80" />
        <button type="button" className="btn absolute right-2 top-2 !min-h-[48px] !w-12 !rounded-full !px-0" onClick={onClose} aria-label="Close camera">
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      {err ? <Notice tone="warn">{err}</Notice> : <p className="text-center text-xs text-muted">Hold the barcode inside the frame. It reads itself.</p>}
    </div>
  );
}

/** Packaged food by barcode: per-100 g label data, so the estimate is HIGH confidence (±10% for rounding on labels). */
export function BarcodeLog({ date, meal, onSaved }: { date: string; meal: MealType; onSaved: (info: SavedInfo) => void }) {
  const [code, setCode] = useState("");
  const [food, setFood] = useState<FoodRecord | null>(null);
  const [grams, setGrams] = useState("100");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [canScan, setCanScan] = useState(false);

  useEffect(() => {
    setCanScan(!!detectorCtor() && !!navigator.mediaDevices?.getUserMedia);
  }, []);

  const lookup = async (raw: string) => {
    const c = raw.trim();
    if (!c) return;
    setBusy(true);
    setMsg(null);
    setFood(null);
    try {
      const r = await api<{ food: FoodRecord }>(`/api/foods?barcode=${encodeURIComponent(c)}`);
      setFood(r.food);
    } catch (e) {
      setMsg(isOfflineError(e) ? "Barcode lookup needs a connection. You can still add it by name." : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const closeScan = useCallback(() => setScanning(false), []);
  const gotCode = useCallback((c: string) => {
    haptic("success");
    setScanning(false);
    setCode(c);
    void lookup(c);
  }, []);

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
    const name = food.brand ? `${food.name} (${food.brand})` : food.name;
    setBusy(true);
    setMsg(null);
    try {
      const res = await logTool<{ ids: string[] }>("log_food", {
        date,
        meal,
        source: "MANUAL",
        entries: [{
          food: name,
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
      haptic("success");
      onSaved({ queued: res.queued, label: `${fmtNum(g)} g ${name} · ~${fmtNum(kcal)} kcal`, undoId: res.queued ? null : res.result.ids[0] ?? null });
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Packaged food? Scan or type the number on the pack. Label data is per 100 g, so this one is a high-confidence estimate.</p>

      {scanning ? (
        <Scanner onCode={gotCode} onClose={closeScan} />
      ) : (
        canScan && (
          <button type="button" className="btn w-full" onClick={() => setScanning(true)}>
            <Camera className="h-5 w-5" aria-hidden /> Scan with camera
          </button>
        )
      )}

      <form className="flex items-end gap-2" onSubmit={(ev) => { ev.preventDefault(); void lookup(code); }}>
        <div className="flex-1">
          <Field label="Barcode number" htmlFor="bc-code">
            <input id="bc-code" className="input" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 8901234567890" />
          </Field>
        </div>
        <button className="btn btn-primary shrink-0" disabled={busy || !code.trim()}>
          {busy && !food ? <Spinner label="Looking up" /> : <ScanBarcode className="h-5 w-5" aria-hidden />} Look up
        </button>
      </form>

      <div aria-live="polite">{msg && <Notice tone="warn">{msg}</Notice>}</div>

      {food && (
        <div className="pop space-y-3 rounded-2xl bg-surface-2 p-4">
          <div>
            <p className="font-semibold">{food.name}{food.brand ? <span className="font-normal text-muted"> · {food.brand}</span> : null}</p>
            <p className="mt-0.5 text-sm text-muted">Per 100 g: {fmtNum(food.kcal)} kcal · protein {fmtNum(food.protein, 1)} g · carbs {fmtNum(food.carbs, 1)} g · fat {fmtNum(food.fat, 1)} g</p>
          </div>
          <Field label="How many grams did you have?" htmlFor="bc-grams" hint={valid ? `About ${fmtNum(food.kcal * g / 100)} kcal (high confidence, est. ±10%).` : "Enter a number of grams."}>
            <input id="bc-grams" className="input !bg-surface" inputMode="decimal" value={grams} onChange={(e) => setGrams(e.target.value)} />
          </Field>
          <button className="btn btn-primary w-full" onClick={() => void log()} disabled={busy || !valid}>Log {valid ? `${fmtNum(g)} g` : ""}</button>
        </div>
      )}
    </div>
  );
}
