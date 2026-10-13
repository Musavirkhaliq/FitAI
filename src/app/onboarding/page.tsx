"use client";
import { Activity, ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { PlanPreview } from "@/components/onboarding/PlanPreview";
import { StepInput } from "@/components/onboarding/StepInput";
import {
  EMPTY_ANSWERS, STEPS, help, question, summary, toPayload, validate,
  type Answers, type Overrides, type PreviewDto, type StepId,
} from "@/components/onboarding/model";
import type { ProfileResponse } from "@/components/settings/types";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ErrorState, LoadingBlock, Notice, ProgressBar, Spinner } from "@/components/ui";
import { ApiError, notifyChanged, patch, post, useApi } from "@/lib/client/api";

type Phase = "chat" | "plan";
const LAST = STEPS.length - 1;
const QUESTION_ID = "onb-question";

function AssistantBubble({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand" aria-hidden><Sparkles className="h-4 w-4" /></span>
      <div id={id} className="max-w-[88%] rounded-2xl rounded-tl-md border border-border bg-surface px-4 py-3 shadow-sm">{children}</div>
    </div>
  );
}

function UserBubble({ text, label, onEdit }: { text: string; label: string; onEdit: () => void }) {
  return (
    <div className="flex justify-end">
      <button type="button" onClick={onEdit} aria-label={`${label} Your answer: ${text}. Change it`}
        className="max-w-[85%] break-words rounded-2xl rounded-tr-md bg-brand px-4 py-2.5 text-left text-brand-fg shadow-sm hover:opacity-90">
        {text}
        <span className="mt-0.5 block text-xs opacity-80 underline">Change</span>
      </button>
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const profileApi = useApi<ProfileResponse>("/api/profile");
  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("chat");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewDto | null>(null);
  const [overrides, setOverrides] = useState<Required<Overrides> | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const areaRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  const prefilled = useRef(false);

  const existing = profileApi.data;
  // Prefill the name from sign-up so people aren't asked twice.
  useEffect(() => {
    if (prefilled.current || !existing?.user?.name) return;
    prefilled.current = true;
    setAnswers((a) => (a.name ? a : { ...a, name: existing.user?.name ?? "" }));
  }, [existing]);

  const stepId = STEPS[index];

  // Move keyboard focus (and the view) to the new question so screen-reader and keyboard users follow along.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = areaRef.current;
    el?.querySelector<HTMLElement>("input, textarea, button")?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }, [index, phase]);

  const runPreview = useCallback(async (a: Answers, ov: Required<Overrides> | null) => {
    const payload = toPayload(a);
    if (!payload) {
      setPreviewError("Some answers are missing. Please go back and check them.");
      return;
    }
    setPreviewing(true);
    setPreviewError(null);
    try {
      const r = await post<{ preview: PreviewDto }>("/api/onboarding", { action: "preview", ...payload, ...(ov ? { overrides: ov } : {}) });
      setPreview(r.preview);
    } catch (e) {
      setPreviewError(e instanceof ApiError ? e.message : "I couldn't reach the server. Please check your connection and try again.");
    } finally {
      setPreviewing(false);
    }
  }, []);

  const submit = (patchAnswers?: Partial<Answers>) => {
    const next = patchAnswers ? { ...answers, ...patchAnswers } : answers;
    if (patchAnswers) setAnswers(next);
    const err = validate(stepId, next);
    setError(err);
    if (err) return;
    if (index === LAST) {
      setOverrides(null);
      setPreview(null);
      setPhase("plan");
      void runPreview(next, null);
    } else {
      setIndex(index + 1);
    }
  };

  const back = () => {
    setError(null);
    if (phase === "plan") setPhase("chat");
    else setIndex(Math.max(0, index - 1));
  };

  const edit = (id: StepId) => {
    setError(null);
    setIndex(STEPS.indexOf(id));
    setPhase("chat");
  };

  const save = async () => {
    const payload = toPayload(answers);
    if (!payload) return;
    setSaving(true);
    setSaveError(null);
    try {
      await post("/api/onboarding", { action: "save", ...payload, ...(overrides ? { overrides } : {}) });
      const name = answers.name.trim();
      // The name is a nice-to-have: never block finishing setup on it.
      if (name && name !== existing?.user?.name) await patch("/api/profile", { name }).catch(() => undefined);
      // AppShell reads the cached profile; mark it onboarded first or it would bounce straight back here.
      profileApi.setData((prev) => (prev ? { ...prev, profile: { ...prev.profile, onboarded: true } } : prev));
      notifyChanged();
      router.replace("/");
      router.refresh();
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : "I couldn't save your plan. Please check your connection and try again.");
      setSaving(false);
    }
  };

  const pairs = (ids: StepId[]) =>
    ids.map((id) => (
      <Fragment key={id}>
        <AssistantBubble><p>{question(id, answers)}</p></AssistantBubble>
        <UserBubble text={summary(id, answers)} label={question(id, answers)} onEdit={() => edit(id)} />
      </Fragment>
    ));

  if (profileApi.loading && !existing) {
    return <Shell><LoadingBlock label="Getting ready" rows={2} /></Shell>;
  }

  const done = phase === "plan";
  const helpText = help(stepId, answers);

  return (
    <Shell>
      {existing?.profile.onboarded && (
        <div className="mb-4">
          <Notice>
            You&apos;ve already set up your plan. You can run setup again, or <Link href="/" className="font-medium text-brand underline">go back to Today</Link>.
          </Notice>
        </div>
      )}

      <div className="mb-5 flex items-center gap-3">
        <button type="button" onClick={back} disabled={!done && index === 0} className="btn btn-ghost !px-2.5" aria-label="Go back to the previous question">
          <ArrowLeft className="h-5 w-5" aria-hidden /> <span>Back</span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs font-medium text-muted">{done ? "All questions answered" : `Question ${index + 1} of ${STEPS.length}`}</p>
          <ProgressBar value={done ? STEPS.length : index} max={STEPS.length} label="Setup progress" />
        </div>
      </div>

      <div role="log" aria-live="polite" aria-relevant="additions" className="space-y-3">
        <AssistantBubble>
          <p>Hi, I&apos;m your coach. I&apos;ll ask a few quick questions, one at a time, to set up a starting plan. There&apos;s no time limit, and nothing is final: you can change everything later.</p>
        </AssistantBubble>

        {done ? (
          <>
            <details className="rounded-xl border border-border bg-surface px-3 py-2 text-sm">
              <summary className="min-h-[44px] cursor-pointer py-2.5 font-medium">Review or change your answers</summary>
              <div className="space-y-3 pb-3 pt-1">{pairs(STEPS)}</div>
            </details>
            <AssistantBubble><p>Thanks! Here&apos;s your starting plan.</p></AssistantBubble>
          </>
        ) : (
          <>
            {pairs(STEPS.slice(0, index))}
            <AssistantBubble id={QUESTION_ID}>
              <p className="font-medium">{question(stepId, answers)}</p>
              {helpText && <p className="mt-1 text-sm text-muted">{helpText}</p>}
            </AssistantBubble>
          </>
        )}
      </div>

      <div ref={areaRef} className="mt-4 scroll-mb-24 scroll-mt-20">
        {!done ? (
          <section className="card" aria-label="Your answer">
            <StepInput key={stepId} id={stepId} answers={answers} set={(p) => setAnswers((a) => ({ ...a, ...p }))} submit={submit} error={error} labelId={QUESTION_ID} last={index === LAST} />
          </section>
        ) : (
          <section className="card space-y-4" aria-label="Your starting plan">
            <h1 className="text-xl font-semibold">Your starting plan</h1>
            {previewing && !preview && <div className="flex items-center gap-2 text-sm text-muted"><Spinner label="Building your plan" /> Building your plan…</div>}
            {previewError && !preview && <ErrorState message={previewError} onRetry={() => void runPreview(answers, overrides)} />}
            {preview && (
              <>
                <PlanPreview preview={preview} sex={answers.sex} goal={answers.goal} units={answers.unitSystem} recalculating={previewing} recalcError={previewError}
                  onRecalc={(o) => { setOverrides(o); void runPreview(answers, o); }} />
                {saveError && <ErrorState message={saveError} onRetry={() => void save()} />}
                <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
                  <button className="btn btn-primary min-w-[180px]" onClick={() => void save()} disabled={saving || previewing}>
                    {saving ? <><Spinner label="Saving your plan" /> Saving…</> : "Looks good, start"}
                  </button>
                  <button className="btn" onClick={back} disabled={saving}>Change an answer</button>
                </div>
              </>
            )}
          </section>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-muted">Targets are starting estimates, not medical advice. AI can make mistakes. Double-check important results.</p>
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-bg/85 px-4 py-2 backdrop-blur">
        <span className="flex items-center gap-2 font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-brand-fg"><Activity className="h-4 w-4" aria-hidden /></span> FitTrack AI
        </span>
        <ThemeToggle />
      </header>
      <main id="main" className="mx-auto w-full max-w-2xl px-4 pb-24 pt-5">{children}</main>
    </div>
  );
}
