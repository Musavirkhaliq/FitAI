import { fmtDay } from "@/lib/client/format";

export type Pose = "FRONT" | "SIDE" | "BACK" | "OTHER";

export interface PhotoDto {
  id: string;
  date: string; // YYYY-MM-DD
  pose: Pose;
  notes: string | null;
  size: number;
  mime: string;
  createdAt: string;
  url: string;
}

export interface PhotosDto {
  photos: PhotoDto[];
}

export const POSE_LABEL: Record<Pose, string> = { FRONT: "Front", SIDE: "Side", BACK: "Back", OTHER: "Other" };
export const POSE_OPTIONS: { value: Pose; label: string }[] = [
  { value: "FRONT", label: "Front" },
  { value: "SIDE", label: "Side" },
  { value: "BACK", label: "Back" },
  { value: "OTHER", label: "Other" },
];

/** "12 Oct 2026" */
export const longDate = (date: string) => fmtDay(date, { day: "numeric", month: "short", year: "numeric" });

/** "Front photo, 12 Oct 2026" */
export const photoAlt = (p: Pick<PhotoDto, "pose" | "date">) => `${POSE_LABEL[p.pose]} photo, ${longDate(p.date)}`;

export const daysBetween = (a: string, b: string) => {
  const t = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round(Math.abs(t(b) - t(a)) / 86_400_000);
};
