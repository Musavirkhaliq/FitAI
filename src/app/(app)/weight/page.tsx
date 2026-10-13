"use client";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { BodyComposition } from "@/components/weight/BodyComposition";
import { CalorieAdviceCard } from "@/components/weight/CalorieAdviceCard";
import { Stat } from "@/components/weight/Stat";
import { STATUS_TONE } from "@/components/weight/trend";
import type { MeasurementDto, WeightDto } from "@/components/weight/types";
import { WeighInForm, type WeighInSaved } from "@/components/weight/WeighInForm";
import { WeighInList } from "@/components/weight/WeighInList";
import { WeightChart } from "@/components/weight/WeightChart";
import { Badge, EmptyState, ErrorState, LoadingBlock, Notice, PageHeader, Segmented } from "@/components/ui";
import { logTool, useApi } from "@/lib/client/api";
import { fmtDay, fmtDelta, fmtNum, fmtWeight, STATUS_LABEL } from "@/lib/client/format";
import type { TodayDto } from "@/lib/client/types";

type Range = "30" | "90" | "180" | "365";
const RANGES: { value: Range; label: string }[] = [
  { value: "30", label: "30 d" },
  { value: "90", label: "90 d" },
  { value: "180", label: "180 d" },
  { value: "365", label: "1 yr" },
];

export default function WeightPage() {
  const [range, setRange] = useState<Range>("90");
  const { data, error, loading, refresh, setData } = useApi<WeightDto>(`/api/weight?days=${range}`);
  const today = useApi<TodayDto>("/api/today");
  const [tipOpen, setTipOpen] = useState(false);

  const units = today.data?.profile.unitSystem ?? "METRIC";
  const sex = today.data?.profile.sex ?? null;

  // Optimistic: show the new row at once; the quiet refetch after logTool replaces it with the real one.
  const onSaved = (w: WeighInSaved) =>
    setData((prev) => {
      if (!prev) return prev;
      const row = { id: `tmp-${w.date}`, date: w.date, weightKg: w.weightKg, time: w.time, conditions: w.conditions };
      const rest = prev.entries.filter((e) => e.date !== w.date);
      return { ...prev, entries: [...rest, row].sort((a, b) => (a.date < b.date ? 1 : -1)) };
    });

  const removeEntry = async (id: string) => {
    setData((prev) => prev && { ...prev, entries: prev.entries.filter((e) => e.id !== id) });
    try {
      await logTool("delete_entry", { kind: "weight", id });
    } catch (e) {
      void refresh();
      throw e;
    }
  };

  const onMeasured = (m: Omit<MeasurementDto, "id" | "notes">) =>
    setData((prev) => prev && { ...prev, measurements: [...prev.measurements, { ...m, id: `tmp-${Date.now()}`, notes: null }].sort((a, b) => (a.date < b.date ? -1 : 1)) });

  const removeMeasurement = async (id: string) => {
    setData((prev) => prev && { ...prev, measurements: prev.measurements.filter((m) => m.id !== id) });
    try {
      await logTool("delete_entry", { kind: "measurement", id });
    } catch (e) {
      void refresh();
      throw e;
    }
  };

  const header = (
    <PageHeader
      title="Weight"
      subtitle="Lead with the averages. A single weigh-in moves with water, salt and sleep, so one day rarely means much."
      actions={<Segmented<Range> label="Chart range" value={range} onChange={setRange} options={RANGES} />}
    />
  );

  if (loading && !data) {
    return (
      <div>
        {header}
        <LoadingBlock label="Loading weight" rows={4} />
      </div>
    );
  }
  if (!data) {
    return (
      <div>
        {header}
        <ErrorState message={error ?? "I couldn't load your weight data. Check your connection."} onRetry={() => void refresh()} />
      </div>
    );
  }

  const { trend } = data;
  const days = Number(range);
  const targetKg = data.targetWeightKg;
  const toTarget = targetKg != null && trend.ma7 != null ? targetKg - trend.ma7 : null;
  const hasData = data.series.length > 0;

  return (
    <div className="space-y-5">
      {header}
      {error && <Notice tone="warn">{error}</Notice>}

      {/* Trend verdict first, then the numbers behind it */}
      <section className="card space-y-2" aria-labelledby="trend-h">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="trend-h" className="text-sm font-semibold">Trend</h2>
          <Badge tone={STATUS_TONE[trend.status]}>{STATUS_LABEL[trend.status]}</Badge>
        </div>
        <p>{trend.note}</p>
        <p className="text-xs text-muted">The verdict uses the last 14 days and needs at least 5 weigh-ins spread over 10+ days, so one or two odd readings never change it.</p>
      </section>

      <section aria-label="Weight numbers" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="7-day average" value={fmtWeight(trend.ma7, units)} sub="Mean of the last 7 days" />
        <Stat label="14-day average" value={fmtWeight(trend.ma14, units)} sub="Mean of the last 14 days" />
        <Stat label="30-day trend" value={fmtDelta(trend.monthlyChangeKg, units)} sub="Fitted change over 30 days" />
        <Stat
          label="Weekly rate"
          value={trend.weeklyRateKg == null ? "—" : `${fmtDelta(trend.weeklyRateKg, units, 2)}/wk`}
          sub={trend.weeklyRatePct == null ? "Needs 5+ weigh-ins over 10+ days" : `${fmtNum(Math.abs(trend.weeklyRatePct), 2)}% of body weight ${trend.weeklyRatePct < 0 ? "lost" : "gained"} per week`}
        />
        <Stat label="Latest weigh-in" value={fmtWeight(trend.latest?.weightKg, units)} sub={trend.latest ? fmtDay(trend.latest.date) : "Nothing logged yet"} />
        <Stat label="Vs yesterday" value={fmtDelta(trend.changeFromYesterdayKg, units)} sub="One day; mostly water" />
        <Stat label="From start" value={fmtDelta(trend.changeFromStartKg, units)} sub={data.startWeightKg != null ? `Started at ${fmtWeight(data.startWeightKg, units)}` : undefined} />
        <Stat
          label="Target"
          value={fmtWeight(targetKg, units)}
          sub={toTarget == null ? (targetKg == null ? "Not set" : undefined) : `${fmtDelta(toTarget, units)} from your 7-day average`}
        />
      </section>

      {hasData && data.series.length >= 2 ? (
        <WeightChart series={data.series} units={units} targetKg={targetKg} days={days} />
      ) : (
        <EmptyState title={hasData ? "One weigh-in so far" : "No weigh-ins yet"} body="Log a few morning weigh-ins and the chart and averages will appear here." />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <WeighInForm units={units} onSaved={onSaved} />
          <section className="card !p-0" aria-label="Weigh-in tip">
            <button
              className="flex min-h-[44px] w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm font-medium"
              aria-expanded={tipOpen}
              aria-controls="protocol-tip"
              onClick={() => setTipOpen((o) => !o)}
            >
              How to weigh in for steadier numbers
              <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${tipOpen ? "rotate-180" : ""}`} aria-hidden />
            </button>
            <div id="protocol-tip" hidden={!tipOpen} className="px-4 pb-4 text-sm text-muted">
              <p>{data.protocol}</p>
              <ul className="mt-2 list-disc space-y-0.5 pl-5">
                <li>After waking and after the bathroom</li>
                <li>Before food or drink</li>
                <li>Same scale, same spot</li>
                <li>Similar clothing</li>
              </ul>
            </div>
          </section>
        </div>
        <CalorieAdviceCard advice={data.calorieAdvice} />
      </div>

      <WeighInList entries={data.entries} units={units} onRemove={removeEntry} />

      <BodyComposition data={data} units={units} sex={sex} onAdded={onMeasured} onRemove={removeMeasurement} />
    </div>
  );
}
