"use client";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { useCoach } from "@/components/coach/CoachProvider";
import { Toggle } from "@/components/ui";
import type { ApiState } from "@/lib/client/api";
import { Group, GroupBody, IconTile, SaveStatus, useSaver } from "./common";
import type { ProfileResponse, ReminderKey } from "./types";

export function VoiceSection({ api, data, index = 0 }: { api: ApiState<ProfileResponse>; data: ProfileResponse; index?: number }) {
  const saver = useSaver(api);
  const { setTtsOn } = useCoach();
  const on = data.profile.ttsEnabled;

  const change = (v: boolean) => {
    // Apply to the live voice layer right away (it also mirrors the choice to localStorage), then persist to the profile.
    setTtsOn(v);
    void saver.save({ ttsEnabled: v }, (p) => ({ ...p, profile: { ...p.profile, ttsEnabled: v } }));
  };

  return (
    <Group id="voice-h" title="Voice" index={index} status={<SaveStatus saver={saver} />}>
      <GroupBody>
        <Toggle label="Read replies aloud" checked={on} onChange={change} description="Your coach speaks its answers. You can always read them on screen, and you can interrupt at any time." />
      </GroupBody>
    </Group>
  );
}

const REMINDERS: { key: ReminderKey; label: string; description: string }[] = [
  { key: "weighIn", label: "Morning weigh-in", description: "A nudge in the morning if you haven't weighed in yet." },
  { key: "workout", label: "Workout time", description: "In the afternoon or evening on days you have a workout planned." },
  { key: "protein", label: "Protein check", description: "Early evening, if you're well short of your protein target." },
  { key: "steps", label: "Steps", description: "Early evening, if you're less than halfway to your step target." },
  { key: "sleep", label: "Wind down", description: "A gentle reminder to start winding down for bed." },
  { key: "weeklyReview", label: "Weekly review", description: "Sunday evening: a prompt to look at how your week went." },
];

type Permission = NotificationPermission | "unsupported";

export function RemindersSection({ api, data, index = 0 }: { api: ApiState<ProfileResponse>; data: ProfileResponse; index?: number }) {
  const saver = useSaver(api);
  const [permission, setPermission] = useState<Permission>("default");
  const [permError, setPermError] = useState<string | null>(null);
  const reminders = data.profile.reminders ?? {};

  useEffect(() => {
    setPermission(typeof Notification === "undefined" ? "unsupported" : Notification.permission);
  }, []);

  const askPermission = async () => {
    setPermError(null);
    try {
      setPermission(await Notification.requestPermission());
    } catch {
      setPermError("Your browser couldn't show the permission prompt. You can still see reminders inside the app.");
    }
  };

  return (
    <Group
      id="rem-h" title="Reminders" index={index}
      description="Reminders appear inside the app. Each one can be switched off on its own, and none of them is required."
      status={<SaveStatus saver={saver} />}
    >
      {REMINDERS.map((r) => {
        const on = reminders[r.key] ?? true;
        return (
          <GroupBody key={r.key}>
            <Toggle
              label={r.label} description={r.description} checked={on}
              onChange={(v) => void saver.save({ reminders: { [r.key]: v } }, (p) => ({ ...p, profile: { ...p.profile, reminders: { ...p.profile.reminders, [r.key]: v } } }))}
            />
          </GroupBody>
        );
      })}

      <GroupBody className="py-3">
        <div className="flex items-start gap-3">
          <IconTile icon={Bell} tint="sleep" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Browser notifications (optional)</p>
            <p className="mt-1 text-sm text-muted">If you allow them, reminders can also pop up outside the app while it&apos;s open in your browser. Skip this if you prefer to see reminders in the app only.</p>
            <div aria-live="polite" className="mt-2 text-sm">
              {permission === "granted" && <p className="text-good">Browser notifications are on.</p>}
              {permission === "denied" && <p className="text-muted">Notifications are blocked. To change that, open your browser&apos;s site settings for this page and allow notifications.</p>}
              {permission === "unsupported" && <p className="text-muted">This browser doesn&apos;t support notifications. Reminders will still show inside the app.</p>}
              {permError && <p role="alert" className="text-bad">{permError}</p>}
            </div>
            {permission === "default" && <button type="button" className="btn mt-2" onClick={() => void askPermission()}>Allow browser notifications</button>}
          </div>
        </div>
      </GroupBody>
    </Group>
  );
}
