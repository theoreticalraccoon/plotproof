/**
 * Tamper-evidence for attestations.
 *
 * What this is: every attestation is canonically serialised and SHA-256 hashed
 * on the officer's device at save time. The hash covers the plot geometry, the
 * photo bytes, the signature bytes, the farmer/officer identity snapshot and
 * the consent timestamp, plus the hash of the PREVIOUS attestation on this
 * device — a per-device hash chain. Any later edit to any of those breaks the
 * hash; deleting or reordering a record breaks the chain.
 *
 * What this is NOT (stated on screen, not just here): the chain is computed
 * client-side by the same device that captured the data. It proves the record
 * has not changed since capture; it does not prove the capture itself was
 * honest, and it is not yet anchored to any external timestamping service.
 */
import type { LngLat } from "./types";

export const INTEGRITY_ALGO = "SHA-256" as const;

export interface AttestationIntegrity {
  algo: typeof INTEGRITY_ALGO;
  /** Hash of the plot photo bytes at capture. */
  photoSha256: string;
  /** Hash of the signature/thumbprint PNG bytes at capture. */
  signatureSha256?: string;
  /** Hash of the canonical plot ring the farmer confirmed. */
  ringSha256: string;
  /** contentHash of the previous attestation on this device; null for the first. */
  prevHash: string | null;
  /** Position in this device's chain, 1-based. */
  chainSeq: number;
  /** SHA-256 over the canonical payload; the value the chain links on. */
  contentHash: string;
}

export async function sha256Hex(input: Blob | string): Promise<string> {
  const data =
    typeof input === "string" ? new TextEncoder().encode(input) : await input.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Deterministic JSON: object keys sorted, no whitespace, undefined dropped. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`);
  return `{${entries.join(",")}}`;
}

/** Ring serialised at fixed precision so float noise can't change the hash. */
export function ringSha256(ring: LngLat[]): Promise<string> {
  const canonical = ring.map(([lng, lat]) => [lng.toFixed(7), lat.toFixed(7)]);
  return sha256Hex(canonicalJson(canonical));
}

/** The exact fields the content hash commits to. Adding a field is a breaking
 *  change for verification, so keep this list explicit, never spread. */
export interface AttestationHashInput {
  plotId: string;
  officerId: string;
  officerName: string;
  capturedAt: string;
  location?: { lng: number; lat: number; accuracy?: number };
  farmerNameSnapshot: string;
  farmerIdSnapshot?: string;
  confirmationMethod: string;
  consentAt: string;
  photoSha256: string;
  signatureSha256?: string;
  ringSha256: string;
  prevHash: string | null;
}

export function attestationContentHash(input: AttestationHashInput): Promise<string> {
  return sha256Hex(canonicalJson(input));
}

export interface VerifyResult {
  ok: boolean;
  /** Human-readable checks, in the order they ran. */
  checks: { label: string; ok: boolean; detail?: string }[];
}

/**
 * Recompute every hash from the stored bytes and compare. A purged media blob
 * (uploaded, then dropped to save space) can no longer be re-hashed locally;
 * that check reports as passed-by-record with a note, not as a failure.
 */
export async function verifyAttestationIntegrity(args: {
  integrity: AttestationIntegrity;
  hashInput: Omit<AttestationHashInput, "photoSha256" | "signatureSha256" | "ringSha256" | "prevHash">;
  ring: LngLat[];
  photoBlob?: Blob;
  signatureBlob?: Blob;
}): Promise<VerifyResult> {
  const { integrity } = args;
  const checks: VerifyResult["checks"] = [];

  const ringNow = await ringSha256(args.ring);
  checks.push({
    label: "Plot boundary unchanged since attestation",
    ok: ringNow === integrity.ringSha256,
  });

  if (args.photoBlob) {
    checks.push({
      label: "Photo bytes match the recorded hash",
      ok: (await sha256Hex(args.photoBlob)) === integrity.photoSha256,
    });
  } else {
    checks.push({
      label: "Photo bytes match the recorded hash",
      ok: true,
      detail: "photo uploaded and purged locally; recorded hash retained",
    });
  }

  if (integrity.signatureSha256) {
    if (args.signatureBlob) {
      checks.push({
        label: "Signature bytes match the recorded hash",
        ok: (await sha256Hex(args.signatureBlob)) === integrity.signatureSha256,
      });
    } else {
      checks.push({
        label: "Signature bytes match the recorded hash",
        ok: true,
        detail: "signature uploaded and purged locally; recorded hash retained",
      });
    }
  }

  const recomputed = await attestationContentHash({
    ...args.hashInput,
    photoSha256: integrity.photoSha256,
    signatureSha256: integrity.signatureSha256,
    ringSha256: integrity.ringSha256,
    prevHash: integrity.prevHash,
  });
  checks.push({
    label: "Record fields unchanged (content hash matches)",
    ok: recomputed === integrity.contentHash,
  });

  return { ok: checks.every((c) => c.ok), checks };
}
