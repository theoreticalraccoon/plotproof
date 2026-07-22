/**
 * Alert delivery, email or webhook, the exporter's choice per subscription.
 *
 * Webhook delivery is real (HTTP POST with an HMAC signature so the receiver can
 * verify authenticity). Email is behind a transport interface with a stub
 * default, consistent with the analysis/sync stubs, swap in Resend/SES/Postmark
 * without touching callers. Server-only (uses node:crypto).
 */
import { createHmac } from "node:crypto";
import type { Alert, AlertChannel } from "./types";

export interface DeliveryResult {
  ok: boolean;
  error?: string;
}

export interface AlertTransport {
  deliver(alert: Alert, target: string): Promise<DeliveryResult>;
}

/** Compact JSON payload sent to webhooks / rendered into emails. */
export function alertPayload(alert: Alert) {
  return {
    type: "new_clearing",
    alertId: alert.id,
    plotId: alert.plotId,
    reason: alert.reason,
    clearingWindow: alert.clearingWindow,
    clearedHectares: alert.clearedHectares,
    confidence: alert.confidence,
    observedThrough: alert.observedThrough,
    detectedAt: alert.detectedAt,
    modelVersion: alert.analysisModelVersion,
  };
}

class WebhookTransport implements AlertTransport {
  async deliver(alert: Alert, target: string): Promise<DeliveryResult> {
    const body = JSON.stringify(alertPayload(alert));
    const secret = process.env.ALERT_WEBHOOK_SECRET ?? "dev-secret";
    const signature = createHmac("sha256", secret).update(body).digest("hex");
    try {
      const res = await fetch(target, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-plotproof-signature": `sha256=${signature}`,
          "x-plotproof-event": "new_clearing",
        },
        body,
      });
      return res.ok
        ? { ok: true }
        : { ok: false, error: `HTTP ${res.status} ${res.statusText}` };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

/** Placeholder email transport: logs and reports success. Replace with a real
 *  provider; delivery-status tracking on the alert already exists. */
class StubEmailTransport implements AlertTransport {
  async deliver(alert: Alert, target: string): Promise<DeliveryResult> {
    console.info(
      `[alert:email:stub] -> ${target}: ${alert.reason} (plot ${alert.plotId}, as of ${alert.observedThrough})`,
    );
    return { ok: true };
  }
}

const webhook = new WebhookTransport();
const email = new StubEmailTransport();

export function getAlertTransport(channel: AlertChannel): AlertTransport {
  return channel === "webhook" ? webhook : email;
}
