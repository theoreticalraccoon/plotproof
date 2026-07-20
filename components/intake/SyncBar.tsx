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

export default function SyncBar({ refreshSignal }: { refreshSignal: number }) {
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
      await drainOutbox();
      refresh();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
      <span
        className={`inline-flex items-center gap-1 ${online ? "text-green-700" : "text-gray-500"}`}
      >
        <span
          className={`h-2 w-2 rounded-full ${online ? "bg-green-500" : "bg-gray-400"}`}
        />
        {online ? "Online" : "Offline"}
      </span>
      <span className="text-gray-600">
        {pending === 0 ? "All synced" : `${pending} pending sync`}
      </span>
      {media.count > 0 && (
        <span className="text-gray-500" title="Photos held on-device until uploaded, then purged">
          {media.count} photo{media.count === 1 ? "" : "s"} · {formatBytes(media.bytes)} local
        </span>
      )}
      <button
        onClick={syncNow}
        disabled={!online || syncing || pending === 0}
        className="ml-auto rounded bg-gray-800 px-3 py-1 text-white disabled:opacity-40"
      >
        {syncing ? "Syncing…" : "Sync now"}
      </button>
    </div>
  );
}
