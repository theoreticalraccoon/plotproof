/** Local, offline-first data model for plot intake. */

/** [longitude, latitude], GeoJSON axis order. Never [lat, lng]. */
export type LngLat = [number, number];

/** Capture path, ranked by PROJECT.md. Drives confidence and auto-ordering. */
export type CaptureMethod = "imported" | "traced" | "corners" | "walked";

/** Where a record is in the offline → server lifecycle. */
export type SyncStatus = "local" | "queued" | "syncing" | "synced" | "error";

export interface LocalFarmer {
  id: string;
  cooperativeId: string;
  countryCode: string;
  fullName: string;
  nationalId?: string;
  membershipNo?: string;
  village?: string;
  phone?: string;
  capturedVia: "roster_import" | "id_scan" | "manual";
  createdAt: string; // ISO UTC
}

export interface LocalPlot {
  id: string;
  farmerId: string;
  cooperativeId: string;
  countryCode: string;
  commodity?: string;
  /** Closed WGS84 ring: first coord === last coord, >= 4 coords. */
  ring: LngLat[];
  captureMethod: CaptureMethod;
  claimedAreaHa?: number;
  /** Geodesic area computed on-device (turf). Authoritative figure is server-side. */
  computedAreaHa: number;
  /** Warnings acknowledged by the officer at save time (overlap, area mismatch). */
  acknowledgedWarnings: string[];
  status: "captured" | "attested";
  syncStatus: SyncStatus;
  capturedAt: string; // ISO UTC, when taken in the field
  syncedAt?: string;
}

/** A blocking problem: the plot cannot be saved until fixed. */
export interface ValidationError {
  code: "too_few_points" | "self_intersecting" | "zero_area";
  message: string;
}

/** A non-blocking flag: the officer may save after acknowledging. */
export interface ValidationWarning {
  code: "area_mismatch" | "overlap";
  message: string;
  /** For overlap: ids of the plots overlapped. */
  overlappedPlotIds?: string[];
}

export interface PlotValidation {
  /** True when there are no blocking errors, the plot may be saved. */
  canSave: boolean;
  /** Closed, correctly-ordered ring, or null if not derivable. */
  orderedRing: LngLat[] | null;
  areaHa: number | null;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/** How the farmer confirmed the plot at attestation. */
export type ConfirmationMethod = "signature" | "thumbprint";

/** A binary media asset (plot photo or farmer signature) held locally until it syncs. */
export interface LocalMedia {
  id: string;
  plotId: string;
  kind: "photo" | "signature";
  /** Present until synced, then purged to reclaim device space. */
  blob?: Blob;
  mimeType: string;
  /** Byte size, kept even after the blob is purged, for storage budgeting. */
  bytes: number;
  width?: number;
  height?: number;
  /** Server path once uploaded. Its presence means the blob may be purged. */
  remotePath?: string;
  /** SHA-256 of the blob at capture; survives the blob being purged. */
  sha256?: string;
  syncStatus: SyncStatus;
  createdAt: string;
}

/** What turns a polygon into evidence (PROJECT.md "Attestation"). */
export interface LocalAttestation {
  id: string;
  plotId: string;
  officerId: string;
  officerName: string;
  capturedAt: string; // auto, ISO UTC
  /** Where the officer stood when attesting. */
  location?: { lng: number; lat: number; accuracy?: number };
  farmerNameSnapshot: string;
  farmerIdSnapshot?: string;
  confirmationMethod: ConfirmationMethod;
  photoMediaId: string;
  signatureMediaId?: string;
  // When the farmer gave explicit, informed consent to this record being taken and stored
  // (SCHEMA.md consent_at, DECISIONS.md D-007).
  consentAt: string; // ISO UTC
  // Tamper-evidence (lib/intake/integrity.ts): SHA-256 over the canonical record + media bytes +
  // plot ring, chained to the previous attestation on this device.
  integrity?: import("./integrity").AttestationIntegrity;
  syncStatus: SyncStatus;
  createdAt: string;
}
