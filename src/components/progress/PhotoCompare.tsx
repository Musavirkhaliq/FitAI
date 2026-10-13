"use client";
import { ChevronsLeftRight } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Segmented } from "@/components/ui";
import { POSE_LABEL, daysBetween, longDate, photoAlt, type PhotoDto, type Pose } from "./photoTypes";

const COMPARE_POSES: { value: Exclude<Pose, "OTHER">; label: string }[] = [
  { value: "FRONT", label: "Front" },
  { value: "SIDE", label: "Side" },
  { value: "BACK", label: "Back" },
];

type View = "slide" | "side";
const VIEWS: { value: View; label: string }[] = [
  { value: "slide", label: "Slider" },
  { value: "side", label: "Side by side" },
];

const byAge = (a: PhotoDto, b: PhotoDto) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date));

function Side({ title, photo }: { title: string; photo: PhotoDto }) {
  return (
    <figure className="min-w-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.url} alt={photoAlt(photo)} loading="lazy" decoding="async" width={300} height={400}
        className="aspect-[3/4] w-full rounded-[1.25rem] border border-border bg-surface-2 object-cover" />
      <figcaption className="mt-1.5 text-sm">
        <span className="font-semibold">{title}:</span> {longDate(photo.date)}
        {photo.notes && <span className="block break-words text-xs text-muted">{photo.notes}</span>}
      </figcaption>
    </figure>
  );
}

/** Drag-to-reveal comparison: the earlier photo is clipped over the later one. A real range input drives it, so it works by keyboard and screen reader. */
function Slider({ before, after }: { before: PhotoDto; after: PhotoDto }) {
  const [pos, setPos] = useState(50);
  const id = useId();
  return (
    <div className="space-y-2">
      <div className="relative mx-auto aspect-[3/4] w-full max-w-sm select-none overflow-hidden rounded-[1.5rem] border border-border bg-surface-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={after.url} alt={photoAlt(after)} decoding="async" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={before.url} alt={photoAlt(before)} decoding="async" draggable={false} className="absolute inset-0 h-full w-full object-cover" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />
        <span aria-hidden className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.25)]" style={{ left: `${pos}%` }} />
        <span aria-hidden className="pointer-events-none absolute top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black shadow-float" style={{ left: `${pos}%` }}>
          <ChevronsLeftRight className="h-5 w-5" />
        </span>
        <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">Earlier · {longDate(before.date)}</span>
        <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">Later · {longDate(after.date)}</span>
      </div>
      <div className="mx-auto max-w-sm">
        <label htmlFor={id} className="sr-only">Slide to compare the earlier and later photo</label>
        <input
          id={id} type="range" min={0} max={100} step={1} value={pos} onChange={(e) => setPos(Number(e.target.value))}
          aria-valuetext={`${pos}% of the earlier photo showing`}
          className="h-12 w-full cursor-ew-resize accent-[rgb(var(--brand))]"
        />
      </div>
    </div>
  );
}

export function PhotoCompare({ photos }: { photos: PhotoDto[] }) {
  const ids = { before: useId(), after: useId() };
  const [pose, setPose] = useState<Exclude<Pose, "OTHER">>("FRONT");
  const [view, setView] = useState<View>("slide");
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="display text-base font-bold">Compare</h3>
        <Segmented label="Pose to compare" value={pose} onChange={choosePose} options={COMPARE_POSES} />
      </div>

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
        <div className="space-y-3">
          <Segmented<View> label="Comparison view" value={view} onChange={setView} options={VIEWS} />
          {view === "slide" ? (
            <Slider before={before} after={after} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Side title="Earlier" photo={before} />
              <Side title="Later" photo={after} />
            </div>
          )}
          <p role="status" aria-live="polite" className="text-sm text-muted">{gapText}. Lighting, posture and time of day change how photos look, so use them as one signal among many.</p>
        </div>
      ) : before && after ? (
        <p role="status" aria-live="polite" className="text-sm text-muted">Choose two different photos to compare.</p>
      ) : (
        <p role="status" aria-live="polite" className="rounded-2xl bg-surface-2 px-3.5 py-3 text-sm text-muted">
          {ofPose.length === 0
            ? `You need at least two ${POSE_LABEL[pose].toLowerCase()} photos taken on different days to compare them. Add one to get started.`
            : `You have one ${POSE_LABEL[pose].toLowerCase()} photo so far. Add another later, ideally in similar lighting, and you'll be able to compare them side by side.`}
        </p>
      )}
    </div>
  );
}
