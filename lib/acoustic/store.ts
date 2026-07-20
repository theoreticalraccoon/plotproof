/**
 * Acoustic node + event store. In-memory (per-process; demo/dev) behind simple
 * functions, same Supabase-swap seam as the other layers. Seeded with SIMULATED
 * events shaped exactly like real LoRa uplinks, so the PDF exhibit renders
 * before any hardware exists.
 */
import { buildExhibit, type ExhibitOptions } from "./exhibit";
import type {
  AcousticEvent,
  AcousticExhibit,
  AcousticNode,
  IngestUplink,
  LatLng,
} from "./types";

const NODES: AcousticNode[] = [];
const EVENTS: AcousticEvent[] = [];
/** devEui:fCnt keys already seen — LoRa delivers duplicates via many gateways. */
const seen = new Set<string>();

// --- deterministic simulation ---------------------------------------------

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function jitter(base: LatLng, rand: () => number, m = 0.002): LatLng {
  return { lng: base.lng + (rand() - 0.5) * m, lat: base.lat + (rand() - 0.5) * m };
}

function seed() {
  const now = Date.now();
  const nodeSpecs: Omit<AcousticNode, "id" | "installedAt" | "status">[] = [
    { devEui: "70B3D57ED0000001", label: "Ratnapura ridge 1", location: { lng: 80.301, lat: 6.751 }, countryCode: "LK", firmwareVersion: "esp32-acoustic-0.4.1", batteryPct: 82 },
    { devEui: "70B3D57ED0000002", label: "Ratnapura ridge 2", location: { lng: 80.306, lat: 6.748 }, countryCode: "LK", firmwareVersion: "esp32-acoustic-0.4.1", batteryPct: 74 },
    { devEui: "70B3D57ED0000003", label: "Riau block A", location: { lng: 101.452, lat: -0.498 }, countryCode: "ID", firmwareVersion: "esp32-acoustic-0.4.0", batteryPct: 68 },
    { devEui: "70B3D57ED0000004", label: "Đắk Lắk edge", location: { lng: 108.052, lat: 12.681 }, countryCode: "VN", firmwareVersion: "esp32-acoustic-0.4.1", batteryPct: 91 },
  ];
  nodeSpecs.forEach((n, i) =>
    NODES.push({
      ...n,
      id: `node-${i + 1}`,
      installedAt: new Date(now - 120 * 864e5).toISOString(),
      status: "active",
    }),
  );

  const rand = mulberry32(20260718);
  const fCnt: Record<string, number> = {};
  const push = (node: AcousticNode, cls: AcousticEvent["eventClass"], atMs: number, conf: number) => {
    const n = (fCnt[node.devEui] = (fCnt[node.devEui] ?? 0) + 1);
    const iso = new Date(atMs).toISOString();
    EVENTS.push({
      id: crypto.randomUUID(),
      nodeId: node.id,
      devEui: node.devEui,
      eventClass: cls,
      confidence: Math.round(conf * 100) / 100,
      detectedAt: iso,
      receivedAt: iso,
      location: jitter(node.location!, rand),
      fCnt: n,
      rssi: -100 - Math.floor(rand() * 20),
      snr: Math.round((rand() * 12 - 4) * 10) / 10,
      gatewayId: `gw-${node.countryCode?.toLowerCase()}-1`,
    });
    node.lastSeenAt = iso;
  };

  // A clearing event: a burst of chainsaw + a few heavy-vehicle over ~3 days,
  // ~10 days ago, heard by both Ratnapura nodes. This is the compelling exhibit.
  const burstStart = now - 12 * 864e5;
  for (let i = 0; i < 16; i++) {
    const t = burstStart + i * (3 * 864e5) / 16 + rand() * 36e5;
    push(NODES[0], "chainsaw", t, 0.7 + rand() * 0.28);
    if (rand() < 0.6) push(NODES[1], "chainsaw", t + rand() * 12e5, 0.65 + rand() * 0.3);
  }
  for (let i = 0; i < 3; i++) push(NODES[0], "heavy_vehicle", burstStart + (i + 1) * 6e6 * 3, 0.72 + rand() * 0.2);

  // Background scatter elsewhere (fainter, sporadic) over ~25 days.
  for (let i = 0; i < 6; i++) push(NODES[2], rand() < 0.7 ? "chainsaw" : "heavy_vehicle", now - rand() * 25 * 864e5, 0.6 + rand() * 0.3);
  for (let i = 0; i < 4; i++) push(NODES[3], rand() < 0.5 ? "chainsaw" : "other", now - rand() * 25 * 864e5, 0.55 + rand() * 0.3);
}
seed();

// --- accessors ------------------------------------------------------------

export function listNodes(): AcousticNode[] {
  return NODES;
}
export function getNodeByDevEui(devEui: string): AcousticNode | undefined {
  return NODES.find((n) => n.devEui === devEui);
}
export function listEvents(limit = 100): AcousticEvent[] {
  return [...EVENTS].sort((a, b) => b.detectedAt.localeCompare(a.detectedAt)).slice(0, limit);
}

function nodeLabelMap(): Record<string, string | undefined> {
  return Object.fromEntries(NODES.map((n) => [n.devEui, n.label]));
}

/** The PDF-exhibit data for a plot location. */
export function plotExhibit(location: LatLng, opts: ExhibitOptions = {}): AcousticExhibit {
  return buildExhibit(EVENTS, location, { ...opts, nodeLabels: nodeLabelMap() });
}

// --- ingest ---------------------------------------------------------------

export interface IngestResult {
  ok: boolean;
  duplicate?: boolean;
  provisioned?: boolean;
  eventId?: string;
  error?: string;
}

/** Ingest one decoded LoRa uplink. Idempotent on (devEui, fCnt). */
export function ingest(u: IngestUplink): IngestResult {
  if (!u.devEui) return { ok: false, error: "devEui required" };
  if (u.eventClass !== "chainsaw" && u.eventClass !== "heavy_vehicle" && u.eventClass !== "other") {
    return { ok: false, error: "invalid eventClass" };
  }
  if (typeof u.confidence !== "number" || u.confidence < 0 || u.confidence > 1) {
    return { ok: false, error: "confidence must be 0..1" };
  }

  const receivedAt = new Date().toISOString();

  // Dedup: multiple gateways relay the same frame.
  if (u.fCnt != null) {
    const key = `${u.devEui}:${u.fCnt}`;
    if (seen.has(key)) return { ok: true, duplicate: true };
    seen.add(key);
  }

  // Resolve the node; auto-provision an unknown one if it carries a location.
  let node = getNodeByDevEui(u.devEui);
  let provisioned = false;
  if (!node) {
    if (!u.location) return { ok: false, error: "unknown node and no location" };
    node = {
      id: crypto.randomUUID(),
      devEui: u.devEui,
      location: u.location,
      installedAt: receivedAt,
      status: "provisional",
    };
    NODES.push(node);
    provisioned = true;
  }

  const location = u.location ?? node.location;
  if (!location) return { ok: false, error: "no location for event" };

  const event: AcousticEvent = {
    id: crypto.randomUUID(),
    nodeId: node.id,
    devEui: node.devEui,
    eventClass: u.eventClass,
    confidence: u.confidence,
    detectedAt: u.detectedAt ?? receivedAt,
    receivedAt,
    location,
    fCnt: u.fCnt,
    rssi: u.rssi,
    snr: u.snr,
    gatewayId: u.gatewayId,
    raw: u.raw,
  };
  EVENTS.push(event);
  node.lastSeenAt = receivedAt;

  return { ok: true, eventId: event.id, provisioned };
}
