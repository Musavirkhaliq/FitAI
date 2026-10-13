"use client";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Field, Spinner } from "@/components/ui";
import { ApiError, post } from "@/lib/client/api";
import { AuthError, GoogleButton, OrDivider, PasswordInput } from "../_components/parts";

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
    <div className="card glass rise space-y-5 !p-5 shadow-float sm:!p-6" aria-labelledby="reg-h" style={{ ["--i" as string]: 1 }}>
      <div>
        <h1 id="reg-h" className="display text-2xl font-extrabold">Create your account</h1>
        <p className="mt-1 text-sm text-muted">Takes under a minute. Your plan comes next.</p>
      </div>

      <GoogleButton onClick={handleGoogleSignIn} busy={googleBusy} disabled={googleBusy || busy} />

      <OrDivider>or register with email</OrDivider>

      <form onSubmit={submit} className="space-y-4">
        <Field label="First name" htmlFor="name">
          <input id="name" autoComplete="given-name" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </Field>
        <Field label="Email" htmlFor="email">
          <input id="email" type="email" autoComplete="email" inputMode="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" htmlFor="password" hint="At least 8 characters.">
          <PasswordInput id="password" autoComplete="new-password" minLength={8} value={password} onChange={setPassword} />
        </Field>
        {error && <AuthError message={error} />}
        <button className="btn btn-primary w-full !min-h-[52px] !text-base" disabled={busy || googleBusy}>
          {busy ? <Spinner label="Creating account" /> : <>Create account <ArrowRight className="h-4 w-4" aria-hidden /></>}
        </button>
      </form>

      <p className="text-center text-sm text-muted">
        Already have an account? <Link href="/login" className="inline-flex min-h-[44px] items-center font-semibold text-brand underline">Sign in</Link>
      </p>
    </div>
  );
}
