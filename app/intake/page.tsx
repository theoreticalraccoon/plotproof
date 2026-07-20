"use client";

/**
 * Plot intake hub. One screen for the officer: sync status, the two live
 * capture paths (import + tracing), and the running list of captured plots.
 * Corner-capture and boundary-walk come next, behind the same save-gate.
 *
 * TraceMap is loaded with ssr:false because Leaflet touches `window`.
 */
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import ImportPanel from "@/components/intake/ImportPanel";
import PlotList from "@/components/intake/PlotList";
import SyncBar from "@/components/intake/SyncBar";
import { warmup } from "@/lib/net";

const TraceMap = dynamic(() => import("@/components/intake/TraceMap"), {
  ssr: false,
  loading: () => <p className="text-sm text-gray-500">Loading map…</p>,
});

type Tab = "import" | "trace";

export default function IntakePage() {
  const [tab, setTab] = useState<Tab>("import");
  const [refresh, setRefresh] = useState(0);
  const bump = () => setRefresh((n) => n + 1);

  // Wake the serverless analysis routes early, so opening a pack later is warm.
  useEffect(() => warmup(), []);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
      <header>
        <h1 className="text-xl font-semibold">Plot intake</h1>
        <p className="text-sm text-gray-500">
          Import beats capture. Everything persists offline and syncs later.
        </p>
      </header>

      <SyncBar refreshSignal={refresh} />

      <div className="flex gap-2">
        <TabButton active={tab === "import"} onClick={() => setTab("import")}>
          Import (CSV / registry)
        </TabButton>
        <TabButton active={tab === "trace"} onClick={() => setTab("trace")}>
          Trace on satellite
        </TabButton>
      </div>

      {tab === "import" ? (
        <ImportPanel onImported={bump} />
      ) : (
        <TraceMap onSaved={bump} />
      )}

      <section className="mt-2">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Captured plots</h2>
        <PlotList refreshSignal={refresh} />
      </section>
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded px-3 py-2 text-sm font-medium ${
        active ? "bg-green-600 text-white" : "bg-gray-200 text-gray-700"
      }`}
    >
      {children}
    </button>
  );
}
