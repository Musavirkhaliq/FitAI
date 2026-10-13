"use client";
import { useId, useMemo, useState } from "react";
import { Segmented } from "@/components/ui";
import { POSE_LABEL, daysBetween, longDate, photoAlt, type PhotoDto, type Pose } from "./photoTypes";

const COMPARE_POSES: { value: Exclude<Pose, "OTHER">; label: string }[] = [
  { value: "FRONT", label: "Front" },
  { value: "SIDE", label: "Side" },
  { value: "BACK", label: "Back" },
];

const byAge = (a: PhotoDto, b: PhotoDto) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date));

function Side({ title, photo }: { title: string; photo: PhotoDto }) {
  return (
    <figure className="min-w-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.url} alt={photoAlt(photo)} loading="lazy" decoding="async" width={300} height={400}
        className="aspect-[3/4] w-full rounded-xl border border-border bg-surface-2 object-contain" />
      <figcaption className="mt-1 text-sm">
        <span className="font-medium">{title}:</span> {longDate(photo.date)}
        {photo.notes && <span className="block break-words text-xs text-muted">{photo.notes}</span>}
      </figcaption>
    </figure>
  );
}

export function PhotoCompare({ photos }: { photos: PhotoDto[] }) {
  const ids = { before: useId(), after: useId() };
  const [pose, setPose] = useState<Exclude<Pose, "OTHER">>("FRONT");
  const [beforeId, setBeforeId] = useState<string | null>(null);
  const [afterId, setAfterId] = useState<string | null>(null);

  const ofPose = useMemo(() => photos.filter((p) => p.pose === pose).sort(byAge), [photos, pose]);
  const all = useMemo(() => [...photos].sort(byAge), [photos]);
  const earliest = ofPose[0];
  const latest = ofPose[ofPose.length - 1];
  const before = photos.find((p) => p.id === beforeId) ?? (ofPose.length >= 2 ? earliest : undefined);
  const after = photos.find((p) => p.id === afterId) ?? (ofPose.length >= 2 ? latest : undefined);
  const customised = beforeId !== null || afterId !== null;

  const choosePose = (p: Exclude<Pose, "OTHER">) => {
    setPose(p);
    setBeforeId(null);
    setAfterId(null);
  };

  const gap = before && after ? daysBetween(before.date, after.date) : null;
  const gapText = gap == null ? "" : gap === 0 ? "Taken on the same day" : `${gap} ${gap === 1 ? "day" : "days"} apart`;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Compare</h3>
      <Segmented label="Pose to compare" value={pose} onChange={choosePose} options={COMPARE_POSES} />

      {photos.length >= 2 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor={ids.before}>Earlier photo</label>
            <select id={ids.before} className="input" value={before?.id ?? ""} onChange={(e) => setBeforeId(e.target.value || null)}>
              {!before && <option value="">Choose a photo</option>}
              {all.map((p) => <option key={p.id} value={p.id}>{longDate(p.date)}, {POSE_LABEL[p.pose]}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor={ids.after}>Later photo</label>
            <select id={ids.after} className="input" value={after?.id ?? ""} onChange={(e) => setAfterId(e.target.value || null)}>
              {!after && <option value="">Choose a photo</option>}
              {all.map((p) => <option key={p.id} value={p.id}>{longDate(p.date)}, {POSE_LABEL[p.pose]}</option>)}
            </select>
          </div>
        </div>
      )}
      {customised && (
        <button type="button" className="btn btn-ghost" onClick={() => { setBeforeId(null); setAfterId(null); }}>
          Reset to earliest and latest
        </button>
      )}

      {before && after && before.id !== after.id ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <Side title="Earlier" photo={before} />
            <Side title="Later" photo={after} />
          </div>
          <p role="status" aria-live="polite" className="text-sm text-muted">{gapText}. Lighting, posture and time of day change how photos look, so use them as one signal among many.</p>
        </div>
      ) : before && after ? (
        <p role="status" aria-live="polite" className="text-sm text-muted">Choose two different photos to compare.</p>
      ) : (
        <p role="status" aria-live="polite" className="text-sm text-muted">
          {ofPose.length === 0
            ? `You need at least two ${POSE_LABEL[pose].toLowerCase()} photos taken on different days to compare them. Add one above to get started.`
            : `You have one ${POSE_LABEL[pose].toLowerCase()} photo so far. Add another later, ideally in similar lighting, and you'll be able to compare them side by side.`}
        </p>
      )}
    </div>
  );
}
