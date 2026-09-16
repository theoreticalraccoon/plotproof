/**
 * ONNX inference in the browser. The only file here that touches the DOM, the
 * network or onnxruntime — everything else in `lib/grow/tea/` is pure so it can
 * be tested under plain Node.
 *
 * `onnxruntime-web` and the 6 MB model are both loaded LAZILY, on first
 * diagnosis rather than at import. Neither belongs in the bundle of a farmer who
 * only came to check whether to water.
 *
 * Every failure path resolves to a typed `error` prediction. Nothing here
 * throws into the UI, and nothing returns a fabricated class.
 */
import type { InferenceSession } from "onnxruntime-web";
import { MODEL_URL, loadTeaCard } from "./card";
import { preprocessFromImage } from "./preprocess";
import { decide } from "./predict";
import type { TeaModelCard, TeaPrediction } from "./types";

let sessionPromise: Promise<InferenceSession> | null = null;

async function getSession(): Promise<InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      // The "/wasm" subpath, not the default entry. The default pulls the JSEP
      // (WebGPU) runtime: 27 MB of WebAssembly on top of a 6 MB model, which on
      // a mid-range Android over a rural connection is the difference between a
      // usable feature and an abandoned download. This build is 13.6 MB and
      // loses nothing, because the session below pins executionProviders to
      // "wasm" and never touches WebGPU. Found by the /grow adversarial audit.
      const ort = await import("onnxruntime-web/wasm");
      // Single thread: a worker-threaded build needs cross-origin isolation
      // headers this app does not set.
      ort.env.wasm.numThreads = 1;
      return ort.InferenceSession.create(MODEL_URL, {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      });
    })().catch((e) => {
      // Reset so a transient failure (offline, cold CDN) can be retried rather
      // than poisoning every later attempt.
      sessionPromise = null;
      throw e;
    });
  }
  return sessionPromise;
}

/** Is the model plausibly usable? Used to decide whether to offer the camera. */
export async function teaModelAvailable(): Promise<boolean> {
  return (await loadTeaCard()) !== null;
}

export interface ClassifyResult {
  prediction: TeaPrediction;
  card: TeaModelCard | null;
  /** Wall-clock inference time, shown so a slow phone feels explained. */
  ms: number;
}

/**
 * Classify one decoded image.
 *
 * Takes an already-loaded element rather than a File so the caller can show a
 * preview of exactly what will be classified before committing to it.
 */
export async function classifyLeaf(
  source: HTMLImageElement | HTMLCanvasElement,
): Promise<ClassifyResult> {
  const started = performance.now();

  const card = await loadTeaCard();
  if (!card) {
    return {
      prediction: { state: "error", reason: "no_artifact" },
      card: null,
      ms: performance.now() - started,
    };
  }

  let tensorData: Float32Array;
  let size: number;
  try {
    const pre = preprocessFromImage(source, card.preprocessing);
    tensorData = pre.tensor;
    size = pre.size;
  } catch (e) {
    return {
      prediction: {
        state: "error",
        reason: "bad_image",
        detail: e instanceof Error ? e.message : undefined,
      },
      card,
      ms: performance.now() - started,
    };
  }

  try {
    const ort = await import("onnxruntime-web/wasm");
    const session = await getSession();
    const input = new ort.Tensor("float32", tensorData, [1, 3, size, size]);
    const outputs = await session.run({ [session.inputNames[0]]: input });
    const logits = Array.from(outputs[session.outputNames[0]].data as Float32Array);
    return { prediction: decide(logits, card), card, ms: performance.now() - started };
  } catch (e) {
    // Distinguish "could not load the model at all" from "the model ran and was
    // unsure" — the UI says different things, and conflating them would tell a
    // farmer to retake a photo when the real problem is a failed download.
    const detail = e instanceof Error ? e.message : String(e);
    const reason = sessionPromise === null ? "load_failed" : "inference_failed";
    return { prediction: { state: "error", reason, detail }, card, ms: performance.now() - started };
  }
}

/** Decode a user-selected file into an <img>. Rejects with a readable reason. */
export function decodeImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("not_an_image"));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      // The object URL is kept alive: revoking it here would blank the preview
      // the caller is about to render. The caller revokes on unmount.
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode_failed"));
    };
    img.src = url;
  });
}
