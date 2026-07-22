"use client";

/**
 * Alert history for the exporter. Shows every new-clearing alert, its delivery
 * status, and whether it was acknowledged, the record an exporter needs to
 * demonstrate they acted (PROJECT.md). "Run sweep now" triggers the monitoring
 * engine so the flow is visible without waiting for the daily cron.
 */
import { useCallback, useEffect, useState } from "react";
import { RefreshCw, CheckCircle2, BellOff } from "lucide-react";
import Reveal from "@/components/motion/Reveal";
import Breadcrumb from "@/components/shell/Breadcrumb";
import ActionButton from "@/components/motion/ActionButton";
import { StaggerGroup, StaggerItem } from "@/components/motion/Stagger";
import { SkeletonList } from "@/components/motion/Skeleton";
import { t, useLang } from "@/lib/i18n";
import type { Alert } from "@/lib/monitoring/types";

export default function AlertsPage() {
  const lang = useLang();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
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
    setMessage(null);
    const res = await fetch("/api/monitoring/sweep");
    if (!res.ok) throw new Error("Sweep failed. Please try again.");
    const s = await res.json();
    setMessage(
      `Sweep: ${s.due} due, ${s.checked} re-analysed, ${s.alerts} new alert(s)` +
        (s.failures ? `, ${s.failures} failed` : "") + ".",
    );
    await load();
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-4 px-5 py-6 sm:px-8">
      <Reveal>
        <Breadcrumb items={[{ label: t(lang, "nav_home"), href: "/" }, { label: t(lang, "nav_alerts") }]} />
        <header className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Clearing alerts</h1>
            <p className="text-sm muted">
              New clearing on monitored plots. Acknowledge to record that you acted.
            </p>
          </div>
          <ActionButton onAction={runSweep} className="btn btn-ghost btn-sm" loadingLabel="Running">
            <RefreshCw size={14} /> Run sweep now
          </ActionButton>
        </header>
      </Reveal>

      {message && <p className="glass p-3 text-sm">{message}</p>}

      {loading ? (
        <SkeletonList count={3} lines={2} />
      ) : alerts.length === 0 ? (
        <div className="glass flex flex-col items-center gap-2 p-10 text-center">
          <BellOff size={22} className="faint" />
          <p className="text-sm faint">No alerts yet, monitored plots are clear.</p>
        </div>
      ) : (
        <StaggerGroup className="flex flex-col gap-3">
          {alerts.map((a) => (
            <StaggerItem key={a.id}>
            <li className="glass-card list-none p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="tag" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
                  new clearing
                </span>
                <span className="font-semibold">{a.plotId}</span>
                <DeliveryBadge status={a.delivery.status} channel={a.delivery.channel} />
                <span className="ml-auto text-xs faint">
                  detected {fmt(a.detectedAt)}
                </span>
              </div>

              <p className="mt-1.5 text-sm">{a.reason}</p>
              <p className="mt-1 text-xs muted">
                {a.clearingWindow &&
                  `clearing ${a.clearingWindow.earliest} → ${a.clearingWindow.latest} · `}
                {a.clearedHectares != null && `${a.clearedHectares.toFixed(2)} ha · `}
                confidence {(a.confidence * 100).toFixed(0)}% · observed through{" "}
                {a.observedThrough} · model {a.analysisModelVersion}
              </p>

              {a.acknowledgement ? (
                <div className="mt-2 flex items-start gap-2 rounded-xl p-3 text-xs" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                  <span>
                    <strong>Acknowledged</strong> by <strong>{a.acknowledgement.acknowledgedBy}</strong> on{" "}
                    {fmt(a.acknowledgement.acknowledgedAt)}
                    {a.acknowledgement.note && (
                      <>
                        <br />
                        Action: {a.acknowledgement.note}
                      </>
                    )}
                  </span>
                </div>
              ) : (
                <AcknowledgeForm alertId={a.id} onDone={load} />
              )}
            </li>
            </StaggerItem>
          ))}
        </StaggerGroup>
      )}

      <p className="text-xs faint">Times shown in your local timezone.</p>
    </main>
  );
}

/** Inline acknowledge form (replaces two window.prompt dialogs). Collapsed to a
 *  single button until opened; on confirm it records who acted + what they did,
 *  with a success toast and an error toast on failure. */
function AcknowledgeForm({ alertId, onDone }: { alertId: string; onDone: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [by, setBy] = useState("");
  const [note, setNote] = useState("");

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn btn-primary btn-sm mt-2">
        Acknowledge
      </button>
    );
  }

  const submit = async () => {
    if (!by.trim()) throw new Error("Enter your name or role first.");
    const res = await fetch("/api/alerts/ack", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ alertId, acknowledgedBy: by.trim(), note: note.trim() || undefined }),
    });
    if (!res.ok) throw new Error("Could not save. Please try again.");
    await onDone();
  };

  return (
    <div className="mt-3 flex flex-col gap-2">
      <input
        className="field"
        placeholder="Your name / role"
        value={by}
        onChange={(e) => setBy(e.target.value)}
        autoFocus
      />
      <input
        className="field"
        placeholder="Action taken (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex gap-2">
        <ActionButton onAction={submit} className="btn btn-primary btn-sm" loadingLabel="Saving" successToast="Alert acknowledged">
          Confirm
        </ActionButton>
        <button onClick={() => setOpen(false)} className="btn btn-ghost btn-sm">
          Cancel
        </button>
      </div>
    </div>
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
    status === "delivered" ? "tag-accent" : status === "failed" ? "tag-warn" : "tag-muted";
  return (
    <span className={`tag ${cls}`} style={status === "failed" ? { background: "var(--danger-soft)", color: "var(--danger)" } : undefined}>
      {channel} · {status}
    </span>
  );
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString();
}
