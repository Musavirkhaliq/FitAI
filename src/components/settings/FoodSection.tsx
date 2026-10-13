"use client";
import { Ban, Utensils, X } from "lucide-react";
import { useCallback, useState } from "react";
import { Field, Sheet, Toggle } from "@/components/ui";
import type { ApiState } from "@/lib/client/api";
import { Group, GroupBody, Row, SaveStatus, SelectRow, useSaver } from "./common";
import type { ProfileResponse } from "./types";

const EXAMPLES = ["Pork", "Shellfish", "Dairy", "Gluten", "Nuts", "Eggs"];

export function FoodSection({ api, data, index = 0 }: { api: ApiState<ProfileResponse>; data: ProfileResponse; index?: number }) {
  const { profile } = data;
  const saver = useSaver(api);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [tagError, setTagError] = useState<string | null>(null);
  const foods = profile.foodsAvoided;
  const close = useCallback(() => setOpen(false), []);

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

  const summary = foods.length === 0 ? "None" : foods.length <= 2 ? foods.join(", ") : `${foods.slice(0, 2).join(", ")} +${foods.length - 2}`;

  return (
    <div>
      <Group
        id="food-h" title="Food" index={index}
        description="I won't suggest foods you avoid, and I'll keep your meal structure in mind."
        status={!open ? <SaveStatus saver={saver} /> : undefined}
      >
        <Row icon={Ban} tint="cal" label="Foods you avoid" value={summary} onClick={() => setOpen(true)} opens />
        <SelectRow
          icon={Utensils} tint="steps" label="Meals per day" id="f-meals" value={profile.mealsPerDay} display={profile.mealsPerDay}
          onChange={(v) => { const n = Number(v); void saver.save({ mealsPerDay: n }, (p) => ({ ...p, profile: { ...p.profile, mealsPerDay: n } })); }}
        >
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n}</option>)}
        </SelectRow>
        <GroupBody>
          <Toggle
            label="Use conservative calorie estimates" checked={profile.conservativeEstimates}
            description="When a food's calories are uncertain, I'll lean towards the higher end. Good if you tend to under-estimate portions."
            onChange={(v) => void saver.save({ conservativeEstimates: v }, (p) => ({ ...p, profile: { ...p.profile, conservativeEstimates: v } }))}
          />
        </GroupBody>
      </Group>

      <Sheet open={open} onClose={close} title="Foods you avoid">
        <div className="space-y-4">
          <Field label="Foods you avoid" htmlFor="f-add" hint="Type a food and press Enter, or separate several with commas.">
            <div className="flex gap-2">
              <input
                id="f-add" className="input" value={draft} maxLength={80} onChange={(e) => setDraft(e.target.value)} enterKeyHint="done"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(draft); } }}
                aria-invalid={tagError ? true : undefined} aria-describedby={tagError ? "f-err" : undefined}
              />
              <button type="button" className="btn btn-primary shrink-0" onClick={() => add(draft)} disabled={!draft.trim()}>Add</button>
            </div>
          </Field>
          {tagError && <p id="f-err" role="alert" className="text-sm text-bad">{tagError}</p>}
          {foods.length > 0 ? (
            <ul className="flex flex-wrap gap-2" aria-label="Foods you avoid">
              {foods.map((f) => (
                <li key={f} className="inline-flex min-h-[44px] items-center gap-1 rounded-full border border-border bg-surface-2 py-1 pl-4 pr-1 text-sm font-medium">
                  {f}
                  <button type="button" className="press flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-3" aria-label={`Remove ${f}`} onClick={() => void saveFoods(foods.filter((x) => x !== f))}>
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <>
              <p className="text-sm text-muted">Nothing listed. Common ones:</p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((f) => <button key={f} type="button" className="chip" onClick={() => add(f)}>{f}</button>)}
              </div>
            </>
          )}
          <SaveStatus saver={saver} />
          <button type="button" className="btn btn-primary w-full !min-h-[52px] !text-base" onClick={close}>Done</button>
        </div>
      </Sheet>
    </div>
  );
}
