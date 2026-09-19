/**
 * Capture-method confidence. An auditor will ask which method produced a
 * boundary, a traced polygon and a walked one are not equally trustworthy, and
 * (per PROJECT.md) tracing is often MORE accurate than walking because it has no
 * GPS error while consumer GPS scatters 3–5 m under canopy.
 *
 * This is expressed as a LABEL + rationale, deliberately NOT folded into the
 * model's numeric confidence. Inventing a combined number would be exactly the
 * overclaiming the PDF caveats warn against. The evidence pack shows the model
 * verdict/confidence AND this capture assessment side by side.
 */
import type { CaptureMethod } from "./types";

export type ConfidenceLevel = "high" | "medium" | "low";

export interface CaptureConfidence {
  level: ConfidenceLevel;
  label: string;
  /** One sentence the PDF can quote verbatim. */
  rationale: string;
}

export function captureConfidence(method: CaptureMethod): CaptureConfidence {
  switch (method) {
    case "traced":
      return {
        level: "high",
        label: "Traced on imagery",
        rationale:
          "Boundary traced against high-resolution imagery with the farmer present; no GPS positioning error.",
      };
    case "walked":
      return {
        level: "medium",
        label: "Walked boundary",
        rationale:
          "Continuous GPS track walked on the ground; subject to 3–5 m consumer-GPS error, worse under canopy.",
      };
    case "corners":
      return {
        level: "medium",
        label: "Corner capture",
        rationale:
          "Averaged GPS fixes taken at each corner; subject to consumer-GPS error and reliant on corner visibility.",
      };
    case "imported":
      return {
        level: "low",
        label: "Imported from records",
        rationale:
          "Geometry taken from existing records and not verified in the field; accuracy depends on the source registry.",
      };
  }
  // Unreachable for records this app wrote, but a record synced from the server
  // or left by an older version can carry any string. Without this the whole
  // plot list crashed on one bad row; with it, that row is marked as unverified.
  return {
    level: "low",
    label: "Unknown capture method",
    rationale: "The record does not say how this boundary was captured, so its accuracy cannot be assessed.",
  };
}
