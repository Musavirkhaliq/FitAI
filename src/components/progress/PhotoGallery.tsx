"use client";
import { Camera, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EmptyState } from "@/components/ui";
import { ApiError, del, notifyChanged } from "@/lib/client/api";
import { POSE_LABEL, longDate, photoAlt, type PhotoDto } from "./photoTypes";

interface Props {
  photos: PhotoDto[];
  /** Called after a successful delete so the list updates immediately. */
  onDeleted: (id: string) => void;
  /** Optional action shown inside the empty state (opens the add-photo sheet). */
  emptyAction?: ReactNode;
}

export function PhotoGallery({ photos, onDeleted, emptyAction }: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; bad: boolean } | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirmId) cancelRef.current?.focus();
  }, [confirmId]);

  const groups = useMemo(() => {
    const byDate = new Map<string, PhotoDto[]>();
    for (const p of photos) byDate.set(p.date, [...(byDate.get(p.date) ?? []), p]);
    return [...byDate.entries()].sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0));
  }, [photos]);

  const remove = async (p: PhotoDto) => {
    setBusyId(p.id);
    setMessage(null);
    try {
      await del(`/api/photos?id=${encodeURIComponent(p.id)}`);
      onDeleted(p.id);
      notifyChanged();
      setConfirmId(null);
      setMessage({ text: "Photo deleted.", bad: false });
    } catch (e) {
      setMessage({ text: e instanceof ApiError ? e.message : "I couldn't delete that photo. Please try again.", bad: true });
    } finally {
      setBusyId(null);
    }
  };

  if (photos.length === 0) {
    return (
      <EmptyState
        icon={<Camera className="h-7 w-7" />}
        title="No photos yet. Add one whenever you like."
        body="Photos are completely optional. If you'd like a visual record, take them in the same spot with similar lighting, at a similar time of day, standing relaxed in the same pose. Every few weeks is plenty."
        action={emptyAction}
      />
    );
  }

  return (
    <div className="space-y-5">
      <p role="status" aria-live="polite" className={message?.bad ? "text-sm text-bad" : "text-sm text-muted"}>{message?.text ?? ""}</p>
      {groups.map(([date, items]) => (
        <section key={date} aria-label={`Photos from ${longDate(date)}`}>
          <h4 className="eyebrow mb-2">{longDate(date)}</h4>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((p) => (
              <li key={p.id} className="flex flex-col gap-2">
                <div className="relative overflow-hidden rounded-[1.25rem] border border-border bg-surface-2">
                  <a href={p.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${photoAlt(p)} full size, opens in a new tab`} className="press block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={photoAlt(p)} loading="lazy" decoding="async" width={300} height={400} className="aspect-[3/4] w-full object-cover" />
                  </a>
                  <span className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">{POSE_LABEL[p.pose]}</span>
                  {confirmId !== p.id && (
                    <button
                      type="button"
                      className="press glass absolute right-1.5 top-1.5 flex h-12 w-12 items-center justify-center rounded-full border border-border"
                      onClick={() => { setMessage(null); setConfirmId(p.id); }}
                      aria-label={`Delete ${photoAlt(p)}`}
                    >
                      <Trash2 className="h-[18px] w-[18px]" aria-hidden />
                    </button>
                  )}
                </div>
                {p.notes && <p className="break-words px-1 text-xs text-muted">{p.notes}</p>}
                {confirmId === p.id && (
                  <div role="group" aria-label="Confirm delete" className="space-y-2 rounded-2xl border border-bad/40 bg-bad/10 p-3 text-sm">
                    <p>Delete this photo? This can&apos;t be undone.</p>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn border-bad/60 text-bad" disabled={busyId === p.id} onClick={() => void remove(p)}>
                        {busyId === p.id ? "Deleting…" : "Yes, delete"}
                      </button>
                      <button ref={cancelRef} type="button" className="btn" disabled={busyId === p.id} onClick={() => setConfirmId(null)}>Cancel</button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
