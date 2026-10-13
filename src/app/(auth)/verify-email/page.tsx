"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Mail, ArrowRight } from "lucide-react";
import { Field, Spinner } from "@/components/ui";
import { ApiError, post } from "@/lib/client/api";
import { AuthError } from "../_components/parts";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const emailParam = searchParams.get("email");

  const [email, setEmail] = useState(emailParam || "");
  const [status, setStatus] = useState<"idle" | "verifying" | "success" | "error">(token ? "verifying" : "idle");
  const [message, setMessage] = useState<string | null>(null);

  // Resend state
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [simulatedToken, setSimulatedToken] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    let ignore = false;
    async function verify() {
      setStatus("verifying");
      setMessage(null);
      try {
        const res = await post<{ success: boolean; message: string }>("/api/auth/verify-email", {
          token,
          email: emailParam || undefined,
        });
        if (!ignore) {
          setStatus("success");
          setMessage(res.message || "Your email has been verified!");
        }
      } catch (err) {
        if (!ignore) {
          setStatus("error");
          setMessage(err instanceof ApiError || err instanceof Error ? err.message : "Verification link is invalid or expired.");
        }
      }
    }

    verify();
    return () => {
      ignore = true;
    };
  }, [token, emailParam]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setResending(true);
    setResendError(null);
    setResendMessage(null);
    setSimulatedToken(null);

    try {
      const res = await post<{ message: string; simulated?: boolean; token?: string }>("/api/auth/verify-email", {
        action: "resend",
        email,
      });
      setResendMessage(res.message);
      if (res.simulated && res.token) {
        setSimulatedToken(res.token);
      }
    } catch (err) {
      setResendError(err instanceof ApiError || err instanceof Error ? err.message : "Failed to send verification email.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="card glass rise space-y-5 !p-5 shadow-float sm:!p-6" aria-labelledby="verify-h" style={{ ["--i" as string]: 1 }}>
      {status === "verifying" && (
        <div className="flex flex-col items-center space-y-3 py-6 text-center">
          <Spinner label="Verifying email" />
          <h1 id="verify-h" className="display text-2xl font-extrabold">Verifying your email</h1>
          <p className="text-sm text-muted">Please wait while we confirm your email address…</p>
        </div>
      )}

      {status === "success" && (
        <div className="space-y-5 py-2 text-center">
          <div className="grad-brand mx-auto flex h-16 w-16 items-center justify-center rounded-full text-brand-fg pop" style={{ boxShadow: "var(--shadow-float), 0 0 36px -4px rgb(var(--brand-a) / 0.5)" }}>
            <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5 13l4 4L19 7" strokeDasharray="24" className="animate-check-draw" />
            </svg>
          </div>
          <div>
            <h1 id="verify-h" className="display text-2xl font-extrabold">Email verified!</h1>
            <p className="mt-1 text-sm text-muted">{message}</p>
          </div>
          <Link href="/login" className="btn btn-primary w-full !min-h-[52px] !text-base">
            <span>Continue to sign in</span>
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      )}

      {(status === "idle" || status === "error") && (
        <>
          <div className="flex items-center gap-3.5">
            <div className="grad-brand flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-brand-fg" style={{ boxShadow: "var(--shadow-tile), 0 0 24px -6px rgb(var(--brand-a) / 0.5)" }}>
              <Mail className="h-6 w-6" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 id="verify-h" className="display text-2xl font-extrabold leading-tight">Check your email</h1>
              <p className="text-sm text-muted">We sent a verification link to your email</p>
            </div>
          </div>

          {status === "error" && message && <AuthError message={message} />}

          <p className="text-sm leading-relaxed text-muted">
            Please check your inbox and click the verification link to activate your SukoonFit account. If you don&apos;t see it, be sure to check your spam or junk folder.
          </p>

          {simulatedToken && (
            <div className="space-y-1 rounded-2xl border border-border bg-surface-2 p-3.5 text-xs">
              <p className="font-semibold text-brand">Development Mode Verification Link:</p>
              <Link
                href={`/verify-email?token=${simulatedToken}&email=${encodeURIComponent(email)}`}
                className="block break-all py-1 text-brand underline"
              >
                Click here to verify instantly ({email})
              </Link>
            </div>
          )}

          <form onSubmit={handleResend} className="space-y-3 border-t border-border pt-5">
            <h2 className="display text-base font-bold">Need a new link?</h2>
            <Field label="Email" htmlFor="resend-email">
              <input
                id="resend-email"
                type="email"
                inputMode="email"
                required
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </Field>

            {resendMessage && <p role="status" className="text-sm text-good">{resendMessage}</p>}
            {resendError && <AuthError message={resendError} />}

            <button type="submit" className="btn w-full !min-h-[52px]" disabled={resending}>
              {resending ? <Spinner label="Sending verification email" /> : "Resend verification email"}
            </button>
          </form>

          <p className="pt-1 text-center text-sm text-muted">
            Ready to sign in? <Link href="/login" className="inline-flex min-h-[44px] items-center font-semibold text-brand underline">Back to login</Link>
          </p>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="card glass flex justify-center py-10"><Spinner label="Loading" /></div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
