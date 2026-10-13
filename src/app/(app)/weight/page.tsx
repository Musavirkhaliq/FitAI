"use client";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Check, ChevronDown, Hourglass, Minus, Scale, TrendingDown, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { BodyComposition } from "@/components/weight/BodyComposition";
import { CalorieAdviceCard } from "@/components/weight/CalorieAdviceCard";
import { Stat } from "@/components/weight/Stat";
import { STATUS_TONE, toDisplay, unitLabel } from "@/components/weight/trend";
import type { MeasurementDto, WeightDto } from "@/components/weight/types";
import { WeighInForm, type WeighInSaved } from "@/components/weight/WeighInForm";
import { WeighInList } from "@/components/weight/WeighInList";
import { WeightChart } from "@/components/weight/WeightChart";
import { AnimatedNumber, Badge, EmptyState, ErrorState, Notice, PageHeader, ProgressBar, Segmented, Sheet, Skeleton, Tile } from "@/components/ui";
import { logTool, useApi } from "@/lib/client/api";
import { fmtDay, fmtDelta, fmtNum, fmtWeight, STATUS_LABEL } from "@/lib/client/format";
import type { TodayDto, TrendStatus } from "@/lib/client/types";

type Range = "30" | "90" | "180" | "365";
const RANGES: { value: Range; label: string }[] = [
  { value: "30", label: "30 d" },
  { value: "90", label: "90 d" },
  { value: "180", label: "180 d" },
  { value: "365", label: "1 yr" },
];

const STATUS_ICON: Record<TrendStatus, ReactNode> = {
  FAST_LOSS: <TrendingDown className="mr-1 h-3.5 w-3.5" aria-hidden />,
  TARGET_LOSS: <Check className="mr-1 h-3.5 w-3.5" aria-hidden />,
  SLOW_LOSS: <TrendingDown className="mr-1 h-3.5 w-3.5" aria-hidden />,
  PLATEAU: <Minus className="mr-1 h-3.5 w-3.5" aria-hidden />,
  GAINING: <TrendingUp className="mr-1 h-3.5 w-3.5" aria-hidden />,
  INSUFFICIENT_DATA: <Hourglass className="mr-1 h-3.5 w-3.5" aria-hidden />,
};

const fmt1 = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function WeightSkeleton({ header }: { header: ReactNode }) {
  return (
    <div>
      {header}
      <div role="status" aria-live="polite" className="space-y-3">
        <span className="sr-only">Loading weight…</span>
        <Skeleton className="h-72" />
        <Skeleton className="h-80" />
        <div className="grid grid-cols-2 gap-3"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
      </div>
    </div>
  );
}

export default function WeightPage() {
  const [range, setRange] = useState<Range>("90");
  const { data, error, loading, refresh, setData } = useApi<WeightDto>(`/api/weight?days=${range}`);
  const today = useApi<TodayDto>("/api/today");
  const [tipOpen, setTipOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saved, setSaved] = useState<{ tone: "good" | "warn"; text: string } | null>(null);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const units = today.data?.profile.unitSystem ?? "METRIC";
  const sex = today.data?.profile.sex ?? null;

  // The "saved" note is a gentle confirmation, not something to keep on screen.
  useEffect(() => {
    if (!saved) return;
    const t = window.setTimeout(() => setSaved(null), 7000);
    return () => window.clearTimeout(t);
  }, [saved]);

  // Optimistic: show the new row at once; the quiet refetch after logTool replaces it with the real one.
  const onSaved = (w: WeighInSaved) => {
    setData((prev) => {
      if (!prev) return prev;
      const row = { id: `tmp-${w.date}`, date: w.date, weightKg: w.weightKg, time: w.time, conditions: w.conditions };
      const rest = prev.entries.filter((e) => e.date !== w.date);
      return { ...prev, entries: [...rest, row].sort((a, b) => (a.date < b.date ? 1 : -1)) };
    });
    setSaved(w.queued ? { tone: "warn", text: "You're offline. Your weigh-in is queued and will sync when you're back online." } : { tone: "good", text: "Weigh-in saved. One day is a data point; the averages tell the story." });
    setSheetOpen(false);
  };

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

  const header = <PageHeader title="Weight" subtitle="Averages lead. One weigh-in moves with water, salt and sleep, so a single day rarely means much." />;

  if (loading && !data) return <WeightSkeleton header={header} />;
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
  const unit = unitLabel(units);
  const targetKg = data.targetWeightKg;
  const startKg = data.startWeightKg;
  const toTarget = targetKg != null && trend.ma7 != null ? targetKg - trend.ma7 : null;
  const hasData = data.series.length > 0;
  const latestKg = trend.latest?.weightKg ?? null;
  const dy = trend.changeFromYesterdayKg;
  const DeltaIcon = dy == null ? ArrowRight : dy < -0.05 ? ArrowDownRight : dy > 0.05 ? ArrowUpRight : ArrowRight;
  // How far from the start weight to the target the 7-day average has travelled (0–100).
  const journey = startKg != null && targetKg != null && trend.ma7 != null && Math.abs(startKg - targetKg) > 0.5
    ? Math.max(0, Math.min(100, ((startKg - trend.ma7) / (startKg - targetKg)) * 100))
    : null;

  return (
    <div className="space-y-4">
      {header}
      {error && <Notice tone="warn">{error}</Notice>}
      <div aria-live="polite">{saved && <Notice tone={saved.tone}>{saved.text}</Notice>}</div>

      {/* Hero: the number, an honest verdict, the averages that matter */}
      <section aria-labelledby="hero-h">
        <Tile
          className="!p-5"
          style={{ background: "linear-gradient(155deg, rgb(var(--brand-a) / 0.14), rgb(var(--brand-b) / 0.05) 55%), rgb(var(--surface))" }}
        >
          <h2 id="hero-h" className="eyebrow">{trend.latest ? `Latest weigh-in · ${fmtDay(trend.latest.date)}` : "Latest weigh-in"}</h2>
          <p className="num mt-2 flex items-baseline gap-2 text-[3.5rem] leading-none">
            {latestKg == null ? "—" : <AnimatedNumber value={toDisplay(latestKg, units)} format={fmt1} fromZero />}
            {latestKg != null && <span className="text-base font-semibold text-muted">{unit}</span>}
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
            <DeltaIcon className="h-4 w-4" aria-hidden />
            {latestKg == null ? "Nothing logged yet" : dy == null ? "First weigh-in" : `${fmtDelta(dy, units)} vs yesterday (mostly water)`}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[trend.status]} className="!px-3 !py-1">{STATUS_ICON[trend.status]}{STATUS_LABEL[trend.status]}</Badge>
          </div>
          <p className="mt-2 text-[0.95rem] leading-relaxed">{trend.note}</p>

          <dl className="mt-4 flex flex-wrap gap-2">
            <div className="rounded-full bg-surface-2 px-3.5 py-1.5 text-sm"><dt className="inline text-muted">7-day avg </dt><dd className="inline font-bold">{fmtWeight(trend.ma7, units)}</dd></div>
            <div className="rounded-full bg-surface-2 px-3.5 py-1.5 text-sm"><dt className="inline text-muted">14-day avg </dt><dd className="inline font-bold">{fmtWeight(trend.ma14, units)}</dd></div>
          </dl>

          <button className="btn btn-primary mt-5 w-full !min-h-[52px] text-base" onClick={() => { setSaved(null); setSheetOpen(true); }}>
            <Scale className="h-5 w-5" aria-hidden /> Log a weigh-in
          </button>
          <p className="mt-3 text-xs text-muted">The verdict uses the last 14 days and needs at least 5 weigh-ins spread over 10+ days, so one or two odd readings never change it.</p>
        </Tile>
      </section>

      {/* Chart */}
      {hasData && data.series.length >= 2 ? (
        <WeightChart
          series={data.series} units={units} targetKg={targetKg} days={days}
          controls={<Segmented<Range> label="Chart range" value={range} onChange={setRange} options={RANGES} />}
        />
      ) : (
        <div className="space-y-3">
          <Segmented<Range> label="Chart range" value={range} onChange={setRange} options={RANGES} />
          <EmptyState title={hasData ? "One weigh-in so far" : "No weigh-ins yet"} body="Log a few morning weigh-ins and the chart and averages will appear here." />
        </div>
      )}

      {/* Stats bento */}
      <section aria-label="Weight numbers" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat index={1} label="30-day trend" value={fmtDelta(trend.monthlyChangeKg, units)} sub="Fitted change over 30 days" />
        <Stat
          index={2}
          label="Weekly rate"
          value={trend.weeklyRateKg == null ? "—" : `${fmtDelta(trend.weeklyRateKg, units, 2)}/wk`}
          sub={trend.weeklyRatePct == null ? "Needs 5+ weigh-ins over 10+ days" : `${fmtNum(Math.abs(trend.weeklyRatePct), 2)}% of body weight ${trend.weeklyRatePct < 0 ? "lost" : "gained"} per week`}
        />
        <Stat index={3} label="From start" value={fmtDelta(trend.changeFromStartKg, units)} sub={startKg != null ? `Started at ${fmtWeight(startKg, units)}` : undefined} />
        <Stat
          index={4}
          label="Target"
          value={fmtWeight(targetKg, units)}
          sub={toTarget == null ? (targetKg == null ? "Not set" : undefined) : `${fmtDelta(toTarget, units)} from your 7-day average`}
        >
          {journey != null && (
            <div className="mt-2.5">
              <ProgressBar value={journey} max={100} label={`Progress from start weight to target: ${Math.round(journey)}%`} />
            </div>
          )}
        </Stat>
      </section>

      {/* Protocol tip + calorie suggestion */}
      <div className="grid gap-3 lg:grid-cols-2">
        <section className="tile rise !p-0" aria-label="Weigh-in tip" style={{ ["--i" as string]: 5 }}>
          <button
            className="press flex min-h-[52px] w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold"
            aria-expanded={tipOpen}
            aria-controls="protocol-tip"
            onClick={() => setTipOpen((o) => !o)}
          >
            How to weigh in for steadier numbers
            <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-300 ${tipOpen ? "rotate-180" : ""}`} aria-hidden />
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
        <CalorieAdviceCard advice={data.calorieAdvice} />
      </div>

      <WeighInList entries={data.entries} units={units} onRemove={removeEntry} />

      <BodyComposition data={data} units={units} sex={sex} onAdded={onMeasured} onRemove={removeMeasurement} />

      <Sheet open={sheetOpen} onClose={closeSheet} title="Log a weigh-in">
        <WeighInForm units={units} onSaved={onSaved} />
      </Sheet>
    </div>
  );
}
