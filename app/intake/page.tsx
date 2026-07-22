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
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { Upload, Satellite, Trash2 } from "lucide-react";
import ImportPanel from "@/components/intake/ImportPanel";
import PlotList from "@/components/intake/PlotList";
import SyncBar from "@/components/intake/SyncBar";
import ActionButton from "@/components/motion/ActionButton";
import Reveal from "@/components/motion/Reveal";
import Breadcrumb from "@/components/shell/Breadcrumb";
import { stepTransition } from "@/lib/motion/variants";
import { clearIntakeData } from "@/lib/intake/db";
import { useAuth } from "@/lib/auth/AuthProvider";
import { t, useLang } from "@/lib/i18n";
import { warmup } from "@/lib/net";

const TraceMap = dynamic(() => import("@/components/intake/TraceMap"), {
  ssr: false,
  loading: () => (
    <p className="flex items-center gap-2 text-sm faint">
      <span className="spinner" aria-hidden="true" /> Loading map…
    </p>
  ),
});

type Tab = "import" | "trace";

export default function IntakePage() {
  const lang = useLang();
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<Tab>("import");
  const [refresh, setRefresh] = useState(0);
  const bump = () => setRefresh((n) => n + 1);

  // Wake the serverless analysis routes early, so opening a pack later is warm.
  useEffect(() => warmup(), []);

  // Account isolation: if a different account (or an anonymous session) than the
  // last one used this browser, wipe local field data so each account opens on a
  // genuine clean slate rather than inheriting the previous user's plots.
  useEffect(() => {
    if (loading) return;
    const KEY = "plotproof.intakeOwner";
    const current = user?.id ?? "anon";
    const last = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    if (last === current) return;
    void clearIntakeData().then(() => {
      if (typeof localStorage !== "undefined") localStorage.setItem(KEY, current);
      bump();
    });
  }, [user, loading]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-4 px-5 py-6 sm:px-8">
      <Reveal>
        <Breadcrumb items={[{ label: t(lang, "nav_home"), href: "/" }, { label: t(lang, "nav_evidence") }]} />
        <header className="mt-3">
          <h1 className="text-xl font-semibold tracking-tight">Plot intake</h1>
          <p className="text-sm muted">
            Import beats capture. Everything persists offline and syncs later.
          </p>
        </header>
      </Reveal>

      <SyncBar refreshSignal={refresh} />

      <div className="glass inline-flex gap-1 self-start p-1">
        <TabButton active={tab === "import"} onClick={() => setTab("import")}>
          <Upload size={14} /> Import (CSV / registry)
        </TabButton>
        <TabButton active={tab === "trace"} onClick={() => setTab("trace")}>
          <Satellite size={14} /> Trace on satellite
        </TabButton>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} variants={stepTransition} initial="initial" animate="enter" exit="exit">
          {tab === "import" ? <ImportPanel onImported={bump} /> : <TraceMap onSaved={bump} />}
        </motion.div>
      </AnimatePresence>

      <section className="mt-2">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide faint">Captured plots</h2>
        <PlotList refreshSignal={refresh} />
      </section>

      <DangerZone onCleared={bump} />
    </main>
  );
}

/**
 * The farmer's right to have their record deleted has to be exercisable by the
 * person holding the device, without contacting anyone. Two taps, no recovery.
 */
function DangerZone({ onCleared }: { onCleared: () => void }) {
  const [armed, setArmed] = useState(false);

  return (
    <section className="mt-4 flex flex-col gap-2 rounded-xl p-4 text-sm" style={{ border: "1px solid var(--danger)", background: "var(--danger-soft)" }}>
      <h2 className="flex items-center gap-2 font-semibold" style={{ color: "var(--danger)" }}>
        <Trash2 size={15} /> Delete field data on this device
      </h2>
      <p className="muted">
        Erases every farmer, plot, attestation, photo and signature stored here.
        This cannot be undone, and nothing is backed up to a server yet. See the{" "}
        <Link href="/privacy" className="underline underline-offset-2">privacy notice</Link>.
      </p>
      {armed ? (
        <div className="flex flex-wrap items-center gap-2">
          <ActionButton
            onAction={async () => {
              await clearIntakeData();
              setArmed(false);
              onCleared();
            }}
            className="btn btn-sm"
            style={{ background: "var(--danger)", color: "#fff" }}
            loadingLabel="Deleting"
            successToast="Field data deleted from this device"
          >
            Yes, delete everything
          </ActionButton>
          <button onClick={() => setArmed(false)} className="btn btn-ghost btn-sm">
            Cancel
          </button>
        </div>
      ) : (
        <button onClick={() => setArmed(true)} className="btn btn-ghost btn-sm self-start">
          Delete field data
        </button>
      )}
    </section>
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
      className="inline-flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-sm font-semibold transition-colors"
      style={
        active
          ? { background: "var(--accent)", color: "var(--accent-fg)" }
          : { color: "var(--fg-muted)" }
      }
    >
      {children}
    </button>
  );
}
