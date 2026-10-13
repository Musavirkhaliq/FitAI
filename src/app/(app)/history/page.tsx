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
    <div className="space-y-4">
      <PageHeader title="History" subtitle="Search, browse and export everything you've logged." />
      <SearchPanel index={1} />
      <DayBrowser units={units} index={2} />
      <ExportPanel index={3} />
      <ChatHistory index={4} />
    </div>
  );
}
