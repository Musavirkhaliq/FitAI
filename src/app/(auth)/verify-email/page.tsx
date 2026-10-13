"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, Mail, ArrowRight } from "lucide-react";
import { Field, Spinner } from "@/components/ui";
import { ApiError, post } from "@/lib/client/api";

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
    <div className="card space-y-5" aria-labelledby="verify-h">
      {status === "verifying" && (
        <div className="flex flex-col items-center py-6 text-center space-y-3">
          <Spinner label="Verifying email" />
          <h1 id="verify-h" className="text-xl font-semibold">Verifying your email</h1>
          <p className="text-sm text-muted">Please wait while we confirm your email address…</p>
        </div>
      )}

      {status === "success" && (
        <div className="space-y-4 text-center py-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-good/15 text-good">
            <CheckCircle2 className="h-7 w-7" aria-hidden />
          </div>
          <div>
            <h1 id="verify-h" className="text-xl font-semibold text-fg">Email verified!</h1>
            <p className="mt-1 text-sm text-muted">{message}</p>
          </div>
          <Link href="/login" className="btn btn-primary w-full inline-flex items-center justify-center gap-2">
            <span>Continue to sign in</span>
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      )}

      {(status === "idle" || status === "error") && (
        <>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand">
              <Mail className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h1 id="verify-h" className="text-xl font-semibold">Check your email</h1>
              <p className="text-xs text-muted">We sent a verification link to your email</p>
            </div>
          </div>

          {status === "error" && (
            <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-bad/30 bg-bad/10 p-3.5 text-sm text-bad">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{message}</span>
            </div>
          )}

          <p className="text-sm text-muted leading-relaxed">
            Please check your inbox and click the verification link to activate your FitTrack AI account. If you don&apos;t see it, be sure to check your spam or junk folder.
          </p>

          {simulatedToken && (
            <div className="rounded-xl border border-border bg-surface-2 p-3 text-xs space-y-1">
              <p className="font-semibold text-brand">Development Mode Verification Link:</p>
              <Link
                href={`/verify-email?token=${simulatedToken}&email=${encodeURIComponent(email)}`}
                className="block text-brand underline break-all"
              >
                Click here to verify instantly ({email})
              </Link>
            </div>
          )}

          <form onSubmit={handleResend} className="border-t border-border pt-4 space-y-3">
            <h2 className="text-sm font-semibold">Need a new link?</h2>
            <Field label="Email" htmlFor="resend-email">
              <input
                id="resend-email"
                type="email"
                required
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </Field>

            {resendMessage && <p className="text-xs text-good">{resendMessage}</p>}
            {resendError && <p className="text-xs text-bad">{resendError}</p>}

            <button type="submit" className="btn w-full" disabled={resending}>
              {resending ? <Spinner label="Sending verification email" /> : "Resend verification email"}
            </button>
          </form>

          <p className="text-center text-sm text-muted pt-2">
            Ready to sign in? <Link href="/login" className="font-medium text-brand underline">Back to login</Link>
          </p>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="card text-center py-8"><Spinner label="Loading" /></div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
