"use client";
import { ChatHistory } from "@/components/history/ChatHistory";
import { DayBrowser } from "@/components/history/DayBrowser";
import { ExportPanel } from "@/components/history/ExportPanel";
import { SearchPanel } from "@/components/history/SearchPanel";
import { PageHeader } from "@/components/ui";
import { useApi } from "@/lib/client/api";
import type { TodayDto } from "@/lib/client/types";

export default function HistoryPage() {
  const today = useApi<TodayDto>("/api/today"); // only for the unit preference; usually already cached
  const units = today.data?.profile.unitSystem ?? "METRIC";

  return (
    <div className="space-y-5">
      <PageHeader title="History" subtitle="Search, browse and export everything you've logged." />
      <SearchPanel />
      <DayBrowser units={units} />
      <ExportPanel />
      <ChatHistory />
    </div>
  );
}
