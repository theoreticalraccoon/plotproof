/**
 * Monitoring engine: the daily sweep and the on-demand pre-shipment recheck.
 *
 * Sweep (cron, daily) re-analyses every plot that is DUE (weekly cadence) and
 * alerts on new clearing. Recheck (on-demand) forces one plot against the newest
 * pass regardless of cadence, the "before the container leaves" guarantee
 * (D-010). Server-only.
 */
import {
  getAnalysisClient,
  type AnalysisClient,
  type AnalysisRequest,
  type AnalysisResult,
} from "@/lib/analysis";
import { detectNewClearing, isDue, observedThrough } from "./detect";
import { getAlertTransport } from "./delivery";
import { getMonitoringRepo, type MonitoringRepo } from "./repo";
import type { Alert, Subscription } from "./types";

/** Submit and poll a queued analysis job to completion (bounded). */
async function analyzeToCompletion(
  client: AnalysisClient,
  req: AnalysisRequest,
  timeoutMs = 15_000,
  intervalMs = 400,
): Promise<AnalysisResult> {
  const handle = await client.submit(req);
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const poll = await client.poll(handle.jobId);
    if (poll.status === "succeeded") return poll.result;
    if (poll.status === "failed") throw new Error(poll.error);
    if (Date.now() > deadline) throw new Error("analysis timed out");
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

function requestFor(sub: Subscription): AnalysisRequest {
  return {
    plotId: sub.plotId,
    geometry: sub.geometry,
    countryCode: sub.countryCode,
    commodity: sub.commodity,
    cutoffDate: sub.cutoffDate,
  };
}

/** Re-analyse one subscription and, if new clearing appeared, alert + record it. */
async function checkSubscription(
  repo: MonitoringRepo,
  client: AnalysisClient,
  sub: Subscription,
  nowMs: number,
): Promise<Alert | null> {
  const result = await analyzeToCompletion(client, requestFor(sub));
  const detection = detectNewClearing(sub, result);
  const asOf = observedThrough(result);

  // Advance monitoring state regardless of whether we alert.
  sub.lastCheckedAt = new Date(nowMs).toISOString();
  sub.lastVerdict = result.verdict;

  let alert: Alert | null = null;
  if (detection.fires) {
    alert = {
      id: crypto.randomUUID(),
      subscriptionId: sub.id,
      plotId: sub.plotId,
      exporterId: sub.exporterId,
      reason: detection.reason!,
      clearingWindow: detection.clearingWindow,
      clearedHectares: result.clearedHectares,
      confidence: result.confidence,
      analysisModelVersion: result.modelVersion,
      detectedAt: new Date(nowMs).toISOString(),
      observedThrough: asOf,
      delivery: {
        channel: sub.channel,
        target: sub.target,
        status: "pending",
        attempts: 0,
      },
      createdAt: new Date(nowMs).toISOString(),
    };
    await repo.createAlert(alert);

    // Deliver, recording the outcome on the alert.
    const res = await getAlertTransport(sub.channel).deliver(alert, sub.target);
    alert.delivery.attempts = 1;
    alert.delivery.status = res.ok ? "delivered" : "failed";
    if (res.ok) alert.delivery.deliveredAt = new Date().toISOString();
    else alert.delivery.error = res.error;
    await repo.updateAlert(alert);

    sub.lastAlertedClearingLatest = detection.clearingWindow?.latest;
  }

  await repo.upsertSubscription(sub);
  return alert;
}

export interface SweepSummary {
  due: number;
  checked: number;
  alerts: number;
  failures: number;
}

/** Daily cron entry point: check everything that's due. */
export async function runMonitoringSweep(
  now = Date.now(),
  repo: MonitoringRepo = getMonitoringRepo(),
  client: AnalysisClient = getAnalysisClient(),
): Promise<SweepSummary> {
  const subs = await repo.listActiveSubscriptions();
  const due = subs.filter((s) => isDue(s, now));
  const summary: SweepSummary = { due: due.length, checked: 0, alerts: 0, failures: 0 };
  for (const sub of due) {
    try {
      const alert = await checkSubscription(repo, client, sub, now);
      summary.checked++;
      if (alert) summary.alerts++;
    } catch {
      summary.failures++;
    }
  }
  return summary;
}

export interface RecheckResult {
  plotId: string;
  fired: boolean;
  alertId?: string;
  observedThrough?: string;
}

/**
 * Pre-shipment recheck: force one plot NOW, ignoring cadence. Returns whether an
 * alert fired so the shipment workflow can gate on a fresh, clear result.
 */
export async function recheckPlot(
  plotId: string,
  now = Date.now(),
  repo: MonitoringRepo = getMonitoringRepo(),
  client: AnalysisClient = getAnalysisClient(),
): Promise<RecheckResult> {
  const sub = await repo.getSubscriptionByPlot(plotId);
  if (!sub) throw new Error(`No active subscription for plot ${plotId}`);
  const alert = await checkSubscription(repo, client, sub, now);
  return {
    plotId,
    fired: Boolean(alert),
    alertId: alert?.id,
    observedThrough: sub.lastCheckedAt ? alert?.observedThrough : undefined,
  };
}
