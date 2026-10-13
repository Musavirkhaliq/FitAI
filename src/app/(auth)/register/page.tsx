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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post("/api/register", { name, email, password, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      const res = await signIn("credentials", { email, password, redirect: false });
      if (res?.error) throw new Error("Account created, but sign-in failed. Please sign in manually.");
      router.replace("/onboarding");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-4" aria-labelledby="reg-h">
      <h1 id="reg-h" className="text-xl font-semibold">Create your account</h1>
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
      <button className="btn btn-primary w-full" disabled={busy}>{busy ? <Spinner label="Creating account" /> : "Create account"}</button>
      <p className="text-center text-sm text-muted">
        Already have an account? <Link href="/login" className="font-medium text-brand underline">Sign in</Link>
      </p>
    </form>
  );
}
