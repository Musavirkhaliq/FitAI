"use client";
import { X } from "lucide-react";
import { useState } from "react";
import { Field, Toggle } from "@/components/ui";
import type { ApiState } from "@/lib/client/api";
import { SaveStatus, SectionCard, useSaver } from "./common";
import type { ProfileResponse } from "./types";

const EXAMPLES = ["Pork", "Shellfish", "Dairy", "Gluten", "Nuts", "Eggs"];

export function FoodSection({ api, data }: { api: ApiState<ProfileResponse>; data: ProfileResponse }) {
  const { profile } = data;
  const saver = useSaver(api);
  const [draft, setDraft] = useState("");
  const [tagError, setTagError] = useState<string | null>(null);
  const foods = profile.foodsAvoided;

  const saveFoods = (next: string[]) =>
    saver.save({ foodsAvoided: next }, (p) => ({ ...p, profile: { ...p.profile, foodsAvoided: next } }));

  const add = (raw: string) => {
    const incoming = raw.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    if (!incoming.length) return;
    if (incoming.some((f) => f.length > 40)) return setTagError("Each food should be 40 characters or fewer.");
    const next = [...foods];
    for (const f of incoming) if (!next.some((x) => x.toLowerCase() === f.toLowerCase())) next.push(f);
    if (next.length > 30) return setTagError("That's the maximum of 30 foods.");
    setTagError(null);
    setDraft("");
    void saveFoods(next);
  };

  return (
    <SectionCard id="food-h" title="Food" description="I won't suggest foods you avoid, and I'll keep your meal structure in mind.">
      <div>
        <Field label="Foods you avoid" htmlFor="f-add" hint="Type a food and press Enter, or separate several with commas.">
          <div className="flex gap-2">
            <input
              id="f-add" className="input" value={draft} maxLength={80} onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(draft); } }}
              aria-invalid={tagError ? true : undefined} aria-describedby={tagError ? "f-err" : undefined}
            />
            <button type="button" className="btn" onClick={() => add(draft)} disabled={!draft.trim()}>Add</button>
          </div>
        </Field>
        {tagError && <p id="f-err" role="alert" className="mt-1 text-sm text-bad">{tagError}</p>}
        {foods.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Foods you avoid">
            {foods.map((f) => (
              <li key={f} className="inline-flex items-center gap-1 rounded-full bg-surface-2 py-1 pl-3 pr-1 text-sm">
                {f}
                <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-border" aria-label={`Remove ${f}`} onClick={() => void saveFoods(foods.filter((x) => x !== f))}>
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">Nothing listed. Common ones:</p>
        )}
        {foods.length === 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {EXAMPLES.map((f) => <button key={f} type="button" className="btn !min-h-[40px] rounded-full" onClick={() => add(f)}>{f}</button>)}
          </div>
        )}
      </div>

      <Field label="Meals per day" htmlFor="f-meals">
        <select
          id="f-meals" className="input sm:max-w-[160px]" value={profile.mealsPerDay}
          onChange={(e) => { const n = Number(e.target.value); void saver.save({ mealsPerDay: n }, (p) => ({ ...p, profile: { ...p.profile, mealsPerDay: n } })); }}
        >
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </Field>

      <Toggle
        label="Use conservative calorie estimates" checked={profile.conservativeEstimates}
        description="When a food's calories are uncertain, I'll lean towards the higher end. Good if you tend to under-estimate portions."
        onChange={(v) => void saver.save({ conservativeEstimates: v }, (p) => ({ ...p, profile: { ...p.profile, conservativeEstimates: v } }))}
      />
      <SaveStatus saver={saver} />
    </SectionCard>
  );
}
