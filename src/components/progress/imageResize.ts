"use client";

/** Browser-side downscale + re-encode so progress photos upload small (and EXIF location data is dropped). */

export const MAX_EDGE = 1024;
export const JPEG_QUALITY = 0.82;

type Drawable = { source: CanvasImageSource; width: number; height: number; release: () => void };

async function decode(file: Blob): Promise<Drawable> {
  if (typeof createImageBitmap === "function") {
    try {
      // "from-image" applies the EXIF orientation so phone photos aren't sideways.
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, release: () => bmp.close() };
    } catch {
      // fall through to the <img> path
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("I couldn't read that image. Please choose a JPEG, PNG or WebP photo.");
  }
}

/** Returns a JPEG blob whose long edge is at most MAX_EDGE px. */
export async function resizeToJpeg(file: Blob): Promise<Blob> {
  const img = await decode(file);
  try {
    if (!img.width || !img.height) throw new Error("That image looks empty. Please try another photo.");
    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser can't prepare photos. Please try a different browser.");
    ctx.fillStyle = "#ffffff"; // JPEG has no alpha: flatten transparent PNG/WebP onto white
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img.source, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob) throw new Error("I couldn't prepare that photo. Please try another one.");
    return blob;
  } finally {
    img.release();
  }
}
