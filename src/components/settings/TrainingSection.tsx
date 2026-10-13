"use client";
import { CalendarDays, Dumbbell, HeartPulse, Timer, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Field, Sheet } from "@/components/ui";
import type { ApiState } from "@/lib/client/api";
import { Group, NumberField, Row, SaveStatus, inRange, num, useSaver } from "./common";
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

export function TrainingSection({ api, data, index = 0 }: { api: ApiState<ProfileResponse>; data: ProfileResponse; index?: number }) {
  const { profile } = data;
  const saver = useSaver(api);
  const [open, setOpen] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [experience, setExperience] = useState(profile.experience);
  const [days, setDays] = useState(profile.trainDaysPerWeek);
  const [minutes, setMinutes] = useState(String(profile.sessionMinutes));
  const [equipment, setEquipment] = useState(profile.equipment);
  const [injuries, setInjuries] = useState(profile.injuries ?? "");
  const [minutesError, setMinutesError] = useState<string | null>(null);

  const openSheet = (field: string) => {
    setExperience(profile.experience);
    setDays(profile.trainDaysPerWeek);
    setMinutes(String(profile.sessionMinutes));
    setEquipment(profile.equipment);
    setInjuries(profile.injuries ?? "");
    setMinutesError(null);
    setFocusId(field);
    setOpen(true);
  };
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    if (open && focusId) document.getElementById(focusId)?.focus();
  }, [open, focusId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = inRange(minutes, 20, 180, true, "Session length");
    setMinutesError(err);
    if (err) return;
    const saved = await saver.save({ experience, trainDaysPerWeek: days, sessionMinutes: num(minutes) ?? profile.sessionMinutes, equipment, injuries: injuries.trim() || null });
    if (saved) setOpen(false);
  };

  return (
    <div>
      <Group
        id="training-h" title="Training" index={index}
        description="Changes apply to new workout plans. Ask your coach to rebuild your plan if you want them applied now."
        status={!open ? <SaveStatus saver={saver} /> : undefined}
      >
        <Row icon={TrendingUp} tint="brand" label="Experience" value={EXPERIENCE.find((o) => o.value === profile.experience)?.label} onClick={() => openSheet("t-exp")} opens />
        <Row icon={CalendarDays} tint="protein" label="Training days per week" value={profile.trainDaysPerWeek} onClick={() => openSheet("t-days")} opens />
        <Row icon={Timer} tint="sleep" label="Session length" value={`${profile.sessionMinutes} minutes`} onClick={() => openSheet("t-min")} opens />
        <Row icon={Dumbbell} tint="cal" label="Equipment" value={EQUIPMENT.find((o) => o.value === profile.equipment)?.label ?? profile.equipment} onClick={() => openSheet("t-eq")} opens />
        <Row icon={HeartPulse} tint="neutral" label="Injuries or limitations" value={profile.injuries?.trim() || "None"} onClick={() => openSheet("t-inj")} opens />
      </Group>

      <Sheet open={open} onClose={close} title="Training">
        <form onSubmit={submit} className="space-y-4" noValidate>
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
          <Field label="Injuries or limitations" htmlFor="t-inj" hint="Optional. I'll avoid exercises that could aggravate them.">
            <textarea id="t-inj" className="input min-h-[88px] py-3" rows={3} maxLength={300} value={injuries} onChange={(e) => setInjuries(e.target.value)} />
          </Field>
          <div className="space-y-2 pt-1">
            <button className="btn btn-primary w-full !min-h-[52px] !text-base" disabled={saver.state === "saving"}>Save training</button>
            <SaveStatus saver={saver} />
          </div>
        </form>
      </Sheet>
    </div>
  );
}
