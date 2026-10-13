"use client";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Field, Spinner } from "@/components/ui";
import { AuthError, GoogleButton, OrDivider, PasswordInput } from "../_components/parts";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setUnverified(false);
    try {
      const res = await signIn("credentials", { email, password, redirect: false });
      setBusy(false);
      if (res?.error) {
        if (res.error.includes("UNVERIFIED_EMAIL") || res.code === "UNVERIFIED_EMAIL") {
          setUnverified(true);
          setError("Your email address has not been verified yet. Please check your inbox or request a new verification link.");
        } else {
          setError("That email and password don't match. Please try again.");
        }
      } else {
        router.replace("/");
        router.refresh();
      }
    } catch {
      setBusy(false);
      setError("An unexpected error occurred. Please try again.");
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleBusy(true);
    setError(null);
    try {
      await signIn("google", { callbackUrl: "/" });
    } catch {
      setGoogleBusy(false);
      setError("Unable to initiate Google sign-in. Please try again.");
    }
  };

  return (
    <div className="card glass rise space-y-5 !p-5 shadow-float sm:!p-6" aria-labelledby="login-h" style={{ ["--i" as string]: 1 }}>
      <div>
        <h1 id="login-h" className="display text-2xl font-extrabold">Welcome back</h1>
        <p className="mt-1 text-sm text-muted">Pick up where you left off.</p>
      </div>

      <GoogleButton onClick={handleGoogleSignIn} busy={googleBusy} disabled={googleBusy || busy} />

      <OrDivider>or continue with email</OrDivider>

      <form onSubmit={submit} className="space-y-4">
        <Field label="Email" htmlFor="email">
          <input id="email" type="email" autoComplete="email" inputMode="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" htmlFor="password">
          <PasswordInput id="password" autoComplete="current-password" value={password} onChange={setPassword} />
        </Field>

        {error && (
          <AuthError message={error}>
            {unverified && (
              <Link href={`/verify-email?email=${encodeURIComponent(email)}`} className="inline-flex min-h-[44px] items-center gap-1 font-semibold text-brand underline">
                Verify your email or resend verification link <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            )}
          </AuthError>
        )}

        <button className="btn btn-primary w-full !min-h-[52px] !text-base" disabled={busy || googleBusy}>
          {busy ? <Spinner label="Signing in" /> : <>Sign in <ArrowRight className="h-4 w-4" aria-hidden /></>}
        </button>
      </form>

      <p className="text-center text-sm text-muted">
        New here? <Link href="/register" className="inline-flex min-h-[44px] items-center font-semibold text-brand underline">Create an account</Link>
      </p>
    </div>
  );
}
