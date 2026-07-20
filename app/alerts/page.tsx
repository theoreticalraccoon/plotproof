"use client";

/**
 * Alert history for the exporter. Shows every new-clearing alert, its delivery
 * status, and whether it was acknowledged — the record an exporter needs to
 * demonstrate they acted (PROJECT.md). "Run sweep now" triggers the monitoring
 * engine so the flow is visible without waiting for the daily cron.
 */
import { useCallback, useEffect, useState } from "react";
import type { Alert } from "@/lib/monitoring/types";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [sweeping, setSweeping] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/alerts");
    const data = await res.json();
    setAlerts(data.alerts ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runSweep = async () => {
    setSweeping(true);
    setMessage(null);
    try {
      const res = await fetch("/api/monitoring/sweep");
      const s = await res.json();
      setMessage(
        `Sweep: ${s.due} due, ${s.checked} re-analysed, ${s.alerts} new alert(s)` +
          (s.failures ? `, ${s.failures} failed` : "") + ".",
      );
      await load();
    } finally {
      setSweeping(false);
    }
  };

  const acknowledge = async (alert: Alert) => {
    const acknowledgedBy = window.prompt("Acknowledged by (your name / role):");
    if (!acknowledgedBy) return;
    const note = window.prompt("Action taken (optional):") ?? undefined;
    await fetch("/api/alerts/ack", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ alertId: alert.id, acknowledgedBy, note }),
    });
    await load();
  };

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Clearing alerts</h1>
          <p className="text-sm text-gray-500">
            New clearing on monitored plots. Acknowledge to record that you acted.
          </p>
        </div>
        <button
          onClick={runSweep}
          disabled={sweeping}
          className="rounded bg-gray-800 px-3 py-2 text-sm text-white disabled:opacity-40"
        >
          {sweeping ? "Running…" : "Run sweep now"}
        </button>
      </header>

      {message && <p className="text-sm text-gray-700">{message}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : alerts.length === 0 ? (
        <p className="text-sm text-gray-500">No alerts yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {alerts.map((a) => (
            <li key={a.id} className="rounded-lg border border-gray-200 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                  new clearing
                </span>
                <span className="font-medium">{a.plotId}</span>
                <DeliveryBadge status={a.delivery.status} channel={a.delivery.channel} />
                <span className="ml-auto text-xs text-gray-500">
                  detected {fmt(a.detectedAt)}
                </span>
              </div>

              <p className="mt-1 text-sm">{a.reason}</p>
              <p className="mt-1 text-xs text-gray-600">
                {a.clearingWindow &&
                  `clearing ${a.clearingWindow.earliest} → ${a.clearingWindow.latest} · `}
                {a.clearedHectares != null && `${a.clearedHectares.toFixed(2)} ha · `}
                confidence {(a.confidence * 100).toFixed(0)}% · observed through{" "}
                {a.observedThrough} · model {a.analysisModelVersion}
              </p>

              {a.acknowledgement ? (
                <div className="mt-2 rounded bg-green-50 p-2 text-xs text-green-900">
                  ✓ Acknowledged by <strong>{a.acknowledgement.acknowledgedBy}</strong> on{" "}
                  {fmt(a.acknowledgement.acknowledgedAt)}
                  {a.acknowledgement.note && (
                    <>
                      <br />
                      Action: {a.acknowledgement.note}
                    </>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => acknowledge(a)}
                  className="mt-2 rounded bg-green-600 px-3 py-1.5 text-sm text-white"
                >
                  Acknowledge
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-gray-400">Times shown in your local timezone.</p>
    </main>
  );
}

function DeliveryBadge({
  status,
  channel,
}: {
  status: Alert["delivery"]["status"];
  channel: string;
}) {
  const cls =
    status === "delivered"
      ? "bg-green-100 text-green-800"
      : status === "failed"
        ? "bg-red-100 text-red-800"
        : "bg-amber-100 text-amber-800";
  return (
    <span className={`rounded px-2 py-0.5 text-xs ${cls}`}>
      {channel} · {status}
    </span>
  );
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString();
}
