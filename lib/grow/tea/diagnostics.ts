/** Development-only diagnostics for the browser inference path. */
import type { TeaModelCard, TeaPrediction } from "./types";

export const DIAG_PARAM = "diag";

/** `?diag=1` anywhere in the query string. Accepts a raw `location.search`. */
export function diagnosticsEnabled(search: string): boolean {
  if (!search) return false;
  try {
    return new URLSearchParams(search).get(DIAG_PARAM) === "1";
  } catch {
    return false;
  }
}

/** What the runtime actually did, as reported by the runtime, not assumed. */
export interface RuntimeFacts {
  /** Execution provider(s) the session was created with, plus thread count. */
  backend: string;
  /** onnxruntime-web build entry point that was imported. */
  build: string;
  inputName: string;
  inputShape: readonly number[];
  outputName: string;
  outputShape: readonly number[];
  /** Milliseconds to import the runtime and create the session (first run only). */
  sessionInitMs: number | null;
  /** Milliseconds for preprocessing + session.run on this image. */
  inferenceMs: number;
  /** Total wall clock inside classifyLeaf. */
  totalMs: number;
}

export interface DiagRow {
  label: string;
  value: string;
  /** true = matches expectation, false = mismatch, null = informational. */
  ok: boolean | null;
}

function fmtMs(ms: number | null): string {
  return ms === null ? "-" : `${Math.round(ms)} ms`;
}

function shape(s: readonly number[] | undefined): string {
  return s && s.length ? `[${s.join(", ")}]` : "-";
}

/** Integrity of the bytes the BROWSER received, not the bytes on disk. */
export interface ArtifactCheck {
  bytes: number | null;
  sha256: string | null;
  matches: boolean | null;
  error?: string;
}

export async function verifyPublishedModel(
  url: string,
  card: TeaModelCard,
): Promise<ArtifactCheck> {
  try {
    const res = await fetch(url);
    if (!res.ok) return { bytes: null, sha256: null, matches: false, error: `HTTP ${res.status}` };
    const buf = await res.arrayBuffer();
    if (!globalThis.crypto?.subtle) {
      // Insecure origins have no SubtleCrypto. Size is still worth reporting.
      return {
        bytes: buf.byteLength,
        sha256: null,
        matches: null,
        error: "crypto.subtle unavailable (needs HTTPS or localhost)",
      };
    }
    const digest = await crypto.subtle.digest("SHA-256", buf);
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return { bytes: buf.byteLength, sha256: hex, matches: hex === card.model.sha256 };
  } catch (e) {
    return {
      bytes: null,
      sha256: null,
      matches: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/** The panel's contents, as data. */
export function buildDiagnosticRows(
  card: TeaModelCard | null,
  prediction: TeaPrediction | null,
  runtime: RuntimeFacts | null,
  artifact: ArtifactCheck | null,
): DiagRow[] {
  const rows: DiagRow[] = [];

  // --- model load -------------------------------------------------------
  rows.push({ label: "Card loaded", value: card ? "yes" : "no", ok: !!card });
  if (!card) {
    rows.push({
      label: "Load failure",
      value:
        prediction?.state === "error"
          ? `${prediction.reason}${prediction.detail ? `: ${prediction.detail}` : ""}`
          : "card fetch returned nothing usable",
      ok: false,
    });
    return rows;
  }

  rows.push({ label: "Model", value: `${card.model.name} ${card.model.version}`, ok: null });
  rows.push({ label: "Architecture", value: card.model.architecture, ok: null });
  rows.push({ label: "Card sha256", value: card.model.sha256, ok: null });

  if (artifact) {
    rows.push({
      label: "Served bytes",
      value:
        artifact.bytes === null
          ? (artifact.error ?? "unknown")
          : `${artifact.bytes} (card: ${card.model.bytes})`,
      ok: artifact.bytes === null ? false : artifact.bytes === card.model.bytes,
    });
    rows.push({
      label: "Served sha256",
      value: artifact.sha256 ?? artifact.error ?? "unknown",
      ok: artifact.matches,
    });
  }

  // --- runtime ----------------------------------------------------------
  if (runtime) {
    rows.push({ label: "Runtime backend", value: runtime.backend, ok: null });
    rows.push({ label: "Runtime build", value: runtime.build, ok: null });
    rows.push({
      label: "Input tensor",
      value: `${runtime.inputName} ${shape(runtime.inputShape)}`,
      // The card dictates the square input size; the tensor must be NCHW at it.
      ok:
        runtime.inputShape.length === 4 &&
        runtime.inputShape[1] === 3 &&
        runtime.inputShape[2] === card.preprocessing.image_size &&
        runtime.inputShape[3] === card.preprocessing.image_size,
    });
    rows.push({
      label: "Output tensor",
      value: `${runtime.outputName} ${shape(runtime.outputShape)}`,
      // One logit per class in the card's taxonomy, or the class mapping is wrong.
      ok:
        runtime.outputShape.length === 2 &&
        runtime.outputShape[1] === card.taxonomy.classes.length,
    });
    rows.push({ label: "Session init", value: fmtMs(runtime.sessionInitMs), ok: null });
    rows.push({ label: "Inference", value: fmtMs(runtime.inferenceMs), ok: null });
    rows.push({ label: "Total", value: fmtMs(runtime.totalMs), ok: null });
  } else {
    rows.push({ label: "Runtime", value: "not reached", ok: false });
  }

  // --- decision ---------------------------------------------------------
  rows.push({
    label: "Preprocessing",
    value:
      `resize ${card.preprocessing.resize_shorter_side_to} -> ${card.preprocessing.crop} crop ` +
      `${card.preprocessing.image_size}, ${card.preprocessing.channel_order}, ` +
      `mean ${card.preprocessing.mean.join("/")} std ${card.preprocessing.std.join("/")}`,
    ok: null,
  });
  rows.push({ label: "Temperature", value: String(card.calibration.temperature), ok: null });
  rows.push({ label: "Abstention threshold", value: String(card.abstention.threshold), ok: null });

  if (prediction) {
    rows.push({ label: "State", value: prediction.state, ok: null });
    if (prediction.state === "confident") {
      rows.push({ label: "Predicted class", value: prediction.classKey, ok: null });
      rows.push({
        label: "Calibrated confidence",
        value: prediction.confidence.toFixed(6),
        // A confident state must actually clear the card's own threshold.
        ok: prediction.confidence >= card.abstention.threshold,
      });
      rows.push({
        label: "Abstention decision",
        value: "accepted (>= threshold)",
        ok: prediction.confidence >= card.abstention.threshold,
      });
      rows.push({
        label: "Cross-dataset validated",
        value: prediction.crossDatasetValidated ? "yes" : "no, no external test set contains it",
        ok: null,
      });
      rows.push({
        label: "Model version shown",
        value: prediction.modelVersion,
        ok: prediction.modelVersion === card.model.version,
      });
    } else if (prediction.state === "uncertain") {
      rows.push({
        label: "Calibrated confidence",
        value: prediction.confidence.toFixed(6),
        ok: prediction.confidence < prediction.threshold,
      });
      rows.push({
        label: "Abstention decision",
        value: `abstained (< ${prediction.threshold})`,
        ok: prediction.confidence < prediction.threshold,
      });
      rows.push({
        label: "Class withheld",
        value: `yes (leaned ${prediction.topKeyForDiagnosticsOnly}, not shown to the user)`,
        ok: true,
      });
      rows.push({
        label: "Threshold used",
        value: String(prediction.threshold),
        ok: prediction.threshold === card.abstention.threshold,
      });
    } else {
      rows.push({
        label: "Failure reason",
        value: `${prediction.reason}${prediction.detail ? `: ${prediction.detail}` : ""}`,
        ok: false,
      });
    }
  } else {
    rows.push({ label: "State", value: "no prediction yet", ok: null });
  }

  return rows;
}
