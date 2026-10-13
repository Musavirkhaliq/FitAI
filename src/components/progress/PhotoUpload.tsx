"use client";
import { Camera, Loader2 } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Field } from "@/components/ui";
import { ApiError, api, isOfflineError, notifyChanged } from "@/lib/client/api";
import { todayLocal } from "@/lib/client/format";
import { resizeToJpeg } from "./imageResize";
import { POSE_OPTIONS, type Pose } from "./photoTypes";

type Status = { kind: "idle" } | { kind: "preparing" } | { kind: "uploading" } | { kind: "saved" } | { kind: "error"; message: string };

export function PhotoUpload({ atLimit }: { atLimit?: boolean }) {
  const ids = { file: useId(), pose: useId(), date: useId(), note: useId() };
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
      reset();
      setStatus({ kind: "saved" });
    } catch (err) {
      const message = isOfflineError(err)
        ? "You seem to be offline. Your photo is ready, so try again when you're back online."
        : err instanceof ApiError ? err.message : "I couldn't upload that photo. Please try again.";
      setStatus({ kind: "error", message });
    }
  };

  const busy = status.kind === "preparing" || status.kind === "uploading";

  return (
    <form onSubmit={submit} className="space-y-3" aria-labelledby={`${ids.file}-h`}>
      <h3 id={`${ids.file}-h`} className="text-sm font-semibold">Add a photo</h3>
      {atLimit && <p className="text-sm text-muted">You&apos;ve reached the photo limit. Delete some older photos to add new ones.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Photo" htmlFor={ids.file} hint="JPEG, PNG or WebP. It's resized on your device before it's uploaded.">
            <input ref={fileRef} id={ids.file} type="file" accept="image/*" disabled={busy || atLimit}
              onChange={(e) => void onFile(e.target.files?.[0])}
              className="input py-2 file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-sm file:font-medium" />
          </Field>
        </div>
        <Field label="Pose" htmlFor={ids.pose}>
          <select id={ids.pose} className="input" value={pose} onChange={(e) => setPose(e.target.value as Pose)} disabled={busy}>
            {POSE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Date" htmlFor={ids.date}>
          <input id={ids.date} type="date" className="input" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} disabled={busy} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Note (optional)" htmlFor={ids.note}>
            <input id={ids.note} type="text" className="input" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} placeholder="For example: morning, same lighting" />
          </Field>
        </div>
      </div>

      {preview && (
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Preview of the photo you chose" className="h-32 w-24 rounded-xl border border-border bg-surface-2 object-cover" />
          <p className="text-sm text-muted">
            Ready to save{blob ? ` (${Math.max(1, Math.round(blob.size / 1024))} KB)` : ""}. Only you can see it.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={!blob || busy || atLimit}>
          {status.kind === "uploading" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Camera className="h-4 w-4" aria-hidden />}
          {status.kind === "uploading" ? "Saving…" : status.kind === "error" && blob ? "Try again" : "Save photo"}
        </button>
        <p role="status" aria-live="polite" className={status.kind === "error" ? "text-sm text-bad" : "text-sm text-muted"}>
          {status.kind === "preparing" && "Preparing your photo…"}
          {status.kind === "uploading" && "Uploading…"}
          {status.kind === "saved" && "Photo saved."}
          {status.kind === "error" && status.message}
        </p>
      </div>
    </form>
  );
}
