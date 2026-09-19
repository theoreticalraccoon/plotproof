// ONNX inference in the browser. The only file here that touches the DOM, the network or
// onnxruntime, everything else in `lib/grow/tea/` is pure so it can be tested under plain Node.
import type { InferenceSession } from "onnxruntime-web";
import { MODEL_URL, loadTeaCard } from "./card";
import { preprocessFromImage } from "./preprocess";
import { decide } from "./predict";
import type { RuntimeFacts } from "./diagnostics";
import type { TeaModelCard, TeaPrediction } from "./types";

/** The onnxruntime-web entry point actually imported. Reported, never assumed. */
const ORT_BUILD = "onnxruntime-web/wasm";
const ORT_THREADS = 1;

let sessionPromise: Promise<InferenceSession> | null = null;
/** Cost of importing the runtime and building the session, measured once. */
let sessionInitMs: number | null = null;

async function getSession(): Promise<InferenceSession> {
  if (!sessionPromise) {
    const startedInit = performance.now();
    sessionPromise = (async () => {
      // The "/wasm" subpath, not the default entry.
      const ort = await import("onnxruntime-web/wasm");
      // Single thread: a worker-threaded build needs cross-origin isolation headers this app
      // does not set.
      ort.env.wasm.numThreads = ORT_THREADS;
      const session = await ort.InferenceSession.create(MODEL_URL, {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      });
      sessionInitMs = performance.now() - startedInit;
      return session;
    })().catch((e) => {
      // Reset so a transient failure (offline, cold CDN) can be retried rather than poisoning
      // every later attempt.
      sessionPromise = null;
      throw e;
    });
  }
  return sessionPromise;
}

export interface ClassifyResult {
  prediction: TeaPrediction;
  card: TeaModelCard | null;
  /** Wall-clock inference time, shown so a slow phone feels explained. */
  ms: number;
  /** What the runtime reported about itself on this call. */
  runtime: RuntimeFacts | null;
}

/** Classify one decoded image. */
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
      runtime: null,
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
      runtime: null,
    };
  }

  try {
    const ort = await import("onnxruntime-web/wasm");
    const session = await getSession();
    const inputName = session.inputNames[0];
    const outputName = session.outputNames[0];
    const input = new ort.Tensor("float32", tensorData, [1, 3, size, size]);
    const ran = performance.now();
    const outputs = await session.run({ [inputName]: input });
    const inferenceMs = performance.now() - ran;
    const out = outputs[outputName];
    const logits = Array.from(out.data as Float32Array);
    // Shapes are read back off the real tensors rather than restated from the card: the point of
    // the diagnostic is to catch the case where they differ.
    const runtime: RuntimeFacts = {
      backend: `wasm (numThreads=${ORT_THREADS})`,
      build: ORT_BUILD,
      inputName,
      inputShape: input.dims,
      outputName,
      outputShape: out.dims,
      sessionInitMs,
      inferenceMs,
      totalMs: performance.now() - started,
    };
    return { prediction: decide(logits, card), card, ms: runtime.totalMs, runtime };
  } catch (e) {
    // Distinguish "could not load the model at all" from "the model ran and was unsure", the UI
    // says different things.
    const detail = e instanceof Error ? e.message : String(e);
    const reason = sessionPromise === null ? "load_failed" : "inference_failed";
    return {
      prediction: { state: "error", reason, detail },
      card,
      ms: performance.now() - started,
      runtime: null,
    };
  }
}
