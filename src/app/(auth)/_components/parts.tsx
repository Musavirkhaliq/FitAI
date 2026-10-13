"use client";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Spinner } from "@/components/ui";

/** Official four-colour Google "G". Decorative: the button carries the text. */
function GoogleG() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}

/** Full-width Google button: a clear, neutral secondary action above the email form. */
export function GoogleButton({ onClick, busy, disabled }: { onClick: () => void; busy: boolean; disabled: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="btn w-full !min-h-[52px] !rounded-2xl !text-[0.95rem]">
      {busy ? (
        <Spinner label="Connecting to Google" />
      ) : (
        <>
          <GoogleG />
          <span>Continue with Google</span>
        </>
      )}
    </button>
  );
}

export function OrDivider({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3" role="separator">
      <span className="h-px flex-1 bg-border" aria-hidden />
      <span className="text-xs font-medium text-muted">{children}</span>
      <span className="h-px flex-1 bg-border" aria-hidden />
    </div>
  );
}

/** Calm inline error. Pass links/extra actions as children. */
export function AuthError({ message, children }: { message: string; children?: ReactNode }) {
  return (
    <div role="alert" className="pop flex items-start gap-2.5 rounded-2xl border border-bad/30 bg-bad/10 px-3.5 py-3 text-sm">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-bad" aria-hidden />
      <div className="min-w-0 space-y-1.5">
        <p>{message}</p>
        {children}
      </div>
    </div>
  );
}

/** Password input with a 44 px show/hide toggle. Keeps the browser's autofill hints. */
export function PasswordInput({ id, value, onChange, autoComplete, minLength }: {
  id: string; value: string; onChange: (v: string) => void; autoComplete: "current-password" | "new-password"; minLength?: number;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input
        id={id} type={shown ? "text" : "password"} autoComplete={autoComplete} required minLength={minLength}
        className="input !pr-14" value={value} onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button" onClick={() => setShown((s) => !s)} aria-pressed={shown} aria-label={shown ? "Hide password" : "Show password"}
        className="press absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-muted hover:text-fg"
      >
        {shown ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}
      </button>
    </div>
  );
}

/** The brand mark: gradient squircle with a soft glow. */
export function LogoMark({ className = "h-11 w-11" }: { className?: string }) {
  return (
    <span aria-hidden className={`grad-brand relative flex items-center justify-center rounded-[1.1rem] text-brand-fg shadow-float motion-safe:animate-breathe ${className}`} style={{ boxShadow: "var(--shadow-float), 0 0 28px -4px rgb(var(--brand-a) / 0.45)" }}>
      <span className="pointer-events-none absolute inset-0 rounded-[inherit]" style={{ background: "radial-gradient(120% 90% at 30% 10%, rgb(255 255 255 / 0.5), transparent 55%)" }} />
      <svg viewBox="0 0 24 24" className="relative h-[55%] w-[55%]" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    </span>
  );
}
