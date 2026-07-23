/**
 * Persistence operations over the local DB. Every write commits immediately
 * and enqueues an outbox item, there is no "save at end of session".
 */
import { db } from "./db";
import type { ExistingPlot } from "./geometry";
import type { ProcessedImage } from "./image";
import {
  INTEGRITY_ALGO,
  attestationContentHash,
  ringSha256,
  sha256Hex,
} from "./integrity";
import type { OfficerIdentity } from "./officer";
import type {
  ConfirmationMethod,
  LocalAttestation,
  LocalFarmer,
  LocalMedia,
  LocalPlot,
} from "./types";

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Persist a farmer and queue it for sync. */
export async function saveFarmer(farmer: LocalFarmer): Promise<void> {
  const database = db();
  await database.transaction("rw", database.farmers, database.outbox, async () => {
    await database.farmers.put(farmer);
    await database.outbox.add({
      entity: "farmer",
      entityId: farmer.id,
      op: "upsert",
      status: "queued",
      attempts: 0,
      queuedAt: nowIso(),
    });
  });
}

/** Persist a plot and queue it for sync. Atomic: the plot and its outbox row
 *  land together, so a crash can't leave a saved plot that never syncs. */
export async function savePlot(plot: LocalPlot): Promise<void> {
  const database = db();
  await database.transaction("rw", database.plots, database.outbox, async () => {
    await database.plots.put(plot);
    await database.outbox.add({
      entity: "plot",
      entityId: plot.id,
      op: "upsert",
      status: "queued",
      attempts: 0,
      queuedAt: nowIso(),
    });
  });
}

export async function listPlots(): Promise<LocalPlot[]> {
  return db().plots.orderBy("capturedAt").reverse().toArray();
}

export async function getPlot(id: string): Promise<LocalPlot | undefined> {
  return db().plots.get(id);
}

export async function listFarmers(): Promise<LocalFarmer[]> {
  return db().farmers.orderBy("fullName").toArray();
}

export async function getFarmer(id: string): Promise<LocalFarmer | undefined> {
  return db().farmers.get(id);
}

/** All existing plot rings, for overlap detection. Excludes `excludeId`. */
export async function existingRings(excludeId?: string): Promise<ExistingPlot[]> {
  const plots = await db().plots.toArray();
  return plots
    .filter((p) => p.id !== excludeId)
    .map((p) => ({ id: p.id, ring: p.ring }));
}

/** Pending outbox items. Successfully-synced items are deleted, so the outbox
 *  size IS the backlog. */
export async function countUnsynced(): Promise<number> {
  return db().outbox.count();
}

// --- attestation ----------------------------------------------------------

export interface AttestationInput {
  plotId: string;
  officer: OfficerIdentity;
  location?: { lng: number; lat: number; accuracy?: number };
  farmerNameSnapshot: string;
  farmerIdSnapshot?: string;
  confirmationMethod: ConfirmationMethod;
  photo: ProcessedImage;
  signature: ProcessedImage;
  /** ISO UTC moment the farmer consented. See LocalAttestation.consentAt. */
  consentAt: string;
}

/**
 * Persist an attestation with its photo and signature, flip the plot to
 * 'attested', and queue everything for sync, all in one transaction, so a
 * crash can never leave a plot marked attested with a missing photo.
 *
 * Also seals the record: media bytes and the plot ring are SHA-256 hashed and
 * the record is chained to the previous attestation on this device
 * (lib/intake/integrity.ts), so any later edit or deletion is detectable.
 */
export async function saveAttestation(input: AttestationInput): Promise<LocalAttestation> {
  const database = db();
  const now = nowIso();
  const photo = mediaRecord(input.plotId, "photo", input.photo, now);
  const signature = mediaRecord(input.plotId, "signature", input.signature, now);

  // Hashing happens before the transaction: WebCrypto promises are not
  // IndexedDB-transaction-safe, and a single-officer device has no writer race.
  const plot = await database.plots.get(input.plotId);
  if (!plot) throw new Error(`Plot ${input.plotId} not found.`);
  const [photoSha256, signatureSha256, ringHash] = await Promise.all([
    sha256Hex(input.photo.blob),
    sha256Hex(input.signature.blob),
    ringSha256(plot.ring),
  ]);
  photo.sha256 = photoSha256;
  signature.sha256 = signatureSha256;
  const chainHead = await latestSealedAttestation();
  const prevHash = chainHead?.integrity?.contentHash ?? null;
  const chainSeq = (chainHead?.integrity?.chainSeq ?? 0) + 1;

  const attestation: LocalAttestation = {
    id: newId(),
    plotId: input.plotId,
    officerId: input.officer.id,
    officerName: input.officer.name,
    capturedAt: now,
    location: input.location,
    farmerNameSnapshot: input.farmerNameSnapshot,
    farmerIdSnapshot: input.farmerIdSnapshot,
    confirmationMethod: input.confirmationMethod,
    photoMediaId: photo.id,
    signatureMediaId: signature.id,
    consentAt: input.consentAt,
    syncStatus: "queued",
    createdAt: now,
  };
  attestation.integrity = {
    algo: INTEGRITY_ALGO,
    photoSha256,
    signatureSha256,
    ringSha256: ringHash,
    prevHash,
    chainSeq,
    contentHash: await attestationContentHash({
      plotId: attestation.plotId,
      officerId: attestation.officerId,
      officerName: attestation.officerName,
      capturedAt: attestation.capturedAt,
      location: attestation.location,
      farmerNameSnapshot: attestation.farmerNameSnapshot,
      farmerIdSnapshot: attestation.farmerIdSnapshot,
      confirmationMethod: attestation.confirmationMethod,
      consentAt: attestation.consentAt,
      photoSha256,
      signatureSha256,
      ringSha256: ringHash,
      prevHash,
    }),
  };

  await database.transaction(
    "rw",
    database.media,
    database.attestations,
    database.plots,
    database.outbox,
    async () => {
      await database.media.bulkPut([photo, signature]);
      await database.attestations.put(attestation);
      await database.plots.update(input.plotId, { status: "attested" });
      // Media first, then the attestation that references them.
      await database.outbox.bulkAdd([
        outbox("media", photo.id, now),
        outbox("media", signature.id, now),
        outbox("attestation", attestation.id, now),
      ]);
    },
  );
  return attestation;
}

export async function getAttestationForPlot(
  plotId: string,
): Promise<LocalAttestation | undefined> {
  return db().attestations.where("plotId").equals(plotId).first();
}

/** Head of this device's hash chain: the sealed attestation with the highest
 *  chain sequence. Records from before the integrity layer are skipped. */
async function latestSealedAttestation(): Promise<LocalAttestation | undefined> {
  const all = await db().attestations.toArray();
  return all
    .filter((a) => a.integrity)
    .sort((a, b) => (a.integrity!.chainSeq < b.integrity!.chainSeq ? 1 : -1))[0];
}

/** Object URL for a stored media blob, or null if already purged. Caller revokes. */
export async function mediaObjectUrl(mediaId: string): Promise<string | null> {
  const m = await db().media.get(mediaId);
  return m?.blob ? URL.createObjectURL(m.blob) : null;
}

/** Raw stored media blob, or undefined if already purged after upload. */
export async function mediaBlob(mediaId: string): Promise<Blob | undefined> {
  return (await db().media.get(mediaId))?.blob;
}

function mediaRecord(
  plotId: string,
  kind: LocalMedia["kind"],
  img: ProcessedImage,
  now: string,
): LocalMedia {
  return {
    id: newId(),
    plotId,
    kind,
    blob: img.blob,
    mimeType: img.mimeType,
    bytes: img.bytes,
    width: img.width,
    height: img.height,
    syncStatus: "queued",
    createdAt: now,
  };
}

function outbox(
  entity: "farmer" | "plot" | "attestation" | "media",
  entityId: string,
  now: string,
) {
  return {
    entity,
    entityId,
    op: "upsert" as const,
    status: "queued" as const,
    attempts: 0,
    queuedAt: now,
  };
}
