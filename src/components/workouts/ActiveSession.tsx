"use client";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Mic, Plus, SkipForward, Square, Trophy, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { VoicePanel } from "@/components/coach/VoicePanel";
import { Badge, ErrorState, Notice, Spinner, clsx, haptic } from "@/components/ui";
import { ApiError, logTool, notifyChanged, post } from "@/lib/client/api";
import { fmtNum, type UnitSystem } from "@/lib/client/format";
import { BeatCard } from "./BeatCard";
import { ExerciseProgress, ProgressDots } from "./ExerciseProgress";
import { RestAnnouncer, RestOverlay, RestPill, useRestMuted, useRestTimer } from "./RestTimer";
import { SetLogger, type LoggedValues } from "./SetLogger";
import { SetsDone, type DoneSet } from "./SetsDone";
import { SessionSummary, type Summary } from "./SessionSummary";
import type { TodayWorkoutDto } from "./types";
import { MUSCLE_LABEL, muscleDot, toDisplay, unitLabel } from "./util";

interface Pending {
  key: string;
  name: string;
  setNumber: number;
  reps: number;
  weightKg: number;
  rpe: number;
  serverId?: string;
  queued?: boolean;
}

interface WorkoutCommand { type?: string; action?: string; seconds?: number }

const lc = (s: string) => s.toLowerCase();

/** Calm "new personal best" moment: a glow card, no confetti. */
function PrCard({ name }: { name: string }) {
  return (
    <div
      role="status"
      className="pop flex items-start gap-3 rounded-[1.5rem] border border-brand/40 p-4 shadow-glow"
      style={{ background: "linear-gradient(150deg, rgb(var(--brand-a) / 0.18), transparent 70%), rgb(var(--surface))" }}
    >
      <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-brand-fg" style={{ background: "var(--btn-bg)" }}><Trophy className="h-5 w-5" /></span>
      <div>
        <p className="display text-lg font-extrabold leading-tight">New personal best</p>
        <p className="mt-0.5 text-sm text-muted">{name}: your highest estimated 1RM yet. Well earned.</p>
      </div>
    </div>
  );
}

/**
 * The Start Workout screen (gym mode). Server sets (today.inProgress.sets) are the source of truth; sets logged here show up
 * optimistically as "pending" until the quiet refetch brings them back, so the coach's voice-logged sets and ours merge cleanly.
 */
export function ActiveSession({ today, units, date, onEngaged }: { today: TodayWorkoutDto; units: UnitSystem; date: string; onEngaged: () => void }) {
  const router = useRouter();
  const exercises = today.exercises;
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [extra, setExtra] = useState<Record<string, number>>({});
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Pending[]>([]);
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  const [pr, setPr] = useState<string | null>(null);
  const [prNames, setPrNames] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [logMsg, setLogMsg] = useState("");
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [restOpen, setRestOpen] = useState(false);
  const [muted, setMuted] = useRestMuted();
  const timer = useRestTimer(muted);
  const keyRef = useRef(0);
  const startedRef = useRef(false);

  // Idempotent: the API returns the already-open session if there is one.
  const startSession = useCallback(async () => {
    setStartError(null);
    try {
      const r = await post<{ session: { id: string } }>("/api/workouts", { action: "start" });
      setSessionId(r.session.id);
      onEngaged();
    } catch (e) {
      setStartError((e as Error).message);
    }
  }, [onEngaged]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void startSession();
  }, [startSession]);

  // ─── sets: server data + optimistic pending ──────────────────────────────────────────────────
  const serverSets = (today.inProgress?.sets ?? []).filter((s) => !deleted.has(s.id));
  const serverIds = new Set((today.inProgress?.sets ?? []).map((s) => s.id));
  const visiblePending = pending.filter((p) => {
    if (p.serverId && (serverIds.has(p.serverId) || deleted.has(p.serverId))) return false;
    // A set queued offline is replayed later and then also arrives from the server: don't show it twice.
    if (p.queued && serverSets.some((s) => lc(s.exerciseName) === lc(p.name) && s.setNumber === p.setNumber && s.reps === p.reps && s.weightKg === p.weightKg)) return false;
    return true;
  });

  const doneFor = (name: string): DoneSet[] => [
    ...serverSets.filter((s) => lc(s.exerciseName) === lc(name)).map((s) => ({ key: s.id, id: s.id, setNumber: s.setNumber, reps: s.reps, weightKg: s.weightKg, rpe: s.rpe })),
    ...visiblePending.filter((p) => lc(p.name) === lc(name)).map((p) => ({ key: p.key, id: p.serverId, setNumber: p.setNumber, reps: p.reps, weightKg: p.weightKg, rpe: p.rpe, pending: !p.serverId && !p.queued, queued: p.queued })),
  ];
  const totalSets = serverSets.length + visiblePending.length;
  const saving = visiblePending.some((p) => !p.serverId && !p.queued);

  const ex = exercises[idx];
  const done = ex ? doneFor(ex.name) : [];
  const planned = ex ? Math.max(ex.sets + (extra[ex.id] ?? 0), done.length) : 0;
  const allDone = done.length >= planned;
  const isLastExercise = exercises.slice(idx + 1).every((e) => skipped.has(e.id));

  // ─── actions ─────────────────────────────────────────────────────────────────────────────────
  const startRest = (seconds: number) => {
    timer.start(seconds);
    setRestOpen(true);
  };

  const go = (i: number) => {
    setIdx(Math.min(exercises.length - 1, Math.max(0, i)));
    setPr(null);
    setError(null);
    window.scrollTo({ top: 0 });
  };

  const logSet = async (v: LoggedValues) => {
    if (!ex || !sessionId) return;
    const setNumber = Math.max(0, ...done.map((s) => s.setNumber)) + 1;
    const key = `p${++keyRef.current}`;
    haptic();
    setPending((p) => [...p, { key, name: ex.name, setNumber, reps: v.reps, weightKg: v.weightKg, rpe: v.rpe }]);
    setSkipped((s) => {
      const n = new Set(s);
      n.delete(ex.id);
      return n;
    });
    setPr(null);
    setError(null);
    setLogMsg(`Logged set ${setNumber}: ${fmtNum(toDisplay(v.weightKg, units), 1)} ${unitLabel(units)} for ${v.reps} reps.`);
    if (!(done.length + 1 >= planned && isLastExercise)) startRest(ex.restSec);
    try {
      const r = await logTool<{ id: string; isPr: boolean }>("log_workout_set", {
        date, exerciseName: ex.name, exerciseId: ex.id, sessionId, setNumber, reps: v.reps, weightKg: v.weightKg, rpe: v.rpe,
      });
      if (r.queued) setPending((p) => p.map((x) => (x.key === key ? { ...x, queued: true } : x)));
      else {
        setPending((p) => p.map((x) => (x.key === key ? { ...x, serverId: r.result.id } : x)));
        if (r.result.isPr) {
          setPr(ex.name);
          setPrNames((n) => (n.includes(ex.name) ? n : [...n, ex.name]));
          haptic("success");
        }
      }
    } catch (e) {
      setPending((p) => p.filter((x) => x.key !== key));
      timer.skip();
      setError(e instanceof ApiError ? e.message : "I couldn't save that set. Please try again.");
    }
  };

  const removeSet = async (s: DoneSet) => {
    const id = s.id;
    if (!id) return;
    setDeleted((d) => new Set(d).add(id));
    try {
      await logTool("delete_entry", { kind: "set", id });
    } catch {
      setDeleted((d) => {
        const n = new Set(d);
        n.delete(id);
        return n;
      });
      setError("I couldn't delete that set. Please try again.");
    }
  };

  const addSet = () => ex && setExtra((e) => ({ ...e, [ex.id]: (e[ex.id] ?? 0) + 1 }));

  const skipExercise = () => {
    if (!ex) return;
    setSkipped((s) => new Set(s).add(ex.id));
    if (idx < exercises.length - 1) go(idx + 1);
  };

  const finish = async () => {
    if (!sessionId) return;
    setFinishing(true);
    setError(null);
    try {
      if (totalSets === 0) {
        // Nothing logged: close the session without counting it as a completed workout.
        await post("/api/workouts", { action: "skip", sessionId });
        notifyChanged();
        router.push("/workouts");
        return;
      }
      const r = await post<{ session: { durationMin: number | null }; totals: { sets: number; volume: number } }>("/api/workouts", { action: "finish", sessionId });
      notifyChanged();
      timer.skip();
      haptic("success");
      window.scrollTo({ top: 0 });
      setSummary({ sets: r.totals.sets, volume: r.totals.volume, minutes: r.session.durationMin });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setFinishing(false);
    }
  };

  // Coach-driven commands (from voice/chat). The handler is re-pointed each render so the listener never goes stale.
  const commandRef = useRef<(d: WorkoutCommand) => void>(() => {});
  useEffect(() => {
    commandRef.current = (d) => {
      if (!ex) return;
      if (d.action === "START_REST_TIMER") startRest(typeof d.seconds === "number" && d.seconds > 0 ? d.seconds : ex.restSec);
      else if (d.action === "SKIP_EXERCISE") skipExercise();
      else if (d.action === "ADD_SET") addSet();
    };
  });
  useEffect(() => {
    const h = (e: Event) => commandRef.current((e as CustomEvent<WorkoutCommand>).detail ?? {});
    window.addEventListener("fittrack:workout-command", h);
    return () => window.removeEventListener("fittrack:workout-command", h);
  }, []);

  const hideRest = useCallback(() => setRestOpen(false), []);

  // ─── render ──────────────────────────────────────────────────────────────────────────────────
  if (summary) return <SessionSummary summary={summary} units={units} prNames={prNames} />;

  if (startError) return <ErrorState message={startError} onRetry={() => void startSession()} />;
  if (!ex) return <ErrorState message="Today's workout has no exercises. Try swapping the plan on the Workouts page." />;

  const setLabel = allDone ? `Bonus set (all ${planned} planned sets done)` : `Set ${done.length + 1} of ${planned}`;
  const target = ex.prescription.targetReps[done.length];
  const lastSet = done[done.length - 1];
  const defaultKg = lastSet?.weightKg ?? ex.prescription.weightKg ?? (ex.previous ? Math.max(...ex.previous.sets.map((s) => s.weightKg)) : null);
  const defaults = {
    weight: defaultKg != null ? String(toDisplay(defaultKg, units)) : "",
    reps: String(target ?? lastSet?.reps ?? ex.repMin),
    rpe: Math.min(10, Math.max(6, Math.round(ex.targetRpe * 2) / 2)),
  };
  const progress = exercises.map((e) => {
    const n = doneFor(e.name).length;
    return { id: e.id, name: e.name, done: n, planned: Math.max(e.sets + (extra[e.id] ?? 0), n), skipped: skipped.has(e.id) && n === 0 };
  });
  const nextExercise = exercises[idx + 1];
  const nextUp = !allDone
    ? `Set ${done.length + 1} of ${planned}${ex.prescription.targetReps[done.length] ? ` · aim for ${ex.prescription.targetReps[done.length]} reps` : ""}`
    : !isLastExercise && nextExercise ? `Next exercise: ${nextExercise.name}` : "Finish your workout when you're ready";
  const prHere = pr === ex.name;
  const bigBtn = "btn !min-h-[72px] w-full !rounded-3xl text-xl";

  return (
    <div className="mx-auto max-w-xl space-y-4 pb-28">
      <h1 className="sr-only">{today.day.name}: {today.day.focus}</h1>
      <div className="sr-only" role="status" aria-live="polite">{logMsg}</div>
      <RestAnnouncer timer={timer} />

      {/* Top bar: leave (sets are saved), where we are, sound */}
      <div className="rise flex items-center justify-between gap-2">
        <Link href="/workouts" className="btn btn-ghost !min-h-[48px] !px-2.5 text-muted" aria-label="Leave the workout screen. Your logged sets are saved.">
          <ChevronLeft className="h-5 w-5" aria-hidden /> Workouts
        </Link>
        <p className="eyebrow min-w-0 truncate">{today.day.name}</p>
        <button type="button" className="btn btn-ghost !min-h-[48px] !min-w-[48px] !px-2.5 text-muted" onClick={() => { haptic(); setMuted(!muted); }} aria-pressed={muted} aria-label={`Rest timer sound ${muted ? "off" : "on"}`}>
          {muted ? <VolumeX className="h-5 w-5" aria-hidden /> : <Volume2 className="h-5 w-5" aria-hidden />}
        </button>
      </div>

      <ProgressDots items={progress} current={idx} onSelect={go} />

      {error && <ErrorState message={error} />}
      {today.deloadSuggested && <Notice tone="info">Deload suggested: keep every set easy today. Quality over load.</Notice>}

      {/* Current exercise, in display type */}
      <header className="rise" aria-labelledby="ex-h">
        <p className="eyebrow flex items-center gap-2">
          <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: muscleDot(ex.muscleGroup) }} />
          {MUSCLE_LABEL(ex.muscleGroup)} · exercise {idx + 1} of {exercises.length}
        </p>
        <h2 id="ex-h" className="display mt-1.5 text-[2.25rem] font-extrabold leading-[1.05]">{ex.name}</h2>
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <Badge tone={allDone ? "good" : "brand"} className="!px-3.5 !py-1.5 !text-sm">{setLabel}</Badge>
          <span className="text-sm text-muted">rest {ex.restSec}s · target RPE {ex.targetRpe}</span>
        </p>
      </header>

      {prHere && <PrCard name={ex.name} />}

      <BeatCard ex={ex} target={target} units={units} />

      {/* Logger: steppers + RPE, with the Log button docked in the thumb zone */}
      <section className="space-y-5" aria-label="Log a set">
        <SetLogger
          inputKey={`${ex.id}:${done.length}:${units}`}
          defaults={defaults}
          units={units}
          onLog={(v) => void logSet(v)}
          renderBar={({ valid, formId }) => (
            <>
              {!restOpen && <RestPill timer={timer} onOpen={() => setRestOpen(true)} />}
              {allDone ? (
                <>
                  {isLastExercise ? (
                    <button type="button" className={clsx(bigBtn, "btn-primary")} onClick={() => void finish()} disabled={finishing || saving || !sessionId}>
                      {finishing ? <Spinner label="Finishing" /> : <Square className="h-6 w-6" aria-hidden />} {totalSets === 0 ? "End session" : "Finish workout"}
                    </button>
                  ) : (
                    <button type="button" className={clsx(bigBtn, "btn-primary")} onClick={() => { haptic(); go(idx + 1); }}>
                      <span className="min-w-0 truncate">Next: {nextExercise?.name}</span> <ChevronRight className="h-6 w-6 shrink-0" aria-hidden />
                    </button>
                  )}
                  <button type="submit" form={formId} className="btn !min-h-[52px] w-full" disabled={!valid || !sessionId}>
                    <Plus className="h-5 w-5" aria-hidden /> Log a bonus set
                  </button>
                </>
              ) : (
                <button type="submit" form={formId} className={clsx(bigBtn, "btn-primary")} disabled={!valid || !sessionId}>
                  {sessionId ? <Check className="h-7 w-7" aria-hidden /> : <Spinner label="Starting session" />} {sessionId ? `Log set ${done.length + 1}` : "Starting session…"}
                </button>
              )}
            </>
          )}
        />

        <div className="space-y-2.5 pt-2">
          <div className="flex items-baseline justify-between">
            <h3 className="display text-lg font-extrabold">Done for this exercise</h3>
            <p className="text-sm tabular-nums text-muted">{done.length} of {planned} sets</p>
          </div>
          <SetsDone sets={done} units={units} onDelete={(s) => void removeSet(s)} />
        </div>
      </section>

      {/* Navigation */}
      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" className="btn !min-h-[56px]" onClick={() => go(idx - 1)} disabled={idx === 0}><ChevronLeft className="h-5 w-5" aria-hidden /> Previous</button>
        <button type="button" className="btn !min-h-[56px]" onClick={() => go(idx + 1)} disabled={idx >= exercises.length - 1}>Next <ChevronRight className="h-5 w-5" aria-hidden /></button>
        <button type="button" className="btn !min-h-[56px]" onClick={addSet}><Plus className="h-5 w-5" aria-hidden /> Add one more set</button>
        <button type="button" className="btn !min-h-[56px]" onClick={skipExercise}><SkipForward className="h-5 w-5" aria-hidden /> Skip this exercise</button>
      </div>

      {/* Voice */}
      <section className="card" aria-label="Voice logging">
        <button type="button" className="press flex min-h-[48px] w-full items-center justify-between gap-2 text-left" aria-expanded={voiceOpen} aria-controls="voice-body" onClick={() => setVoiceOpen((o) => !o)}>
          <span className="flex items-center gap-2 text-sm font-semibold"><Mic className="h-4 w-4 text-brand" aria-hidden /> Hands-free logging</span>
          <ChevronDown className={clsx("h-5 w-5 text-muted transition-transform", voiceOpen && "rotate-180")} aria-hidden />
        </button>
        {voiceOpen && (
          <div id="voice-body" className="mt-3 space-y-2">
            <p className="text-center text-sm text-muted">Say “Set 1 was 60 kilos for 8”, “start rest timer” or “skip this exercise”.</p>
            <VoicePanel variant="compact" />
          </div>
        )}
      </section>

      {/* Whole session */}
      <section className="card" aria-labelledby="prog-h">
        <details>
          <summary id="prog-h" className="flex min-h-[48px] cursor-pointer items-center justify-between text-sm font-semibold">
            Today&apos;s exercises
            <span className="font-normal tabular-nums text-muted">{progress.filter((p) => p.done >= p.planned).length} of {progress.length} done</span>
          </summary>
          <div className="mt-2"><ExerciseProgress items={progress} current={idx} onSelect={go} /></div>
        </details>
      </section>

      <div className="space-y-2">
        <button type="button" className="btn !min-h-[60px] w-full" onClick={() => void finish()} disabled={finishing || saving || !sessionId}>
          {finishing ? <Spinner label="Finishing" /> : <Square className="h-5 w-5" aria-hidden />} {totalSets === 0 ? "End session (no sets logged)" : `Finish workout · ${totalSets} ${totalSets === 1 ? "set" : "sets"}`}
        </button>
        <p className="text-center text-xs text-muted">Pain, dizziness or anything that feels wrong: stop and check with a doctor or physiotherapist.</p>
      </div>

      <RestOverlay timer={timer} open={restOpen} onHide={hideRest} muted={muted} onMuted={setMuted} nextUp={nextUp} banner={prHere ? <PrCard name={ex.name} /> : undefined} />
    </div>
  );
}
