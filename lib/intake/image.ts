/**
 * Client-side image processing for attestation photos. Runs on the phone before
 * anything is stored, because a raw camera shot is 4–8 MB and hundreds of those
 * would fill the device (DECISIONS.md D-009).
 *
 * Downscaling + JPEG re-encode also strips EXIF (including camera GPS), which is
 * a privacy win — we attach our OWN geolocation reading as data instead of
 * trusting embedded EXIF.
 *
 * Browser-only (uses canvas / createImageBitmap).
 */
export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
  bytes: number;
  mimeType: string;
}

const MAX_EDGE = 1600; // long-edge pixels; plenty to read a plot in the PDF
const JPEG_QUALITY = 0.72; // ~150–350 KB per photo in practice

/** Downscale and re-encode a captured image to a small JPEG. */
export async function processPhoto(
  input: Blob,
  maxEdge = MAX_EDGE,
  quality = JPEG_QUALITY,
): Promise<ProcessedImage> {
  // `from-image` applies the EXIF orientation so portrait shots aren't rotated.
  const bitmap = await createImageBitmap(input, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await canvasToBlob(canvas, "image/jpeg", quality);
  return { blob, width, height, bytes: blob.size, mimeType: "image/jpeg" };
}

/** Encode a signature/thumbprint canvas as a compact PNG (line art). */
export async function canvasToPng(canvas: HTMLCanvasElement): Promise<ProcessedImage> {
  const blob = await canvasToBlob(canvas, "image/png", 1);
  return {
    blob,
    width: canvas.width,
    height: canvas.height,
    bytes: blob.size,
    mimeType: "image/png",
  };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Image encoding failed."))),
      type,
      quality,
    );
  });
}
