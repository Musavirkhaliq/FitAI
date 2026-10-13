"use client";
import { Lightbulb } from "lucide-react";
import { useState } from "react";
import { Badge, Notice, haptic } from "@/components/ui";
import { logTool } from "@/lib/client/api";
import { fmtNum } from "@/lib/client/format";
import type { CalorieAdviceDto } from "@/lib/client/types";

const ACTION_LABEL: Record<CalorieAdviceDto["action"], string> = {
  WAIT: "Not yet",
  KEEP: "Keep target",
  DECREASE: "Small trim",
  INCREASE: "Small increase",
  RECHECK_TDEE: "Re-check maintenance",
};

const OFFERS: CalorieAdviceDto["action"][] = ["DECREASE", "INCREASE", "RECHECK_TDEE"];
const ADJUSTED_KEY = "fittrack:calorieAdjustedAt";
const COOLDOWN_DAYS = 7;

const recentlyAdjusted = (): boolean => {
  try {
    const t = Number(window.localStorage.getItem(ADJUSTED_KEY));
    return t > 0 && Date.now() - t < COOLDOWN_DAYS * 86_400_000;
  } catch {
    return false;
  }
};

const WASH = "linear-gradient(150deg, rgb(var(--brand-a) / 0.12), rgb(var(--brand-b) / 0.05) 60%), rgb(var(--surface))";

/**
 * Calorie-target suggestion. A suggestion only: the API already waits for ~14 days of data; we render its
 * reason and offer a one-tap change that the user chooses to make. After a change we pause the offer for a
 * week so the new target gets a fair test (the weight trend can't reflect it sooner).
 */
export function CalorieAdviceCard({ advice, onApplied }: { advice: CalorieAdviceDto | null; onApplied?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cooling] = useState(() => (typeof window === "undefined" ? false : recentlyAdjusted()));

  if (!advice) {
    return (
      <section className="tile rise" aria-labelledby="adv-h">
        <h2 id="adv-h" className="flex items-center gap-2 text-sm font-bold">
          <Lightbulb className="h-4 w-4 text-muted" aria-hidden /> Calorie target suggestion
        </h2>
        <p className="mt-2 text-sm text-muted">Set a goal and keep weighing in. After about 14 days I can suggest small tweaks to your calorie target.</p>
      </section>
    );
  }

  const canOffer = OFFERS.includes(advice.action) && !advice.blockedByFloor && advice.deltaKcal !== 0;
  const apply = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await logTool("update_goal", { calorieTarget: advice.suggestedTarget });
      setDone(advice.suggestedTarget);
      haptic("success");
      try {
        window.localStorage.setItem(ADJUSTED_KEY, String(Date.now()));
      } catch {
        /* storage unavailable: the offer simply isn't paused */
      }
      if (r.queued) setErr("You're offline. The change is queued and will apply when you reconnect.");
      onApplied?.();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="tile rise space-y-3.5" aria-labelledby="adv-h" style={{ background: WASH }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="adv-h" className="flex items-center gap-2 text-sm font-bold">
          <span className="grad-brand flex h-7 w-7 items-center justify-center rounded-full text-brand-fg"><Lightbulb className="h-4 w-4" aria-hidden /></span>
          Calorie target suggestion
        </h2>
        <Badge tone={advice.action === "KEEP" ? "good" : "neutral"}>{ACTION_LABEL[advice.action]}</Badge>
      </div>
      <p className="text-[0.95rem] leading-relaxed">{advice.reason}</p>

      {done != null ? (
        <Notice tone="good">Target set to {fmtNum(done)} kcal. Give it a week or two before judging it; the trend needs time to show.</Notice>
      ) : canOffer ? (
        cooling ? (
          <p className="text-sm text-muted">You changed your target recently. Let the trend catch up for a week or so before adjusting again.</p>
        ) : (
          <div className="space-y-2">
            <button className="btn btn-primary w-full" onClick={() => void apply()} disabled={busy}>
              {busy ? "Setting…" : `Set target to ${fmtNum(advice.suggestedTarget)} kcal`}
            </button>
            <p className="text-center text-xs text-muted">{advice.deltaKcal > 0 ? "+" : "−"}{fmtNum(Math.abs(advice.deltaKcal))} kcal/day. Your call, not required.</p>
          </div>
        )
      ) : null}
      <div aria-live="polite">{err && <Notice tone="warn">{err}</Notice>}</div>
      <p className="text-xs text-muted">A suggestion based on your weight trend and logging, not medical advice. Energy numbers are estimates. If you have a health condition, check changes with a professional.</p>
    </section>
  );
}
