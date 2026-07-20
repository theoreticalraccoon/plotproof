/**
 * Persistence operations over the local DB. Every write commits immediately
 * and enqueues an outbox item — there is no "save at end of session".
 */
import { db } from "./db";
import type { ExistingPlot } from "./geometry";
import type { ProcessedImage } from "./image";
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
}

/**
 * Persist an attestation with its photo and signature, flip the plot to
 * 'attested', and queue everything for sync — all in one transaction, so a
 * crash can never leave a plot marked attested with a missing photo.
 */
export async function saveAttestation(input: AttestationInput): Promise<LocalAttestation> {
  const database = db();
  const now = nowIso();
  const photo = mediaRecord(input.plotId, "photo", input.photo, now);
  const signature = mediaRecord(input.plotId, "signature", input.signature, now);
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
    syncStatus: "queued",
    createdAt: now,
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

/** Object URL for a stored media blob, or null if already purged. Caller revokes. */
export async function mediaObjectUrl(mediaId: string): Promise<string | null> {
  const m = await db().media.get(mediaId);
  return m?.blob ? URL.createObjectURL(m.blob) : null;
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
