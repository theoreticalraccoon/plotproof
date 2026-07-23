"use client";

/**
 * Connectivity + sync backlog indicator. Auto-drains the outbox on reconnect;
 * "Sync now" forces a drain. Reflects the offline-first reality: work happens
 * offline, sync catches up later.
 */
import { useCallback, useEffect, useState } from "react";
import { countUnsynced } from "@/lib/intake/store";
import { drainOutbox, isOnline, startAutoSync } from "@/lib/intake/sync";
import { formatBytes, localMediaBytes, requestPersistence } from "@/lib/intake/storage";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useToast } from "@/components/shell/Toast";
import { t, useLang } from "@/lib/i18n";

export default function SyncBar({ refreshSignal }: { refreshSignal: number }) {
  const lang = useLang();
  const { toast } = useToast();
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [media, setMedia] = useState<{ bytes: number; count: number }>({
    bytes: 0,
    count: 0,
  });
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(() => {
    void countUnsynced().then(setPending);
    void localMediaBytes().then(setMedia);
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

  const syncNow = async () => {
    setSyncing(true);
    try {
      const result = await drainOutbox();
      refresh();
      if (result.unavailable) {
        toast("No server sync is connected — records stay on this device only.");
      } else if (result.failed > 0) {
        toast(`${result.synced} synced, ${result.failed} failed — will retry.`);
      } else {
        toast(t(lang, "toast_synced"));
      }
    } finally {
      setSyncing(false);
    }
  };

  const serverless = !isSupabaseConfigured();

  return (
    <div className="glass flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 text-sm">
      <span
        className="inline-flex items-center gap-1.5 font-semibold"
        style={{ color: online ? "var(--accent)" : "var(--fg-faint)" }}
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ background: online ? "var(--accent)" : "var(--fg-faint)" }}
        />
        {online ? "Online" : "Offline"}
      </span>
      <span className="muted">
        {serverless
          ? `On this device only — no server sync connected${pending > 0 ? ` (${pending} queued)` : ""}`
          : pending === 0
            ? "All synced"
            : `${pending} pending sync`}
      </span>
      {media.count > 0 && (
        <span className="faint" title="Photos held on-device until uploaded, then purged">
          {media.count} photo{media.count === 1 ? "" : "s"} · {formatBytes(media.bytes)} local
        </span>
      )}
      <button
        onClick={syncNow}
        disabled={!online || syncing || pending === 0}
        className="btn btn-ghost btn-sm ml-auto"
      >
        {syncing ? (
          <>
            <span className="spinner" aria-hidden="true" /> Syncing…
          </>
        ) : (
          "Sync now"
        )}
      </button>
    </div>
  );
}
