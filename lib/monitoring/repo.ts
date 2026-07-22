/**
 * Monitoring persistence behind an interface. The in-memory implementation lets
 * the sweep, alerts API and history view run end-to-end today; the real
 * implementation is Supabase (subscriptions + alerts tables, SCHEMA.md) once the
 * migration is signed off. Swapping it is one line in `getMonitoringRepo`.
 *
 * NOTE: in-memory state is per-process. Fine for `next dev`/`next start` and for
 * demos; on Vercel's serverless model it does not persist between invocations -
 * that's exactly why the Supabase impl is the production target.
 */
import type { Wgs84Polygon } from "@/lib/analysis";
import type { Alert, Subscription } from "./types";

export interface MonitoringRepo {
  listActiveSubscriptions(): Promise<Subscription[]>;
  getSubscriptionByPlot(plotId: string): Promise<Subscription | undefined>;
  upsertSubscription(sub: Subscription): Promise<void>;
  createAlert(alert: Alert): Promise<void>;
  updateAlert(alert: Alert): Promise<void>;
  getAlert(id: string): Promise<Alert | undefined>;
  listAlerts(): Promise<Alert[]>;
}

class InMemoryMonitoringRepo implements MonitoringRepo {
  private subs = new Map<string, Subscription>();
  private alerts = new Map<string, Alert>();

  constructor(seed: { subs: Subscription[]; alerts: Alert[] }) {
    seed.subs.forEach((s) => this.subs.set(s.id, s));
    seed.alerts.forEach((a) => this.alerts.set(a.id, a));
  }

  async listActiveSubscriptions() {
    return [...this.subs.values()].filter((s) => s.active);
  }
  async getSubscriptionByPlot(plotId: string) {
    return [...this.subs.values()].find((s) => s.plotId === plotId);
  }
  async upsertSubscription(sub: Subscription) {
    this.subs.set(sub.id, sub);
  }
  async createAlert(alert: Alert) {
    this.alerts.set(alert.id, alert);
  }
  async updateAlert(alert: Alert) {
    this.alerts.set(alert.id, alert);
  }
  async getAlert(id: string) {
    return this.alerts.get(id);
  }
  async listAlerts() {
    return [...this.alerts.values()].sort((a, b) =>
      b.detectedAt.localeCompare(a.detectedAt),
    );
  }
}

// --- demo seed ------------------------------------------------------------

function square(lng: number, lat: number, d = 0.001): Wgs84Polygon {
  return {
    type: "Polygon",
    coordinates: [
      [
        [lng, lat],
        [lng + d, lat],
        [lng + d, lat + d],
        [lng, lat + d],
        [lng, lat],
      ],
    ],
  };
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

function seedSubs(): Subscription[] {
  // Baseline "clear", last checked well beyond the weekly cadence → all due.
  return Array.from({ length: 6 }, (_, i) => ({
    id: `sub-${i + 1}`,
    plotId: `seed-plot-${i + 1}`,
    exporterId: "exporter-demo",
    channel: (i % 2 === 0 ? "webhook" : "email") as Subscription["channel"],
    target:
      i % 2 === 0
        ? "https://webhook.site/your-endpoint"
        : "compliance@exporter.example",
    cadenceDays: 7,
    active: true,
    countryCode: "LK",
    commodity: "rubber",
    cutoffDate: "2020-12-31",
    geometry: square(80.6 + i * 0.01, 7.29),
    lastCheckedAt: daysAgo(30),
    lastVerdict: "clear",
    createdAt: daysAgo(60),
  }));
}

function seedAlerts(): Alert[] {
  // A little history so the "exporters must show they acted" view isn't empty.
  return [
    {
      id: "alert-seed-1",
      subscriptionId: "sub-2",
      plotId: "seed-plot-2",
      exporterId: "exporter-demo",
      reason: "New clearing detected on a plot previously assessed clear.",
      clearingWindow: { earliest: "2026-05-10", latest: "2026-05-22" },
      clearedHectares: 0.8,
      confidence: 0.86,
      analysisModelVersion: "stub-0.0.0",
      detectedAt: daysAgo(20),
      observedThrough: "2026-05-22",
      delivery: {
        channel: "email",
        target: "compliance@exporter.example",
        status: "delivered",
        attempts: 1,
        deliveredAt: daysAgo(20),
      },
      acknowledgement: {
        acknowledgedBy: "R. Fernando (exporter)",
        acknowledgedAt: daysAgo(19),
        note: "Held shipment; requested permit + ground photo from cooperative.",
      },
      createdAt: daysAgo(20),
    },
  ];
}

let _repo: MonitoringRepo | null = null;
export function getMonitoringRepo(): MonitoringRepo {
  if (!_repo) {
    // Start empty so a new user sees a genuine clean slate (empty state + the
    // "Run sweep now" action), not pre-seeded demo alerts. The seedSubs/
    // seedAlerts fixtures below are kept for local demos/tests but no longer
    // loaded by default.
    _repo = new InMemoryMonitoringRepo({ subs: [], alerts: [] });
  }
  return _repo;
}

// Reference the demo fixtures so they aren't flagged unused; not loaded above.
void seedSubs;
void seedAlerts;
