"use client";

// Plot intake hub. One screen for the officer: sync status, the capture surface (import or
// on-map capture), and the running list of captured plots.
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import ImportPanel from "@/components/intake/ImportPanel";
import PlotList from "@/components/intake/PlotList";
import SyncBar from "@/components/intake/SyncBar";
import ActionButton from "@/components/motion/ActionButton";
import { SkeletonMap } from "@/components/motion/Skeleton";
import Breadcrumb from "@/components/shell/Breadcrumb";
import { stepTransition } from "@/lib/motion/variants";
import { clearIntakeData } from "@/lib/intake/db";
import { useAuth } from "@/lib/auth/AuthProvider";
import { t, useLang } from "@/lib/i18n";
import { warmup } from "@/lib/net";

const TraceMap = dynamic(() => import("@/components/intake/TraceMap"), {
  ssr: false,
  // Shaped like the map it becomes: a blank rectangle where a map belongs is indistinguishable
  // from a map that failed to load.
  loading: () => <SkeletonMap className="h-[58vh]" label="Loading map" />,
});

type Tab = "import" | "trace";

export default function IntakePage() {
  const lang = useLang();
  const { user, loading } = useAuth();
  const reduce = useReducedMotion();
  const [tab, setTab] = useState<Tab>("import");
  const [refresh, setRefresh] = useState(0);
  // The panel below is server-rendered.
  const [switched, setSwitched] = useState(false);
  const bump = () => setRefresh((n) => n + 1);

  // Wake the serverless analysis routes early, so opening a pack later is warm.
  useEffect(() => warmup(), []);

  // Account isolation: if a different account (or an anonymous session) than the last one used
  // this browser.
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
    <main className="mx-auto w-full max-w-4xl px-4 pb-20 pt-4 sm:px-6">
      <Breadcrumb items={[{ label: t(lang, "nav_home"), href: "/" }, { label: t(lang, "nav_evidence") }]} />

      <header className="mt-4">
        <h1 className="text-[1.9rem] font-semibold leading-[1.05] tracking-[-0.025em] sm:text-[2.25rem]">
          Plot intake
        </h1>
        <p className="mt-2 max-w-[62ch] text-[0.98rem] leading-relaxed muted">
          Import beats capture. Everything persists offline and syncs later.
        </p>
      </header>

      <div className="mt-6">
        <SyncBar refreshSignal={refresh} />
      </div>

      {/* The capture surface is the one thing on this screen. Its path selector
          sits directly above it as part of the same object, not in a card. */}
      <section className="mt-10">
        <h2 className="text-[0.72rem] font-semibold uppercase tracking-[0.1em] faint">
          Add plots
        </h2>
        <div
          role="group"
          aria-label="Capture path"
          className="mt-2.5 grid grid-cols-2 gap-px overflow-hidden"
          style={{
            background: "var(--glass-hairline)",
            border: "1px solid var(--glass-hairline)",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <PathButton
            active={tab === "import"}
            onClick={() => { setSwitched(true); setTab("import"); }}
            label="Import"
            hint="CSV / registry"
          />
          <PathButton
            active={tab === "trace"}
            onClick={() => { setSwitched(true); setTab("trace"); }}
            label="Capture on map"
            hint="Trace, corners or walk"
          />
        </div>

        <div className="mt-5">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              variants={reduce ? undefined : stepTransition}
              initial={reduce || !switched ? false : "initial"}
              animate={reduce ? undefined : "enter"}
              exit={reduce ? undefined : "exit"}
            >
              {tab === "import" ? <ImportPanel onImported={bump} /> : <TraceMap onSaved={bump} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      <section className="mt-14">
        <h2
          className="pb-2 text-[1.3rem] font-semibold tracking-[-0.02em]"
          style={{ borderBottom: "2px solid var(--fg)" }}
        >
          Captured plots
        </h2>
        <PlotList refreshSignal={refresh} />
      </section>

      <DangerZone onCleared={bump} />
    </main>
  );
}

// The farmer's right to have their record deleted has to be exercisable by the person holding
// the device, without contacting anyone. Two taps, no recovery.
function DangerZone({ onCleared }: { onCleared: () => void }) {
  const [armed, setArmed] = useState(false);

  return (
    <section className="mt-16 pt-6" style={{ borderTop: "1px solid var(--glass-hairline)" }}>
      <h2
        className="text-[0.72rem] font-semibold uppercase tracking-[0.1em]"
        style={{ color: "var(--danger)" }}
      >
        Delete field data on this device
      </h2>
      <p className="mt-2 max-w-[68ch] text-sm leading-relaxed muted">
        Erases every farmer, plot, attestation, photo and signature stored here.
        This cannot be undone, and nothing is backed up to a server yet. See the{" "}
        <Link href="/privacy" className="underline underline-offset-2">privacy notice</Link>.
      </p>
      <div className="mt-3.5">
        {armed ? (
          <div className="flex flex-wrap items-center gap-2">
            <ActionButton
              onAction={async () => {
                await clearIntakeData();
                setArmed(false);
                onCleared();
              }}
              className="btn"
              style={{ background: "var(--danger)", color: "#fff" }}
              loadingLabel="Deleting"
              successToast="Field data deleted from this device"
            >
              Yes, delete everything
            </ActionButton>
            <button onClick={() => setArmed(false)} className="btn btn-ghost">
              Cancel
            </button>
          </div>
        ) : (
          <button onClick={() => setArmed(true)} className="btn btn-danger">
            Delete field data
          </button>
        )}
      </div>
    </section>
  );
}

// Segmented path selector. Choosing a path is synchronous, so the fill flip IS the
// acknowledgement; a spinner here would be a lie.
function PathButton({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex min-h-[58px] flex-col items-start justify-center gap-0.5 px-4 py-2.5 text-left"
      style={{
        background: active ? "var(--accent)" : "var(--bg-1)",
        color: active ? "var(--accent-fg)" : "var(--fg-muted)",
        transition: "background-color var(--dur-fast) ease, color var(--dur-fast) ease",
      }}
    >
      <span className="text-[0.98rem] font-semibold leading-tight">{label}</span>
      {/* 0.85 is the lowest opacity that keeps the hint above 4.5:1 on the
          accent fill in both themes. */}
      <span
        className="text-[0.74rem] font-medium leading-tight"
        style={{ opacity: active ? 0.85 : 1 }}
      >
        {hint}
      </span>
    </button>
  );
}
