"use client";
import { Camera, Lock } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ErrorState, Notice, Sheet, Skeleton } from "@/components/ui";
import { useApi } from "@/lib/client/api";
import { PhotoCompare } from "./PhotoCompare";
import { PhotoGallery } from "./PhotoGallery";
import { PhotoUpload } from "./PhotoUpload";
import type { PhotosDto } from "./photoTypes";

const LIMIT = 200;

export function ProgressPhotos() {
  const api = useApi<PhotosDto>("/api/photos");
  const photos = api.data?.photos;
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!saved) return;
    const t = window.setTimeout(() => setSaved(false), 6000);
    return () => window.clearTimeout(t);
  }, [saved]);

  const addButton = (
    <button className="btn btn-primary" onClick={() => { setSaved(false); setOpen(true); }}>
      <Camera className="h-4 w-4" aria-hidden /> Add a photo
    </button>
  );

  return (
    <>
      <section className="card rise space-y-5" aria-labelledby="photos-h">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="photos-h" className="display text-lg font-extrabold">Progress photos</h2>
            <p className="mt-1 flex items-start gap-2 text-sm text-muted">
              <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>Optional and private. Photos are stored only in your account, visible only to you, can be deleted any time, and are deleted if you delete your account.</span>
            </p>
          </div>
          {photos && photos.length > 0 && <div className="shrink-0">{addButton}</div>}
        </div>

        <div aria-live="polite">{saved && <Notice tone="good">Photo saved.</Notice>}</div>

        {api.loading && !photos ? (
          <div role="status" aria-live="polite" className="space-y-3">
            <span className="sr-only">Loading photos…</span>
            <Skeleton className="h-12" />
            <div className="grid grid-cols-2 gap-3"><Skeleton className="aspect-[3/4]" /><Skeleton className="aspect-[3/4]" /></div>
          </div>
        ) : photos ? (
          <>
            <PhotoCompare photos={photos} />
            <div className="space-y-2">
              <h3 className="display text-base font-bold">Your photos</h3>
              <PhotoGallery photos={photos} emptyAction={addButton} onDeleted={(id) => api.setData((prev) => (prev ? { photos: prev.photos.filter((p) => p.id !== id) } : prev))} />
            </div>
          </>
        ) : (
          <ErrorState message={api.error ?? "I couldn't load your photos."} onRetry={() => void api.refresh()} />
        )}
      </section>

      <Sheet open={open} onClose={close} title="Add a photo">
        <PhotoUpload atLimit={(photos?.length ?? 0) >= LIMIT} onSaved={() => { setOpen(false); setSaved(true); }} />
      </Sheet>
    </>
  );
}
