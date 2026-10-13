"use client";
import { DataSection } from "@/components/settings/DataSection";
import { FoodSection } from "@/components/settings/FoodSection";
import { GoalsSection } from "@/components/settings/GoalsSection";
import { ProfileSection } from "@/components/settings/ProfileSection";
import { TrainingSection } from "@/components/settings/TrainingSection";
import { RemindersSection, VoiceSection } from "@/components/settings/VoiceReminderSections";
import type { ProfileResponse } from "@/components/settings/types";
import { ErrorState, LoadingBlock, Notice, PageHeader } from "@/components/ui";
import { useApi } from "@/lib/client/api";

export default function SettingsPage() {
  const api = useApi<ProfileResponse>("/api/profile");
  const { data, error, loading, refresh } = api;

  if (loading && !data) return <LoadingBlock label="Loading settings" rows={4} />;
  if (!data) return <ErrorState message={error ?? "I couldn't load your settings. Check your connection."} onRetry={() => void refresh()} />;

  const who = data.user?.name?.trim() || data.user?.email || "";
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Settings" subtitle="Changes save to your account. Everything here is your call." />
      {error && <Notice tone="warn">{error}</Notice>}

      {data.user && (
        <div className="rise flex items-center gap-4 rounded-[1.5rem] border border-border bg-surface p-4 shadow-tile" style={{ ["--i" as string]: 0 }}>
          <span aria-hidden className="grad-brand flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-extrabold text-brand-fg" style={{ boxShadow: "var(--glow)" }}>
            {who.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="display truncate text-lg font-extrabold">{data.user.name?.trim() || "Your account"}</p>
            <p className="truncate text-sm text-muted">{data.user.email}</p>
          </div>
        </div>
      )}

      <ProfileSection api={api} data={data} index={1} />
      <GoalsSection api={api} data={data} index={2} />
      <TrainingSection api={api} data={data} index={3} />
      <FoodSection api={api} data={data} index={4} />
      <VoiceSection api={api} data={data} index={5} />
      <RemindersSection api={api} data={data} index={6} />
      <DataSection index={7} />
    </div>
  );
}
