"use client";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, Spinner } from "@/components/ui";
import { ApiError, post } from "@/lib/client/api";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await post<{
        id: string;
        email: string;
        requiresVerification?: boolean;
        token?: string;
      }>("/api/register", {
        name,
        email,
        password,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      if (res.requiresVerification) {
        // Direct user to verify-email confirmation screen
        const params = new URLSearchParams({ email: res.email });
        if (res.token) params.set("devToken", res.token);
        router.push(`/verify-email?${params.toString()}`);
        return;
      }

      // Fallback if verification isn't required
      const signinRes = await signIn("credentials", { email, password, redirect: false });
      if (signinRes?.error) throw new Error("Account created, but sign-in failed. Please sign in manually.");
      router.replace("/onboarding");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleBusy(true);
    setError(null);
    try {
      await signIn("google", { callbackUrl: "/onboarding" });
    } catch {
      setGoogleBusy(false);
      setError("Unable to initiate Google sign-in. Please try again.");
    }
  };

  return (
    <div className="card space-y-4" aria-labelledby="reg-h">
      <h1 id="reg-h" className="text-xl font-semibold">Create your account</h1>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={googleBusy || busy}
        className="btn w-full flex items-center justify-center gap-2 border border-border bg-surface-2 hover:bg-surface text-fg"
      >
        {googleBusy ? (
          <Spinner label="Connecting to Google" />
        ) : (
          <>
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google</span>
          </>
        )}
      </button>

      <div className="relative my-2 flex items-center justify-center">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
        <span className="relative bg-surface px-2 text-xs uppercase tracking-wider text-muted">or register with email</span>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Field label="First name" htmlFor="name">
          <input id="name" autoComplete="given-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </Field>
        <Field label="Email" htmlFor="email">
          <input id="email" type="email" autoComplete="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 8 characters.">
          <input id="password" type="password" autoComplete="new-password" required minLength={8} className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <p role="alert" className="text-sm text-bad">{error}</p>}
        <button className="btn btn-primary w-full" disabled={busy || googleBusy}>
          {busy ? <Spinner label="Creating account" /> : "Create account"}
        </button>
      </form>

      <p className="text-center text-sm text-muted">
        Already have an account? <Link href="/login" className="font-medium text-brand underline">Sign in</Link>
      </p>
    </div>
  );
}
