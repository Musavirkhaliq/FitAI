"use client";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Field, Spinner } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    setBusy(false);
    if (res?.error) setError("That email and password don't match. Please try again.");
    else {
      router.replace("/");
      router.refresh();
    }
  };

  return (
    <form onSubmit={submit} className="card space-y-4" aria-labelledby="login-h">
      <h1 id="login-h" className="text-xl font-semibold">Welcome back</h1>
      <Field label="Email" htmlFor="email">
        <input id="email" type="email" autoComplete="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Password" htmlFor="password">
        <input id="password" type="password" autoComplete="current-password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      <button className="btn btn-primary w-full" disabled={busy}>{busy ? <Spinner label="Signing in" /> : "Sign in"}</button>
      <p className="text-center text-sm text-muted">
        New here? <Link href="/register" className="font-medium text-brand underline">Create an account</Link>
      </p>
    </form>
  );
}
