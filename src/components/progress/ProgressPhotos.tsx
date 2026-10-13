"use client";
import { Lock } from "lucide-react";
import { ErrorState, LoadingBlock } from "@/components/ui";
import { useApi } from "@/lib/client/api";
import { PhotoCompare } from "./PhotoCompare";
import { PhotoGallery } from "./PhotoGallery";
import { PhotoUpload } from "./PhotoUpload";
import type { PhotosDto } from "./photoTypes";

const LIMIT = 200;

export function ProgressPhotos() {
  const api = useApi<PhotosDto>("/api/photos");
  const photos = api.data?.photos;

  return (
    <section className="card space-y-5" aria-labelledby="photos-h">
      <div>
        <h2 id="photos-h" className="text-sm font-semibold">Progress photos</h2>
        <p className="mt-1 flex items-start gap-2 text-sm text-muted">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>Optional and private. Photos are stored only in your account, visible only to you, can be deleted any time, and are deleted if you delete your account.</span>
        </p>
      </div>

      <PhotoUpload atLimit={(photos?.length ?? 0) >= LIMIT} />

      {api.loading && !photos ? (
        <LoadingBlock label="Loading photos" rows={2} />
      ) : photos ? (
        <>
          <PhotoCompare photos={photos} />
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Your photos</h3>
            <PhotoGallery photos={photos} onDeleted={(id) => api.setData((prev) => (prev ? { photos: prev.photos.filter((p) => p.id !== id) } : prev))} />
          </div>
        </>
      ) : (
        <ErrorState message={api.error ?? "I couldn't load your photos."} onRetry={() => void api.refresh()} />
      )}
    </section>
  );
}
