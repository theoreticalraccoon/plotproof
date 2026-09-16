/**
 * Deterministic preprocessing, driven entirely by the card's constants.
 *
 * This must reproduce what `ml/tea/train.py` did at evaluation time:
 *   Resize(shorter side -> resize_shorter_side_to) -> CenterCrop(image_size)
 *   -> /255 -> normalise(mean, std) -> CHW float32
 *
 * If this and the training transform disagree, nothing else fails — the model
 * simply gets quietly worse, which is the hardest kind of bug to notice. So the
 * resize/crop arithmetic lives here as a pure function over raw RGBA pixels and
 * is unit-tested, separate from any canvas or DOM.
 */
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

/**
 * Geometry of the resize+centre-crop, as a pure function.
 *
 * Returned separately from the pixel work so the arithmetic can be tested
 * without constructing images, and so the preview can draw the same crop the
 * model will actually see.
 */
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
    // Centre crop. Clamped at 0 so a degenerate input cannot produce a negative
    // offset and read outside the buffer.
    left: Math.max(0, Math.floor((scaledW - size) / 2)),
    top: Math.max(0, Math.floor((scaledH - size) / 2)),
  };
}

/**
 * Nearest-neighbour sample of the resized+cropped region, then normalise.
 *
 * Nearest-neighbour rather than bilinear is a deliberate, documented
 * divergence: torchvision's eval transform uses bilinear. The browser path
 * normally resizes with the canvas (which IS smooth), and this function is the
 * fallback for raw pixel input and for tests. `preprocessFromCanvas` below is
 * the production path and uses the canvas's own interpolation.
 */
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

/**
 * Production path: let the canvas do the resampling, then normalise.
 *
 * Drawing straight into a size x size canvas with the computed source rectangle
 * does the resize and the centre crop in one step, using the browser's own
 * smooth interpolation — much closer to torchvision's bilinear than the
 * nearest-neighbour fallback above.
 *
 * Browser-only. Throws on a zero-dimension image so the caller can report
 * "bad_image" rather than feeding the model an empty tensor.
 */
export function preprocessFromImage(
  source: CanvasImageSource & { width: number; height: number },
  prep: CardPreprocessing,
): PreprocessResult {
  const w = source.width;
  const h = source.height;
  if (!w || !h) throw new Error("Image has zero width or height");

  const size = prep.image_size;
  const shorter = Math.min(w, h);
  // Source rectangle: the centre square that, once scaled to the model's input,
  // reproduces resize-shorter-side + centre-crop.
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
