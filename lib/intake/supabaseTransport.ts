// The real sync transport: pushes outbox items to Supabase (tables from
// supabase/migrations/0002_field_data.sql, blobs to the private `field-media` Storage bucket).
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { db, type OutboxItem } from "./db";
import type { PushResult, SyncTransport } from "./sync";

const BUCKET = "field-media";

class SupabaseTransport implements SyncTransport {
  constructor(
    private supabase: SupabaseClient,
    private uid: string,
  ) {}

  async push(item: OutboxItem): Promise<PushResult | void> {
    switch (item.entity) {
      case "farmer":
        return this.pushFarmer(item.entityId);
      case "plot":
        return this.pushPlot(item.entityId);
      case "attestation":
        return this.pushAttestation(item.entityId);
      case "media":
        return this.pushMedia(item.entityId);
    }
  }

  private async pushFarmer(id: string): Promise<void> {
    const f = await db().farmers.get(id);
    if (!f) return; // deleted locally before it ever synced: nothing to push
    await this.upsert("farmers", {
      id: f.id,
      owner: this.uid,
      cooperative_id: f.cooperativeId,
      country_code: f.countryCode,
      full_name: f.fullName,
      national_id: f.nationalId ?? null,
      membership_no: f.membershipNo ?? null,
      village: f.village ?? null,
      phone: f.phone ?? null,
      captured_via: f.capturedVia,
      created_at: f.createdAt,
    });
  }

  private async pushPlot(id: string): Promise<void> {
    const p = await db().plots.get(id);
    if (!p) return;
    await this.upsert("plots", {
      id: p.id,
      owner: this.uid,
      farmer_id: p.farmerId,
      cooperative_id: p.cooperativeId,
      country_code: p.countryCode,
      commodity: p.commodity ?? null,
      ring: p.ring,
      capture_method: p.captureMethod,
      claimed_area_ha: p.claimedAreaHa ?? null,
      computed_area_ha: p.computedAreaHa,
      acknowledged_warnings: p.acknowledgedWarnings,
      status: p.status,
      captured_at: p.capturedAt,
    });
  }

  private async pushAttestation(id: string): Promise<void> {
    const a = await db().attestations.get(id);
    if (!a) return;
    await this.upsert("attestations", {
      id: a.id,
      owner: this.uid,
      plot_id: a.plotId,
      officer_id: a.officerId,
      officer_name: a.officerName,
      captured_at: a.capturedAt,
      location: a.location ?? null,
      farmer_name_snapshot: a.farmerNameSnapshot,
      farmer_id_snapshot: a.farmerIdSnapshot ?? null,
      confirmation_method: a.confirmationMethod,
      photo_media_id: a.photoMediaId,
      signature_media_id: a.signatureMediaId ?? null,
      consent_at: a.consentAt,
      integrity: a.integrity ?? null,
      created_at: a.createdAt,
    });
  }

  private async pushMedia(id: string): Promise<PushResult | void> {
    const m = await db().media.get(id);
    if (!m) return;
    if (!m.blob) return { remotePath: m.remotePath }; // already uploaded & purged
    const path = `${this.uid}/${m.plotId}/${m.id}`;
    const { error: upErr } = await this.supabase.storage
      .from(BUCKET)
      .upload(path, m.blob, { contentType: m.mimeType, upsert: true });
    if (upErr) throw new Error(`media upload failed: ${upErr.message}`);
    await this.upsert("media", {
      id: m.id,
      owner: this.uid,
      plot_id: m.plotId,
      kind: m.kind,
      mime_type: m.mimeType,
      bytes: m.bytes,
      width: m.width ?? null,
      height: m.height ?? null,
      sha256: m.sha256 ?? null,
      storage_path: path,
      created_at: m.createdAt,
    });
    return { remotePath: path };
  }

  private async upsert(table: string, row: Record<string, unknown>): Promise<void> {
    const { error } = await this.supabase.from(table).upsert(row);
    if (error) throw new Error(`${table} upsert failed: ${error.message}`);
  }
}

// Resolve the real transport, or null when it honestly cannot sync: Supabase not configured, or
// nobody signed in.
export async function getSupabaseTransport(): Promise<SyncTransport | null> {
  const supabase = await getSupabaseBrowser();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return new SupabaseTransport(supabase, data.user.id);
}
