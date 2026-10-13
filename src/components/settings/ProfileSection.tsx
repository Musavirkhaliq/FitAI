"use client";
import { Activity, Cake, Globe, Ruler, User, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Field, Segmented, Sheet } from "@/components/ui";
import type { UnitSystem } from "@/lib/client/format";
import { Group, GroupBody, NumberField, Row, SaveStatus, inRange, num, useSaver } from "./common";
import type { ProfilePatch, ProfileResponse } from "./types";
import type { ApiState } from "@/lib/client/api";

export const ACTIVITY_LEVELS = [
  { value: 1.2, label: "Mostly sitting (desk job, little walking)" },
  { value: 1.375, label: "Lightly active (on your feet some of the day)" },
  { value: 1.55, label: "Moderately active (moving most of the day)" },
  { value: 1.725, label: "Very active (physical work or lots of walking)" },
];

const nearestActivity = (m: number) => ACTIVITY_LEVELS.reduce((best, o) => (Math.abs(o.value - m) < Math.abs(best.value - m) ? o : best)).value;

function timeZones(current: string): string[] {
  const fn = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
  const list = fn ? fn("timeZone") : [];
  const all = new Set([...list, "UTC", current]);
  return [...all].sort();
}

const cmToFtIn = (cm: number) => {
  const totalIn = cm / 2.54;
  let ft = Math.floor(totalIn / 12);
  let inch = Math.round((totalIn - ft * 12) * 10) / 10;
  if (inch >= 12) {
    ft += 1;
    inch = 0;
  }
  return { ft: String(ft), inch: String(inch) };
};

export function ProfileSection({ api, data, index = 0 }: { api: ApiState<ProfileResponse>; data: ProfileResponse; index?: number }) {
  const { profile } = data;
  const saver = useSaver(api);
  const units = profile.unitSystem;
  const zones = useMemo(() => timeZones(profile.timezone), [profile.timezone]);

  const [open, setOpen] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [name, setName] = useState(data.user?.name ?? "");
  const [sex, setSex] = useState<string>(profile.sex ?? "");
  const [birthYear, setBirthYear] = useState(profile.birthYear != null ? String(profile.birthYear) : "");
  const [cm, setCm] = useState(profile.heightCm != null ? String(Math.round(profile.heightCm * 10) / 10) : "");
  const [ft, setFt] = useState(profile.heightCm != null ? cmToFtIn(profile.heightCm).ft : "");
  const [inch, setInch] = useState(profile.heightCm != null ? cmToFtIn(profile.heightCm).inch : "");
  const [tz, setTz] = useState(profile.timezone);
  const [activity, setActivity] = useState(nearestActivity(profile.activityLevel));
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const maxYear = new Date().getFullYear() - 13;

  // Opening the sheet always starts from what is saved, so a cancelled edit never lingers.
  const openSheet = (field: string) => {
    setName(data.user?.name ?? "");
    setSex(profile.sex ?? "");
    setBirthYear(profile.birthYear != null ? String(profile.birthYear) : "");
    setCm(profile.heightCm != null ? String(Math.round(profile.heightCm * 10) / 10) : "");
    setFt(profile.heightCm != null ? cmToFtIn(profile.heightCm).ft : "");
    setInch(profile.heightCm != null ? cmToFtIn(profile.heightCm).inch : "");
    setTz(profile.timezone);
    setActivity(nearestActivity(profile.activityLevel));
    setErrors({});
    setFocusId(field);
    setOpen(true);
  };
  const close = useCallback(() => setOpen(false), []);
  useEffect(() => {
    if (open && focusId) document.getElementById(focusId)?.focus();
  }, [open, focusId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string | null> = {};
    const body: ProfilePatch = {};

    body.name = name.trim();
    if (sex) body.sex = sex as "FEMALE" | "MALE";
    if (birthYear.trim()) {
      errs.birthYear = inRange(birthYear, 1920, maxYear, true, "Birth year");
      if (errs.birthYear == null) body.birthYear = num(birthYear);
    }
    if (units === "METRIC" ? cm.trim() : ft.trim()) {
      const heightCm = units === "METRIC" ? num(cm) : (num(ft) ?? NaN) * 30.48 + (inch.trim() ? num(inch) ?? NaN : 0) * 2.54;
      if (heightCm == null || Number.isNaN(heightCm) || heightCm < 100 || heightCm > 250) errs.height = "Height should be between 100 and 250 cm (about 3 ft 4 in to 8 ft 2 in).";
      else body.heightCm = Math.round(heightCm * 10) / 10;
    }
    if (tz) body.timezone = tz;
    body.activityLevel = activity;

    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    const saved = await saver.save(body);
    if (saved) setOpen(false);
  };

  const changeUnits = (u: UnitSystem) => {
    if (u === units) return;
    void saver.save({ unitSystem: u }, (p) => ({ ...p, profile: { ...p.profile, unitSystem: u } }));
  };

  const savedHeight = profile.heightCm == null ? "Not set" : units === "METRIC" ? `${Math.round(profile.heightCm * 10) / 10} cm` : `${cmToFtIn(profile.heightCm).ft} ft ${cmToFtIn(profile.heightCm).inch} in`;
  const savedActivity = ACTIVITY_LEVELS.find((o) => o.value === nearestActivity(profile.activityLevel))?.label.split(" (")[0];

  return (
    <div>
    <Group
      id="profile-h" title="Profile" index={index}
      description="Used for your starting estimates and the minimum safe calorie level."
      status={!open ? <SaveStatus saver={saver} /> : undefined}
    >
      <GroupBody className="py-3">
        <p className="label">Show weights and heights in</p>
        <div className="[&>div]:grid [&>div]:w-full">
          <Segmented<UnitSystem> label="Units" value={units} onChange={changeUnits} options={[{ value: "METRIC", label: "Metric (kg, cm)" }, { value: "IMPERIAL", label: "Imperial (lb, ft)" }]} />
        </div>
      </GroupBody>
      <Row icon={User} tint="brand" label="First name" value={data.user?.name || "Not set"} onClick={() => openSheet("set-name")} opens />
      <Row icon={UserRound} tint="protein" label="Sex" value={profile.sex === "FEMALE" ? "Female" : profile.sex === "MALE" ? "Male" : "Not set"} onClick={() => openSheet("set-sex")} opens />
      <Row icon={Cake} tint="cal" label="Birth year" value={profile.birthYear ?? "Not set"} onClick={() => openSheet("set-by")} opens />
      <Row icon={Ruler} tint="steps" label="Height" value={savedHeight} onClick={() => openSheet(units === "METRIC" ? "set-cm" : "set-ft")} opens />
      <Row icon={Globe} tint="sleep" label="Time zone" value={profile.timezone} onClick={() => openSheet("set-tz")} opens />
      <Row icon={Activity} tint="fiber" label="Typical daily activity" value={savedActivity} onClick={() => openSheet("set-act")} opens />

    </Group>

      <Sheet open={open} onClose={close} title="Edit profile">
        {/* Remount when units change so the height fields re-derive from the saved value. */}
        <form key={units} onSubmit={submit} className="space-y-4" noValidate>
          <Field label="First name" htmlFor="set-name"><input id="set-name" className="input" autoComplete="given-name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Sex" htmlFor="set-sex" hint="Used for the calorie floor and the energy formulas.">
            <select id="set-sex" className="input" value={sex} onChange={(e) => setSex(e.target.value)}>
              {!profile.sex && <option value="">Not set</option>}
              <option value="FEMALE">Female</option>
              <option value="MALE">Male</option>
            </select>
          </Field>
          <NumberField id="set-by" label="Birth year" value={birthYear} onChange={setBirthYear} inputMode="numeric" error={errors.birthYear} />
          {units === "METRIC" ? (
            <NumberField id="set-cm" label="Height" unit="cm" value={cm} onChange={setCm} error={errors.height} />
          ) : (
            <div>
              <div className="grid grid-cols-2 gap-2">
                <NumberField id="set-ft" label="Height (feet)" unit="ft" value={ft} onChange={setFt} inputMode="numeric" />
                <NumberField id="set-in" label="Height (inches)" unit="in" value={inch} onChange={setInch} />
              </div>
              {errors.height && <p role="alert" className="mt-1 text-sm text-bad">{errors.height}</p>}
            </div>
          )}
          <Field label="Time zone" htmlFor="set-tz" hint="Decides when your day starts and ends.">
            <select id="set-tz" className="input" value={tz} onChange={(e) => setTz(e.target.value)}>
              {zones.map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
          </Field>
          <Field label="Typical daily activity" htmlFor="set-act" hint="Outside of workouts.">
            <select id="set-act" className="input" value={activity} onChange={(e) => setActivity(Number(e.target.value))}>
              {ACTIVITY_LEVELS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <div className="space-y-2 pt-1">
            <button className="btn btn-primary w-full !min-h-[52px] !text-base" disabled={saver.state === "saving"}>Save profile</button>
            <SaveStatus saver={saver} />
          </div>
        </form>
      </Sheet>
    </div>
  );
}
