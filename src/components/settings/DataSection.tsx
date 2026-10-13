"use client";
import { Brain, Download, LogOut, Trash2 } from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { Field, Sheet, Spinner } from "@/components/ui";
import { ApiError, del } from "@/lib/client/api";
import { DISCLAIMER_TEXT, MEDICAL_TEXT, SectionCard } from "./common";

const EXPORTS = [
  { type: "nutrition", label: "Nutrition" },
  { type: "weight", label: "Weight" },
  { type: "activity", label: "Activity" },
  { type: "workouts", label: "Workouts" },
  { type: "measurements", label: "Measurements" },
] as const;
const FORMATS = ["csv", "xlsx", "pdf"] as const;

export function DataSection() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  // Stable identity: Sheet re-focuses itself whenever onClose changes, which would steal focus while typing.
  const close = useCallback(() => {
    if (busy) return;
    setOpen(false);
    setTyped("");
    setError(null);
  }, [busy]);

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await del("/api/profile?confirm=DELETE");
      await signOut({ callbackUrl: "/login" });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "I couldn't delete your account. Please check your connection and try again. Nothing has been deleted.");
      setBusy(false);
    }
  };

  return (
    <SectionCard id="data-h" title="Your data" description="It's your data. Download it any time, or delete it all.">
      <div>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Download className="h-4 w-4" aria-hidden /> Export</h3>
        <ul className="divide-y divide-border rounded-xl border border-border">
          {EXPORTS.map((x) => (
            <li key={x.type} className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5">
              <span className="text-sm font-medium">{x.label}</span>
              <span className="flex gap-1">
                {FORMATS.map((f) => (
                  <a key={f} href={`/api/export?type=${x.type}&format=${f}`} download className="btn btn-ghost !min-h-[44px] !px-3 uppercase" aria-label={`Download ${x.label} as ${f.toUpperCase()}`}>{f}</a>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <Link href="/settings/memory" className="flex min-h-[44px] items-center gap-3 rounded-xl border border-border px-3 py-2 hover:bg-surface-2">
        <Brain className="h-5 w-5 text-brand" aria-hidden />
        <span>
          <span className="block font-medium">What your coach remembers</span>
          <span className="block text-sm text-muted">See, edit or delete anything the coach has noted about you.</span>
        </span>
      </Link>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn" disabled={signingOut} onClick={() => { setSigningOut(true); void signOut({ callbackUrl: "/login" }); }}>
          {signingOut ? <Spinner label="Signing out" /> : <LogOut className="h-4 w-4" aria-hidden />} Sign out
        </button>
        <button type="button" className="btn border-bad/50 text-bad" onClick={() => setOpen(true)}><Trash2 className="h-4 w-4" aria-hidden /> Delete my account and all data</button>
      </div>

      <div className="space-y-1 border-t border-border pt-3 text-xs text-muted">
        <p>{DISCLAIMER_TEXT}</p>
        <p>{MEDICAL_TEXT}</p>
      </div>

      <Sheet open={open} onClose={close} title="Delete your account?">
        <div className="space-y-3 text-sm">
          <p>This permanently deletes your account and everything in it: meals, weigh-ins, workouts, notes and what your coach remembers. It can&apos;t be undone.</p>
          <p>You may want to export your data first.</p>
          <Field label="Type DELETE to confirm" htmlFor="del-confirm">
            <input id="del-confirm" className="input" autoComplete="off" autoCapitalize="characters" value={typed} onChange={(e) => setTyped(e.target.value)} />
          </Field>
          {error && <p role="alert" className="text-bad">{error}</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" className="btn" onClick={close} disabled={busy}>Keep my account</button>
            <button type="button" className="btn border-transparent bg-bad text-white hover:opacity-90" disabled={typed !== "DELETE" || busy} onClick={() => void remove()}>
              {busy ? <><Spinner label="Deleting" /> Deleting…</> : "Delete everything"}
            </button>
          </div>
        </div>
      </Sheet>
    </SectionCard>
  );
}
