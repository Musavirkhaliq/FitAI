/** Progress-photo helpers. Pure so they're easy to test; routes do auth and persistence. */

export const MAX_PHOTO_BYTES = 1_500_000; // the client downsizes to ~1024 px JPEG, which is far smaller
export const MAX_PHOTOS_PER_USER = 200;
export const POSES = ["FRONT", "SIDE", "BACK", "OTHER"] as const;
export type Pose = (typeof POSES)[number];

export type ImageMime = "image/jpeg" | "image/png" | "image/webp";

/** Identify the image type from its magic bytes. We never trust the client-declared Content-Type. */
export function sniffImage(buf: Uint8Array): ImageMime | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 && buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a) return "image/png";
  const riff = String.fromCharCode(...buf.subarray(0, 4));
  const webp = String.fromCharCode(...buf.subarray(8, 12));
  if (riff === "RIFF" && webp === "WEBP") return "image/webp";
  return null;
}
