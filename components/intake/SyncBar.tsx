"use client";

// Connectivity + sync backlog indicator. Auto-drains the outbox on reconnect; "Sync now" forces
// a drain.
import { useCallback, useEffect, useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { countUnsynced } from "@/lib/intake/store";
import { drainOutbox, isOnline, startAutoSync } from "@/lib/intake/sync";
import { formatBytes, localMediaBytes, requestPersistence } from "@/lib/intake/storage";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import ActionButton from "@/components/motion/ActionButton";
import { Skeleton } from "@/components/motion/Skeleton";
import { useToast } from "@/components/shell/Toast";
import { t, useLang } from "@/lib/i18n";

interface MediaUsage {
  bytes: number;
  count: number;
}

export default function SyncBar({ refreshSignal }: { refreshSignal: number }) {
  const lang = useLang();
  const { toast } = useToast();
  const [online, setOnline] = useState(true);
  // null = not read yet. Distinguishing "no backlog" from "don't know yet" is the whole point: 0
  // rendered too early reads as "all safe".
  const [pending, setPending] = useState<number | null>(null);
  const [media, setMedia] = useState<MediaUsage | null>(null);
  const [readFailed, setReadFailed] = useState(false);

  const refresh = useCallback(() => {
    void Promise.all([countUnsynced(), localMediaBytes()])
      .then(([count, usage]) => {
        setPending(count);
        setMedia(usage);
        setReadFailed(false);
      })
      .catch(() => setReadFailed(true));
  }, []);

  useEffect(() => {
    setOnline(isOnline());
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    const stop = startAutoSync();
    void requestPersistence(); // don't let the browser evict unsynced work
    refresh();
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      stop();
    };
  }, [refresh]);

  useEffect(refresh, [refresh, refreshSignal]);

  const serverless = !isSupabaseConfigured();

  // Anything short of "everything left the device" throws, so the button lands on its error
  // state instead of flashing a checkmark over a failed drain.
  const syncNow = async () => {
    const result = await drainOutbox();
    refresh();
    if (result.unavailable) {
      throw new Error("No server sync is connected, records stay on this device only.");
    }
    if (result.failed > 0) {
      throw new Error(`${result.synced} synced, ${result.failed} failed, will retry.`);
    }
    toast(t(lang, "toast_synced"), "success");
  };

  const blockedReason = serverless
    ? "No server sync is connected, so there is nothing to send to."
    : !online
      ? "You are offline. Sync resumes on its own when the connection returns."
      : pending === null
        ? "Still reading the local queue."
        : pending === 0
          ? "Nothing is waiting to be sent."
          : null;

  return (
    <div className="glass flex flex-wrap items-center gap-x-4 gap-y-2 px-3.5 py-2.5">
      <span
        className="inline-flex items-center gap-2 text-sm font-semibold"
        style={{ color: online ? "var(--accent)" : "var(--fg-faint)" }}
      >
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ background: online ? "var(--accent)" : "var(--fg-faint)" }}
          aria-hidden="true"
        />
        {online ? "Online" : "Offline"}
      </span>

      {/* Flowing text, not a flex row: as a flex row each phrase became its own
          column on a phone and wrapped word by word into a narrow stack. The
          basis pushes the Sync button onto the next line before that happens. */}
      <span
        className="min-w-0 flex-1 basis-[15rem] text-[0.95rem] leading-snug"
        role="status"
        aria-live="polite"
        aria-busy={pending === null && !readFailed}
      >
        {readFailed ? (
          <span className="font-medium" style={{ color: "var(--warn)" }}>
            Couldn&apos;t read the local queue
          </span>
        ) : pending === null ? (
          <Skeleton className="skeleton-sm h-4 w-44" />
        ) : serverless ? (
          <>
            <CloudOff size={15} className="mr-1.5 inline-block align-[-2px]" style={{ color: "var(--fg-faint)" }} aria-hidden="true" />
            <span className="font-semibold">On this device only</span>{" "}
            <span className="muted">, no server sync connected</span>
            {pending > 0 && <span className="tag tag-muted ml-2 tabular-nums">{pending} queued</span>}
          </>
        ) : pending === 0 ? (
          <span className="muted">All synced</span>
        ) : (
          <>
            <span className="tag tag-warn mr-2 tabular-nums">{pending}</span>
            <span className="font-medium">pending sync</span>
          </>
        )}
      </span>

      {/* The title sits on the wrapper because a disabled button does not emit
          hover events of its own in every browser. */}
      <span className="ml-auto" title={blockedReason ?? "Send everything queued on this device now"}>
        <ActionButton
          onAction={syncNow}
          disabled={blockedReason != null}
          className="btn btn-ghost"
          loadingLabel="Syncing"
          successLabel="Synced"
        >
          <RefreshCw size={14} aria-hidden="true" /> Sync now
        </ActionButton>
      </span>

      {media != null && media.count > 0 && (
        <span
          className="w-full text-xs faint tabular-nums"
          title="Photos held on-device until uploaded, then purged"
        >
          {media.count} photo{media.count === 1 ? "" : "s"} · {formatBytes(media.bytes)} held on this device
        </span>
      )}
    </div>
  );
}
