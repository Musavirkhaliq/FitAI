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

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Settings" subtitle="Changes save to your account. Everything here is your call." />
      {error && <Notice tone="warn">{error}</Notice>}
      <ProfileSection api={api} data={data} />
      <GoalsSection api={api} data={data} />
      <TrainingSection api={api} data={data} />
      <FoodSection api={api} data={data} />
      <VoiceSection api={api} data={data} />
      <RemindersSection api={api} data={data} />
      <DataSection />
    </div>
  );
}
