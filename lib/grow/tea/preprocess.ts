/** Deterministic preprocessing, driven entirely by the card's constants. */
import type { CardPreprocessing } from "./types";

/** Raw pixels as a canvas (or a test) provides them: RGBA, row-major. */
export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8ClampedArray; // length = width * height * 4
}

export interface PreprocessResult {
  /** CHW float32, length 3 * size * size. */
  tensor: Float32Array;
  size: number;
}

/** Geometry of the resize+centre-crop, as a pure function. */
export function cropGeometry(width: number, height: number, prep: CardPreprocessing) {
  const shorter = Math.min(width, height);
  const scale = prep.resize_shorter_side_to / shorter;
  const scaledW = Math.max(1, Math.round(width * scale));
  const scaledH = Math.max(1, Math.round(height * scale));
  const size = prep.image_size;
  return {
    scale,
    scaledW,
    scaledH,
    size,
    // Centre crop. Clamped at 0 so a degenerate input cannot produce a negative offset and read
    // outside the buffer.
    left: Math.max(0, Math.floor((scaledW - size) / 2)),
    top: Math.max(0, Math.floor((scaledH - size) / 2)),
  };
}

/** Nearest-neighbour sample of the resized+cropped region, then normalise. */
export function preprocessRgba(img: RgbaImage, prep: CardPreprocessing): PreprocessResult {
  const g = cropGeometry(img.width, img.height, prep);
  const size = g.size;
  const out = new Float32Array(3 * size * size);
  const [mr, mg, mb] = prep.mean;
  const [sr, sg, sb] = prep.std;
  const plane = size * size;

  for (let y = 0; y < size; y++) {
    // Map destination pixel -> source pixel through the crop and the resize.
    const srcY = Math.min(img.height - 1, Math.floor((g.top + y) / g.scale));
    for (let x = 0; x < size; x++) {
      const srcX = Math.min(img.width - 1, Math.floor((g.left + x) / g.scale));
      const si = (srcY * img.width + srcX) * 4;
      const di = y * size + x;
      out[di] = (img.data[si] / 255 - mr) / sr;
      out[plane + di] = (img.data[si + 1] / 255 - mg) / sg;
      out[2 * plane + di] = (img.data[si + 2] / 255 - mb) / sb;
    }
  }
  return { tensor: out, size };
}

/** Production path: let the canvas do the resampling, then normalise. */
export function preprocessFromImage(
  source: CanvasImageSource & { width: number; height: number },
  prep: CardPreprocessing,
): PreprocessResult {
  const w = source.width;
  const h = source.height;
  if (!w || !h) throw new Error("Image has zero width or height");

  const size = prep.image_size;
  const shorter = Math.min(w, h);
  // Source rectangle: the centre square that, once scaled to the model's input, reproduces
  // resize-shorter-side + centre-crop.
  const srcSide = (shorter * size) / prep.resize_shorter_side_to;
  const sx = (w - srcSide) / 2;
  const sy = (h - srcSide) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, sx, sy, srcSide, srcSide, 0, 0, size, size);

  const { data } = ctx.getImageData(0, 0, size, size);
  const out = new Float32Array(3 * size * size);
  const [mr, mg, mb] = prep.mean;
  const [sr, sg, sb] = prep.std;
  const plane = size * size;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    out[p] = (data[i] / 255 - mr) / sr;
    out[plane + p] = (data[i + 1] / 255 - mg) / sg;
    out[2 * plane + p] = (data[i + 2] / 255 - mb) / sb;
  }
  return { tensor: out, size };
}
