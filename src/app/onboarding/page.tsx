"use client";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
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
import { ErrorState, LoadingBlock, Notice, Skeleton, Spinner, haptic } from "@/components/ui";
import { ApiError, notifyChanged, patch, post, useApi } from "@/lib/client/api";

type Phase = "chat" | "plan";
const LAST = STEPS.length - 1;
const QUESTION_ID = "onb-question";
const TYPING_MS = 400;

const prefersReduce = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** The coach's avatar: a small brand orb with a glossy highlight. Decorative. */
function Avatar() {
  return (
    <span aria-hidden className="grad-brand relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-brand-fg" style={{ boxShadow: "var(--shadow-tile), var(--glow)" }}>
      <span className="pointer-events-none absolute inset-0 rounded-full" style={{ background: "radial-gradient(120% 90% at 30% 15%, rgb(255 255 255 / 0.5), transparent 55%)" }} />
      <Sparkles className="relative h-4 w-4" />
    </span>
  );
}

function AssistantBubble({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <div className="rise flex items-start gap-2.5">
      <Avatar />
      <div id={id} className="max-w-[86%] rounded-[1.25rem] rounded-tl-md border border-border bg-surface px-4 py-3 shadow-tile">{children}</div>
    </div>
  );
}

/** Three dots while the coach "types". Skipped entirely under reduced motion. */
function Typing() {
  return (
    <div className="flex items-start gap-2.5" aria-hidden>
      <Avatar />
      <div className="pop flex h-[2.75rem] items-center gap-1.5 rounded-[1.25rem] rounded-tl-md border border-border bg-surface px-4 shadow-tile">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-2 w-2 rounded-full bg-muted/70 motion-safe:animate-bounce" style={{ animationDelay: `${i * 140}ms` }} />
        ))}
      </div>
    </div>
  );
}

function UserBubble({ text, label, onEdit }: { text: string; label: string; onEdit: () => void }) {
  return (
    <div className="rise flex justify-end">
      <button
        type="button" onClick={onEdit} aria-label={`${label} Your answer: ${text}. Change it`}
        className="press max-w-[84%] break-words rounded-[1.25rem] rounded-br-md px-4 py-2.5 text-left text-brand-fg"
        style={{ background: "var(--btn-bg)", boxShadow: "var(--glow)" }}
      >
        <span className="font-medium">{text}</span>
        <span className="mt-0.5 block text-xs underline opacity-90">Change</span>
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
  const [typing, setTyping] = useState(() => !prefersReduce());
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewDto | null>(null);
  const [overrides, setOverrides] = useState<Required<Overrides> | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const areaRef = useRef<HTMLDivElement>(null);
  const interacted = useRef(false);
  const prefilled = useRef(false);

  const existing = profileApi.data;
  const ready = !(profileApi.loading && !existing);
  // Prefill the name from sign-up so people aren't asked twice.
  useEffect(() => {
    if (prefilled.current || !existing?.user?.name) return;
    prefilled.current = true;
    setAnswers((a) => (a.name ? a : { ...a, name: existing.user?.name ?? "" }));
  }, [existing]);

  const stepId = STEPS[index];

  /** Move to another question (or the plan). Each new question gets a short "typing" beat, skipped under reduced motion. */
  const go = useCallback((nextIndex: number, nextPhase: Phase) => {
    interacted.current = true;
    setIndex(nextIndex);
    setPhase(nextPhase);
    setTyping(nextPhase === "chat" && !prefersReduce());
  }, []);

  useEffect(() => {
    if (!typing || !ready) return;
    const t = setTimeout(() => setTyping(false), TYPING_MS);
    return () => clearTimeout(t);
  }, [typing, index, ready]);

  // Keep the newest question in view, and move keyboard focus to the new answer control so screen-reader and keyboard users follow along.
  useEffect(() => {
    if (!ready || !interacted.current) return;
    const behavior = prefersReduce() ? "auto" : "smooth";
    if (phase === "plan") {
      window.scrollTo({ top: 0, behavior });
      return;
    }
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior });
    if (typing) return;
    areaRef.current?.querySelector<HTMLElement>("input, textarea, button")?.focus({ preventScroll: true });
  }, [index, phase, typing, ready]);

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
      go(index, "plan");
      void runPreview(next, null);
    } else {
      go(index + 1, "chat");
    }
  };

  const back = () => {
    setError(null);
    if (phase === "plan") go(index, "chat");
    else go(Math.max(0, index - 1), "chat");
  };

  const edit = (id: StepId) => {
    setError(null);
    go(STEPS.indexOf(id), "chat");
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
      haptic("success");
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

  if (!ready) {
    return (
      <Shell top={<TopBar />}>
        <LoadingBlock label="Getting ready" rows={2} />
      </Shell>
    );
  }

  const done = phase === "plan";
  const helpText = help(stepId, answers);
  const firstName = answers.name.trim().split(/\s+/)[0];
  const targetLabel = answers.targetWeight.trim() ? summary("targetWeight", answers) : null;
  const pct = ((done ? STEPS.length : index) / STEPS.length) * 100;

  const top = (
    <TopBar
      onBack={back}
      backDisabled={!done && index === 0}
      label={done ? "All questions answered" : `Question ${index + 1} of ${STEPS.length}`}
      value={done ? STEPS.length : index}
      pct={pct}
    />
  );

  const footer = done ? (
    <div className="glass sticky bottom-0 z-20 border-t border-border/70 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto w-full max-w-xl space-y-1.5 px-4 pt-3">
        {saveError && <ErrorState message={saveError} onRetry={() => void save()} />}
        <button className="btn btn-primary w-full !min-h-[56px] !text-base" onClick={() => void save()} disabled={saving || previewing || !preview}>
          {saving ? <><Spinner label="Saving your plan" /> Saving…</> : <>Start my journey <ArrowRight className="h-5 w-5" aria-hidden /></>}
        </button>
        <button className="btn btn-ghost w-full !min-h-[44px]" onClick={back} disabled={saving}>Change an answer</button>
      </div>
    </div>
  ) : (
    <div className="glass sticky bottom-0 z-20 border-t border-border/70 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div ref={areaRef} className="mx-auto max-h-[62dvh] w-full max-w-xl overflow-y-auto px-4 pt-3">
        <section aria-label="Your answer">
          {typing ? (
            <Skeleton className="h-14 !rounded-2xl" />
          ) : (
            <StepInput key={stepId} id={stepId} answers={answers} set={(p) => setAnswers((a) => ({ ...a, ...p }))} submit={submit} error={error} labelId={QUESTION_ID} last={index === LAST} />
          )}
        </section>
      </div>
    </div>
  );

  return (
    <Shell top={top} footer={footer}>
      {existing?.profile.onboarded && (
        <div className="mb-4">
          <Notice>
            You&apos;ve already set up your plan. You can run setup again, or <Link href="/" className="font-medium text-brand underline">go back to Today</Link>.
          </Notice>
        </div>
      )}

      {done ? (
        <section aria-label="Your starting plan">
          <header className="rise mb-4">
            <h1 className="display text-[2rem] font-extrabold leading-[1.1] tracking-tight">Your plan is <span className="text-grad">ready</span></h1>
            <p className="mt-1.5 text-sm text-muted">{firstName ? `${firstName}, here's` : "Here's"} your starting plan, built from your answers. Nothing is final: you can change it any time.</p>
          </header>

          {previewing && !preview && (
            <div role="status" aria-live="polite" className="space-y-3">
              <p className="flex items-center gap-2 text-sm text-muted"><Spinner label="Building your plan" /> Building your plan…</p>
              <Skeleton className="h-56" />
              <Skeleton className="h-28" />
              <Skeleton className="h-24" />
            </div>
          )}
          {previewError && !preview && <ErrorState message={previewError} onRetry={() => void runPreview(answers, overrides)} />}
          {preview && (
            <PlanPreview preview={preview} sex={answers.sex} goal={answers.goal} units={answers.unitSystem} recalculating={previewing} recalcError={previewError}
              targetLabel={targetLabel} onRecalc={(o) => { setOverrides(o); void runPreview(answers, o); }} />
          )}

          <details className="mt-4 rounded-2xl border border-border bg-surface px-4 text-sm">
            <summary className="min-h-[48px] cursor-pointer py-3.5 font-semibold">Review or change your answers</summary>
            <div className="space-y-3 pb-4 pt-1">{pairs(STEPS)}</div>
          </details>
        </section>
      ) : (
        <div role="log" aria-live="polite" aria-relevant="additions" className="space-y-3">
          <AssistantBubble>
            <p>Hi, I&apos;m your coach. I&apos;ll ask a few quick questions, one at a time, to set up a starting plan. There&apos;s no time limit, and nothing is final: you can change everything later.</p>
          </AssistantBubble>
          {pairs(STEPS.slice(0, index))}
          {typing ? (
            <Typing />
          ) : (
            <AssistantBubble id={QUESTION_ID}>
              <p className="font-semibold">{question(stepId, answers)}</p>
              {helpText && <p className="mt-1 text-sm text-muted">{helpText}</p>}
            </AssistantBubble>
          )}
        </div>
      )}

      <p className="mt-6 text-center text-xs text-muted">Targets are starting estimates, not medical advice. AI can make mistakes. Double-check important results.</p>
    </Shell>
  );
}

/** Sticky top bar: back, "Question N of M", theme, and a slim gradient progress line along its bottom edge. */
function TopBar({ onBack, backDisabled, label, value, pct }: { onBack?: () => void; backDisabled?: boolean; label?: string; value?: number; pct?: number }) {
  return (
    <>
      <div className="mx-auto flex w-full max-w-xl items-center gap-2 px-2 py-1.5">
        {onBack ? (
          <button type="button" onClick={onBack} disabled={backDisabled} className="btn btn-ghost !min-h-[44px] !px-2.5" aria-label="Go back to the previous question">
            <ArrowLeft className="h-5 w-5" aria-hidden /> <span>Back</span>
          </button>
        ) : (
          <span className="display px-2.5 text-lg font-extrabold tracking-tight">Sukoon<span className="text-grad">Fit</span></span>
        )}
        <p className="min-w-0 flex-1 truncate text-center text-xs font-medium text-muted">{label}</p>
        <ThemeToggle />
      </div>
      {pct != null && (
        <div role="progressbar" aria-label="Setup progress" aria-valuemin={0} aria-valuemax={STEPS.length} aria-valuenow={value} className="h-[3px] w-full bg-surface-3">
          <div className="grad-brand h-full rounded-r-full transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
        </div>
      )}
    </>
  );
}

function Shell({ top, footer, children }: { top: ReactNode; footer?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="glass pt-safe sticky top-0 z-30 border-b border-border/60">{top}</header>
      <main id="main" className="mx-auto w-full max-w-xl flex-1 px-4 pb-6 pt-5">{children}</main>
      {footer}
    </div>
  );
}
