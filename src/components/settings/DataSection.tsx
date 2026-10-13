"use client";
import { Brain, FileDown, LogOut, Trash2 } from "lucide-react";
import { signOut } from "next-auth/react";
import { useCallback, useState } from "react";
import { Field, Sheet, Spinner } from "@/components/ui";
import { ApiError, del } from "@/lib/client/api";
import { DISCLAIMER_TEXT, MEDICAL_TEXT, Group, IconTile, Row } from "./common";

const EXPORTS = [
  { type: "nutrition", label: "Nutrition" },
  { type: "weight", label: "Weight" },
  { type: "activity", label: "Activity" },
  { type: "workouts", label: "Workouts" },
  { type: "measurements", label: "Measurements" },
] as const;
const FORMATS = ["csv", "xlsx", "pdf"] as const;

export function DataSection({ index = 0 }: { index?: number }) {
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
    <div>
    <div className="space-y-6">
      <Group id="data-h" title="Your data" index={index} description="It's your data. Download it any time, or delete it all.">
        {EXPORTS.map((x) => (
          <div key={x.type} className="flex min-h-[56px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5">
            <IconTile icon={FileDown} tint="protein" />
            <span className="min-w-0 flex-1 font-medium">{x.label}</span>
            <span className="flex gap-1">
              {FORMATS.map((f) => (
                <a key={f} href={`/api/export?type=${x.type}&format=${f}`} download className="press inline-flex min-h-[44px] min-w-[48px] items-center justify-center rounded-xl bg-surface-2 px-2.5 text-xs font-bold uppercase tracking-wide hover:bg-surface-3" aria-label={`Download ${x.label} as ${f.toUpperCase()}`}>{f}</a>
              ))}
            </span>
          </div>
        ))}
        <Row icon={Brain} tint="brand" label="What your coach remembers" hint="See, edit or delete anything the coach has noted about you." href="/settings/memory" />
      </Group>

      <Group id="account-h" title="Account" index={index + 1}>
        <Row
          icon={LogOut} tint="neutral" label="Sign out" disabled={signingOut}
          value={signingOut ? <Spinner label="Signing out" /> : undefined}
          onClick={() => { setSigningOut(true); void signOut({ callbackUrl: "/login" }); }}
        />
      </Group>

      <Group id="danger-h" title="Danger zone" tone="danger" index={index + 2} description="Deleting your account removes everything permanently. You may want to export your data first.">
        <Row icon={Trash2} tint="bad" danger label="Delete my account and all data" onClick={() => setOpen(true)} opens />
      </Group>

      <div className="space-y-1 px-2 text-xs leading-relaxed text-muted">
        <p>{DISCLAIMER_TEXT}</p>
        <p>{MEDICAL_TEXT}</p>
      </div>
    </div>

      <Sheet open={open} onClose={close} title="Delete your account?">
        <div className="space-y-3 text-sm">
          <p>This permanently deletes your account and everything in it: meals, weigh-ins, workouts, notes and what your coach remembers. It can&apos;t be undone.</p>
          <p>You may want to export your data first.</p>
          <Field label="Type DELETE to confirm" htmlFor="del-confirm">
            <input id="del-confirm" className="input" autoComplete="off" autoCapitalize="characters" value={typed} onChange={(e) => setTyped(e.target.value)} />
          </Field>
          {error && <p role="alert" className="rounded-2xl border border-bad/30 bg-bad/10 px-3.5 py-2.5 text-bad">{error}</p>}
          <div className="flex flex-col gap-2 pt-1 sm:flex-row-reverse">
            <button type="button" className="btn flex-1 !min-h-[52px] border-transparent bg-bad text-white hover:bg-bad hover:opacity-90 dark:text-bg" disabled={typed !== "DELETE" || busy} onClick={() => void remove()}>
              {busy ? <><Spinner label="Deleting" /> Deleting…</> : "Delete everything"}
            </button>
            <button type="button" className="btn btn-primary flex-1 !min-h-[52px]" onClick={close} disabled={busy}>Keep my account</button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
