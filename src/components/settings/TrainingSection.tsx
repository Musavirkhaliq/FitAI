"use client";
import { useState } from "react";
import { Field } from "@/components/ui";
import type { ApiState } from "@/lib/client/api";
import { NumberField, SaveStatus, SectionCard, inRange, num, useSaver } from "./common";
import type { ProfileDto, ProfileResponse } from "./types";

const EXPERIENCE: { value: ProfileDto["experience"]; label: string }[] = [
  { value: "BEGINNER", label: "Beginner" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "ADVANCED", label: "Advanced" },
];
const EQUIPMENT = [
  { value: "FULL_GYM", label: "Full gym" },
  { value: "DUMBBELLS", label: "Dumbbells" },
  { value: "HOME", label: "Home basics" },
  { value: "BODYWEIGHT", label: "Bodyweight only" },
];

export function TrainingSection({ api, data }: { api: ApiState<ProfileResponse>; data: ProfileResponse }) {
  const { profile } = data;
  const saver = useSaver(api);
  const [experience, setExperience] = useState(profile.experience);
  const [days, setDays] = useState(profile.trainDaysPerWeek);
  const [minutes, setMinutes] = useState(String(profile.sessionMinutes));
  const [equipment, setEquipment] = useState(profile.equipment);
  const [injuries, setInjuries] = useState(profile.injuries ?? "");
  const [minutesError, setMinutesError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = inRange(minutes, 20, 180, true, "Session length");
    setMinutesError(err);
    if (err) return;
    await saver.save({ experience, trainDaysPerWeek: days, sessionMinutes: num(minutes) ?? profile.sessionMinutes, equipment, injuries: injuries.trim() || null });
  };

  return (
    <SectionCard id="training-h" title="Training" description="Changes apply to new workout plans. Ask your coach to rebuild your plan if you want them applied now.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Experience" htmlFor="t-exp">
            <select id="t-exp" className="input" value={experience} onChange={(e) => setExperience(e.target.value as ProfileDto["experience"])}>
              {EXPERIENCE.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Training days per week" htmlFor="t-days">
            <select id="t-days" className="input" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </Field>
          <NumberField id="t-min" label="Session length" unit="minutes" value={minutes} onChange={setMinutes} inputMode="numeric" error={minutesError} />
          <Field label="Equipment" htmlFor="t-eq">
            <select id="t-eq" className="input" value={equipment} onChange={(e) => setEquipment(e.target.value)}>
              {EQUIPMENT.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Injuries or limitations" htmlFor="t-inj" hint="Optional. I'll avoid exercises that could aggravate them.">
          <textarea id="t-inj" className="input min-h-[88px] py-2" rows={3} maxLength={300} value={injuries} onChange={(e) => setInjuries(e.target.value)} />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn btn-primary" disabled={saver.state === "saving"}>Save training</button>
          <SaveStatus saver={saver} />
        </div>
      </form>
    </SectionCard>
  );
}
