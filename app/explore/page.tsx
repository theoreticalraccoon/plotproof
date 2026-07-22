"use client";

/**
 * The free public layer, a global map of flagged clearing, no login, plus
 * public reporting. Written for a first-time visitor (a journalist, an NGO, a
 * citizen), not as a debug view: it explains what the map is, states the caveat
 * that flagged ≠ proven illegal, and makes reporting one tap.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { ShieldAlert } from "lucide-react";
import DisputeForm from "@/components/public/DisputeForm";
import { confidenceBand, countryName } from "@/lib/public/format";
import { stepTransition } from "@/lib/motion/variants";
import type { DisputeStance } from "@/lib/public/types";

const PublicMap = dynamic(() => import("@/components/public/PublicMap"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center gap-2 text-sm faint"><span className="spinner" aria-hidden="true" /> Loading map…</div>,
});

interface FeatureProps {
  id: string;
  countryCode: string;
  commodity?: string;
  confidence: number;
  clearingWindow?: { earliest: string; latest: string };
  detectedAt: string;
  observedThrough: string;
  modelVersion: string;
  centroid: [number, number];
  reports: { confirm: number; dispute: number };
}
interface Feature {
  id: string;
  geometry: { type: "Polygon"; coordinates: number[][][] };
  properties: FeatureProps;
}

type Panel = "about" | "feature" | "form" | "thanks";

export default function ExplorePage() {
  const [features, setFeatures] = useState<Feature[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [panel, setPanel] = useState<Panel>("about");
  const [reportMode, setReportMode] = useState(false);
  const [pin, setPin] = useState<[number, number] | null>(null);
  const [formStance, setFormStance] = useState<DisputeStance>("dispute");
  const [country, setCountry] = useState<string>("all");

  const load = useCallback(async () => {
    const res = await fetch("/api/public/flagged");
    const data = await res.json();
    setFeatures(data.features ?? []);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const countries = useMemo(
    () => [...new Set(features.map((f) => f.properties.countryCode))].sort(),
    [features],
  );
  const shown = useMemo(
    () => (country === "all" ? features : features.filter((f) => f.properties.countryCode === country)),
    [features, country],
  );
  const selected = features.find((f) => f.id === selectedId);

  const selectFeature = useCallback((id: string) => {
    setSelectedId(id);
    setPanel("feature");
    setReportMode(false);
    setPin(null);
  }, []);

  const dropPin = useCallback((lngLat: [number, number]) => {
    setPin(lngLat);
    setSelectedId(undefined);
    setFormStance("dispute");
    setPanel("form");
  }, []);

  const openForm = (stance: DisputeStance) => {
    setFormStance(stance);
    setPanel("form");
  };

  const onSubmitted = () => {
    setPanel("thanks");
    setReportMode(false);
    void load();
  };

  return (
    <div className="flex h-[calc(100dvh-var(--nav-h))] flex-col">
      <header className="glass-nav z-10 flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <h1 className="text-lg font-semibold tracking-tight">
          Open Deforestation Map
        </h1>
        <button onClick={() => setPanel("about")} className="text-sm muted underline underline-offset-2">
          About
        </button>
        <div className="ml-auto flex items-center gap-2">
          {countries.length > 0 && (
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="field !min-h-0 !w-auto py-1.5 text-sm"
              aria-label="Filter by country"
            >
              <option value="all">All countries</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {countryName(c)}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => {
              setReportMode((v) => !v);
              setPanel("about");
              setPin(null);
            }}
            className={`btn btn-sm ${reportMode ? "btn-primary" : "btn-ghost"}`}
          >
            {reportMode ? "Tap the map…" : "Report clearing"}
          </button>
        </div>
      </header>

      {reportMode && (
        <div className="px-4 py-2 text-sm" style={{ background: "var(--info-soft)", color: "var(--info)" }}>
          Tap the location on the map where you&apos;ve seen clearing that isn&apos;t marked.
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="min-h-0 flex-1">
          <PublicMap
            features={shown}
            selectedId={selectedId}
            reportMode={reportMode}
            pin={pin}
            onSelectFeature={selectFeature}
            onDropPin={dropPin}
          />
        </div>

        <aside className="glass-nav w-full overflow-auto p-4 md:w-96">
          <AnimatePresence mode="wait">
            <motion.div key={panel} variants={stepTransition} initial="initial" animate="enter" exit="exit">
              {panel === "about" && <About count={features.length} />}

              {panel === "feature" && selected && (
                <FeatureCard f={selected.properties} onConfirm={() => openForm("confirm")} onDispute={() => openForm("dispute")} />
              )}

              {panel === "form" && (
                <div>
                  <h2 className="mb-2 font-semibold">
                    {selected ? "Report on this location" : "Report clearing you've seen"}
                  </h2>
                  <DisputeForm
                    featureId={selected?.id}
                    location={selected?.properties.centroid ?? pin ?? [0, 0]}
                    countryCode={selected?.properties.countryCode}
                    initialStance={formStance}
                    onSubmitted={onSubmitted}
                    onCancel={() => setPanel(selected ? "feature" : "about")}
                  />
                </div>
              )}

              {panel === "thanks" && (
                <div className="flex flex-col gap-3">
                  <h2 className="font-semibold" style={{ color: "var(--accent)" }}>Thank you, report received.</h2>
                  <p className="text-sm muted">
                    It&apos;s stored as an unverified label and will be reviewed. Reports like
                    yours are how the map gets more accurate.
                  </p>
                  <button
                    onClick={() => {
                      setPanel("about");
                      setPin(null);
                    }}
                    className="btn btn-primary self-start"
                  >
                    Back to the map
                  </button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </aside>
      </div>
    </div>
  );
}

function About({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <h2 className="font-semibold">What is this?</h2>
      <p className="muted">
        A global, open map of places where satellite imagery suggests forest was
        cleared after <strong>31 December 2020</strong>, the cut-off in the EU
        Deforestation Regulation.
      </p>

      {count === 0 ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2.5 rounded-xl p-3" style={{ background: "var(--info-soft)", color: "var(--info)", border: "1px solid var(--info)" }}>
            <ShieldAlert size={17} className="mt-0.5 shrink-0" />
            <span>
              <strong>No verified clearings are published yet.</strong> This map
              will only ever show detections from a citable source we can name.
              We would rather show you an empty map than a plausible one.
            </span>
          </div>
          <p className="muted">
            Marking a location as cleared is an accusation against whoever farms
            it, so nothing appears here until it comes from published detection
            data that anyone can check independently.
          </p>
          <p className="muted">
            You can still report clearing you have seen. Tap{" "}
            <strong>Report clearing</strong> to drop a pin anywhere on the map.
            Reports are stored as unverified community labels, never as findings.
          </p>
        </div>
      ) : (
        <>
          <p className="muted">
            It currently shows <strong>{count}</strong> flagged locations.
          </p>
          <div className="flex items-start gap-2.5 rounded-xl p-3" style={{ background: "var(--warn-soft)", color: "var(--warn)", border: "1px solid var(--warn)" }}>
            <ShieldAlert size={17} className="mt-0.5 shrink-0" />
            <span>
              <strong>Read this first.</strong> A flag means <em>possible</em> forest-cover
              loss detected from orbit, <strong>not</strong> proof of illegal activity.
              Legal harvest looks identical to illegal clearing from space, and mature
              rubber or oil palm can read as natural forest. Treat a flag as a lead to
              check, not a verdict.
            </span>
          </div>
          <p className="muted">
            Red areas are flagged clearing. Tap one to see the details and tell us whether
            it looks right or wrong. Seen clearing that isn&apos;t on the map? Use{" "}
            <strong>Report clearing</strong> to drop a pin anywhere.
          </p>
        </>
      )}
      <p className="text-xs faint">
        Locations are shown without any landholder identity. Reports may be published
        as open data -{" "}
        <a href="/api/public/disputes/export" className="underline underline-offset-2" style={{ color: "var(--accent)" }}>
          download the labels
        </a>
        .
      </p>
    </div>
  );
}

function FeatureCard({
  f,
  onConfirm,
  onDispute,
}: {
  f: FeatureProps;
  onConfirm: () => void;
  onDispute: () => void;
}) {
  const band = confidenceBand(f.confidence);
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div>
        <span className="tag" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
          flagged clearing
        </span>
        <h2 className="mt-2 text-base font-semibold">{countryName(f.countryCode)}</h2>
        {f.commodity && <p className="muted">Likely commodity: {f.commodity}</p>}
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
        <dt className="faint">Detection confidence</dt>
        <dd>{band}</dd>
        {f.clearingWindow && (
          <>
            <dt className="faint">Clearing window</dt>
            <dd>
              {f.clearingWindow.earliest} → {f.clearingWindow.latest}
            </dd>
          </>
        )}
        <dt className="faint">Observed through</dt>
        <dd>{f.observedThrough}</dd>
        <dt className="faint">Community reports</dt>
        <dd>
          {f.reports.confirm} agree · {f.reports.dispute} dispute
        </dd>
      </dl>

      <p className="rounded-xl p-3 text-xs" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>
        Flagged means possible clearing detected by satellite, not proof of illegal
        activity. Legal harvest and mature plantations can look the same from orbit.
      </p>

      <div className="flex gap-2">
        <button onClick={onConfirm} className="btn btn-primary btn-sm flex-1">
          This looks right
        </button>
        <button onClick={onDispute} className="btn btn-ghost btn-sm flex-1">
          This looks wrong
        </button>
      </div>
      <p className="text-xs faint">
        Model {f.modelVersion} · detected {f.detectedAt.slice(0, 10)}
      </p>
    </div>
  );
}
