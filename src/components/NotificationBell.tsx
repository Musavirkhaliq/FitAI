"use client";
import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { patch, useApi } from "@/lib/client/api";
import { clsx } from "@/components/ui";

interface N { id: string; kind: string; title: string; body: string; readAt: string | null; createdAt: string }

/** In-app reminders (each type can be switched off in Settings). Also shows a system notification if the user allowed it. */
export function NotificationBell() {
  const { data, refresh } = useApi<{ notifications: N[]; unread: number }>("/api/notifications");
  const [open, setOpen] = useState(false);
  const shown = useRef<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => void refresh(), 10 * 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (!data || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    for (const n of data.notifications.filter((x) => !x.readAt)) {
      if (!shown.current.has(n.id)) {
        shown.current.add(n.id);
        try {
          new Notification(n.title, { body: n.body, tag: n.id });
        } catch {
          /* some mobile browsers require a service worker */
        }
      }
    }
  }, [data]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unread = data?.unread ?? 0;
  const markAll = async () => {
    await patch("/api/notifications", { all: true });
    await refresh();
  };
  return (
    <div className="relative" ref={ref}>
      <button className="btn btn-ghost relative !min-h-[40px] !px-2.5" aria-label={unread ? `Reminders, ${unread} unread` : "Reminders"} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)}>
        <Bell className="h-5 w-5" aria-hidden />
        {unread > 0 && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-bad" aria-hidden />}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[90vw] rounded-xl2 border border-border bg-surface p-2 shadow-xl">
          <div className="flex items-center justify-between px-2 py-1">
            <p className="text-sm font-semibold">Reminders</p>
            {unread > 0 && <button className="text-xs text-brand underline" onClick={markAll}>Mark all read</button>}
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {(data?.notifications ?? []).length === 0 && <li className="px-2 py-4 text-sm text-muted">Nothing right now. Reminders can be tuned in Settings.</li>}
            {(data?.notifications ?? []).map((n) => (
              <li key={n.id} className={clsx("rounded-lg px-2 py-2 text-sm", !n.readAt && "bg-surface-2")}>
                <p className="font-medium">{n.title}</p>
                <p className="text-muted">{n.body}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
