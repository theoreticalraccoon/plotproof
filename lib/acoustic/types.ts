/**
 * Acoustic ground truth (PROJECT.md stretch): ESP32 nodes run an on-device
 * chainsaw / heavy-vehicle classifier and transmit event flags over LoRa.
 * "Satellite says where, the node says right now and it's real."
 *
 * The chain is real even though the hardware isn't yet: node → LoRa → gateway /
 * network server (TTN, ChirpStack) → HTTP webhook → our ingest. So the model
 * uses LoRaWAN concepts, DevEUI identity, a frame counter for dedup, radio
 * quality metadata, and location resolves from the event's GPS or the node's
 * registered position (most low-power nodes carry no GPS).
 */

export type LatLng = { lng: number; lat: number };

/** Classes the on-device model emits. Kept small and honest. */
export type EventClass = "chainsaw" | "heavy_vehicle" | "other";

/** A provisioned sensor node. */
export interface AcousticNode {
  id: string; // our uuid
  devEui: string; // 64-bit LoRaWAN hardware id, hex (unique)
  label?: string; // human name, e.g. "Ratnapura ridge 3"
  location: LatLng | null; // registered position (fallback for events w/o GPS)
  countryCode?: string;
  firmwareVersion?: string;
  installedAt: string; // ISO UTC
  lastSeenAt?: string; // ISO UTC, updated on ingest
  batteryPct?: number;
  status: "active" | "inactive" | "provisional";
}

/** One detection, after decoding at the gateway. */
export interface AcousticEvent {
  id: string;
  nodeId: string;
  devEui: string;
  eventClass: EventClass;
  confidence: number; // 0..1 from the on-device classifier
  detectedAt: string; // node's detection time, ISO UTC
  receivedAt: string; // when ingest received it, ISO UTC
  location: LatLng; // event GPS, else node registered location
  // LoRa radio metadata (present for real uplinks):
  fCnt?: number; // frame counter, dedup / replay protection
  rssi?: number; // received signal strength at the gateway (dBm)
  snr?: number; // signal-to-noise ratio (dB)
  gatewayId?: string;
  raw?: string; // original base64 payload, for audit
}

/** The normalized uplink an ingest webhook posts (one detection). */
export interface IngestUplink {
  devEui: string;
  eventClass: EventClass;
  confidence: number;
  detectedAt?: string; // node time; defaults to receive time
  location?: LatLng; // optional per-message GPS
  fCnt?: number;
  rssi?: number;
  snr?: number;
  gatewayId?: string;
  raw?: string;
}

/** What the PDF acoustic exhibit renders for one plot. */
export interface AcousticExhibit {
  location: LatLng;
  radiusKm: number;
  since: string; // ISO UTC window start
  events: ExhibitEvent[];
  summary: {
    total: number;
    chainsaw: number;
    heavyVehicle: number;
    firstAt?: string;
    lastAt?: string;
    nodes: number;
  };
}

export interface ExhibitEvent {
  detectedAt: string;
  eventClass: EventClass;
  confidence: number;
  distanceKm: number;
  nodeDevEui: string;
  nodeLabel?: string;
}
