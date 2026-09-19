/** Capture-method confidence. */
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
  // Unreachable for records this app wrote, but a record synced from the server or left by an
  // older version can carry any string.
  return {
    level: "low",
    label: "Unknown capture method",
    rationale: "The record does not say how this boundary was captured, so its accuracy cannot be assessed.",
  };
}
