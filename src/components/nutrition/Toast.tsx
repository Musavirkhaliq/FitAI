"use client";
import { Check, CloudOff, Undo2, X } from "lucide-react";
import { useEffect } from "react";
import { clsx } from "@/components/ui";

export interface ToastData {
  id: number;
  tone: "good" | "warn";
  text: string;
  action?: { label: string; onClick: () => void };
  /** How long it stays, in ms. */
  ms?: number;
}

/**
 * Snackbar above the tab bar (bottom third, clear of the docked orb). The live region is always mounted so screen readers
 * announce each new message; the visible card dismisses itself.
 */
export function Toast({ toast, onDismiss }: { toast: ToastData | null; onDismiss: (id: number) => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => onDismiss(toast.id), toast.ms ?? (toast.action ? 6500 : 4200));
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4.6rem)] z-[45] flex justify-center md:inset-x-auto md:bottom-6 md:left-72 md:justify-start"
    >
      {toast && (
        <div key={toast.id} className="pop glass pointer-events-auto flex w-full max-w-md items-center gap-2.5 rounded-2xl border border-border py-1.5 pl-3.5 pr-1.5 shadow-float">
          {toast.tone === "good" ? <Check className="h-[18px] w-[18px] shrink-0 text-good" aria-hidden /> : <CloudOff className="h-[18px] w-[18px] shrink-0 text-warn" aria-hidden />}
          <p className="min-w-0 flex-1 py-1.5 text-sm font-medium leading-snug">{toast.text}</p>
          {toast.action && (
            <button
              type="button"
              className="press inline-flex min-h-[48px] items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-brand"
              onClick={() => { toast.action?.onClick(); onDismiss(toast.id); }}
            >
              <Undo2 className="h-4 w-4" aria-hidden /> {toast.action.label}
            </button>
          )}
          <button type="button" className={clsx("press inline-flex h-12 w-10 items-center justify-center rounded-xl text-muted hover:text-fg", toast.action && "hidden sm:inline-flex")} aria-label="Dismiss message" onClick={() => onDismiss(toast.id)}>
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
