"use client";
import { Camera, ImagePlus, Loader2 } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Field, haptic, Segmented } from "@/components/ui";
import { ApiError, api, isOfflineError, notifyChanged } from "@/lib/client/api";
import { todayLocal } from "@/lib/client/format";
import { resizeToJpeg } from "./imageResize";
import { POSE_OPTIONS, type Pose } from "./photoTypes";

type Status = { kind: "idle" } | { kind: "preparing" } | { kind: "uploading" } | { kind: "saved" } | { kind: "error"; message: string };

/** Add-a-photo form (lives in a Sheet). `onSaved` fires after a successful upload so the host can close the sheet. */
export function PhotoUpload({ atLimit, onSaved }: { atLimit?: boolean; onSaved?: () => void }) {
  const ids = { file: useId(), date: useId(), note: useId() };
  const fileRef = useRef<HTMLInputElement>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pose, setPose] = useState<Pose>("FRONT");
  const [date, setDate] = useState(todayLocal);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const picks = useRef(0);

  // Release the preview object URL when it's replaced or the component goes away.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const onFile = async (file: File | undefined) => {
    const pick = ++picks.current;
    setBlob(null);
    setPreview(null);
    if (!file) {
      setStatus({ kind: "idle" });
      return;
    }
    setStatus({ kind: "preparing" });
    try {
      const out = await resizeToJpeg(file);
      if (pick !== picks.current) return;
      setBlob(out);
      setPreview(URL.createObjectURL(out));
      setStatus({ kind: "idle" });
    } catch (e) {
      if (pick !== picks.current) return;
      setStatus({ kind: "error", message: e instanceof Error ? e.message : "I couldn't prepare that photo. Please try another one." });
    }
  };

  const reset = () => {
    picks.current++;
    setBlob(null);
    setPreview(null);
    setNote("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!blob || status.kind === "uploading") return;
    setStatus({ kind: "uploading" });
    const form = new FormData();
    form.append("file", blob, "progress.jpg");
    form.append("date", date || todayLocal());
    form.append("pose", pose);
    if (note.trim()) form.append("notes", note.trim());
    try {
      await api("/api/photos", { method: "POST", body: form });
      notifyChanged();
      haptic("success");
      reset();
      setStatus({ kind: "saved" });
      onSaved?.();
    } catch (err) {
      const message = isOfflineError(err)
        ? "You seem to be offline. Your photo is ready, so try again when you're back online."
        : err instanceof ApiError ? err.message : "I couldn't upload that photo. Please try again.";
      setStatus({ kind: "error", message });
    }
  };

  const busy = status.kind === "preparing" || status.kind === "uploading";

  return (
    <form onSubmit={submit} className="space-y-4" aria-label="Add a photo">
      {atLimit && <p className="text-sm text-muted">You&apos;ve reached the photo limit. Delete some older photos to add new ones.</p>}

      <div>
        <p className="label">Photo</p>
        <input ref={fileRef} id={ids.file} type="file" accept="image/*" disabled={busy || atLimit} onChange={(e) => void onFile(e.target.files?.[0])} className="peer sr-only" />
        <label
          htmlFor={ids.file}
          className="press flex min-h-[120px] cursor-pointer items-center justify-center gap-4 rounded-[1.5rem] border-2 border-dashed border-border bg-surface-2 p-4 text-center transition-colors hover:bg-surface-3 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand peer-disabled:cursor-not-allowed peer-disabled:opacity-50"
        >
          {preview ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Preview of the photo you chose" className="h-28 w-[5.25rem] rounded-xl border border-border bg-surface object-cover" />
              <span className="text-left text-sm">
                <span className="block font-semibold">Ready to save{blob ? ` (${Math.max(1, Math.round(blob.size / 1024))} KB)` : ""}</span>
                <span className="block text-muted">Only you can see it. Tap to choose a different one.</span>
              </span>
            </>
          ) : (
            <span className="flex flex-col items-center gap-1.5 text-sm">
              <ImagePlus className="h-7 w-7 text-muted" aria-hidden />
              <span className="font-semibold">Choose a photo</span>
              <span className="text-xs text-muted">JPEG, PNG or WebP. Resized on your device before it&apos;s uploaded.</span>
            </span>
          )}
        </label>
      </div>

      <div>
        <p className="label">Pose</p>
        <Segmented<Pose> label="Pose" value={pose} onChange={setPose} options={POSE_OPTIONS} />
      </div>

      <Field label="Date" htmlFor={ids.date}>
        <input id={ids.date} type="date" className="input" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} disabled={busy} />
      </Field>
      <Field label="Note (optional)" htmlFor={ids.note}>
        <input id={ids.note} type="text" className="input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} placeholder="For example: morning, same lighting" />
      </Field>

      <button type="submit" className="btn btn-primary w-full !min-h-[52px] text-base" disabled={!blob || busy || atLimit}>
        {status.kind === "uploading" ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Camera className="h-5 w-5" aria-hidden />}
        {status.kind === "uploading" ? "Saving…" : status.kind === "error" && blob ? "Try again" : "Save photo"}
      </button>
      <p role="status" aria-live="polite" className={status.kind === "error" ? "text-sm text-bad" : "text-sm text-muted"}>
        {status.kind === "preparing" && "Preparing your photo…"}
        {status.kind === "uploading" && "Uploading…"}
        {status.kind === "error" && status.message}
      </p>
    </form>
  );
}
