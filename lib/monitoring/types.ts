/**
 * Standing monitoring: a verified plot stays subscribed, and a later satellite
 * pass showing NEW clearing fires an alert to the exporter, in time to stop a
 * shipment, not after a container is rejected at port (PROJECT.md).
 *
 * Server-side domain types. See DECISIONS.md D-010 for the cadence rationale.
 */
import type { Verdict, Wgs84Polygon } from "@/lib/analysis";

export type AlertChannel = "email" | "webhook";

/**
 * A subscription IS the standing watch on one plot. It also carries the small
 * amount of monitoring state we need to decide "is this clearing NEW?" without
 * re-running change detection (that lives in the analysis service).
 */
export interface Subscription {
  id: string;
  plotId: string;
  exporterId: string;
  channel: AlertChannel;
  /** Email address or webhook URL. */
  target: string;
  /** Per-plot re-analysis cadence in days. Default 7 (D-010). */
  cadenceDays: number;
  active: boolean;
  // Analysis inputs, snapshotted so monitoring can re-analyse without a join:
  countryCode: string;
  commodity: string;
  cutoffDate: string;
  geometry: Wgs84Polygon;
  // --- monitoring state ---
  /** When we last re-analysed. Drives the cadence due-check. */
  lastCheckedAt?: string;
  /** Verdict at the last check, to tell clear→flagged from already-flagged. */
  lastVerdict?: Verdict;
  /** `latest` of the last clearing window we already alerted on. Prevents
   *  re-alerting the same clearing; a later window means NEW clearing. */
  lastAlertedClearingLatest?: string;
  createdAt: string;
}

export type DeliveryStatus = "pending" | "delivered" | "failed";

export interface AlertDelivery {
  channel: AlertChannel;
  target: string;
  status: DeliveryStatus;
  attempts: number;
  deliveredAt?: string;
  error?: string;
}

/** Proof the exporter acted on an alert, required for their own compliance. */
export interface AlertAck {
  acknowledgedBy: string;
  acknowledgedAt: string;
  note?: string;
}

export interface Alert {
  id: string;
  subscriptionId: string;
  plotId: string;
  exporterId: string;
  reason: string;
  clearingWindow?: { earliest: string; latest: string };
  clearedHectares?: number;
  confidence: number;
  analysisModelVersion: string;
  /** When our sweep detected it. */
  detectedAt: string;
  /** Latest satellite acquisition considered, the "as of" date. */
  observedThrough: string;
  delivery: AlertDelivery;
  acknowledgement?: AlertAck;
  createdAt: string;
}
