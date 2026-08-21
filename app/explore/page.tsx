"use client";

/**
 * The free public layer, a global map of flagged clearing, no login, plus
 * public reporting. Written for a first-time visitor (a journalist, an NGO, a
 * citizen), not as a debug view: it explains what the map is, states the caveat
 * that flagged ≠ proven illegal, and makes reporting one tap.
 *
 * Deliberately English-only: this layer is the outward-facing evidence surface,
 * separate from the trilingual farmer/officer app.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, Info, MapPinned, ShieldAlert, WifiOff } from "lucide-react";
import ActionButton from "@/components/motion/ActionButton";
import { Skeleton, SkeletonMap, SkeletonText } from "@/components/motion/Skeleton";
import DisputeForm, { type DisputeReceipt } from "@/components/public/DisputeForm";
import { confidenceBand, countryName } from "@/lib/public/format";
import { stepTransition } from "@/lib/motion/variants";
import { t, useLang } from "@/lib/i18n";
import type { DisputeStance } from "@/lib/public/types";

const PublicMap = dynamic(() => import("@/components/public/PublicMap"), {
  ssr: false,
  loading: () => <SkeletonMap className="h-full" label="Loading map" />,
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
/** The map's data has three honest states; "no flags" is not one of them until
 *  the fetch has actually succeeded. */
type LoadState = "loading" | "ready" | "error";

export default function ExplorePage() {
  const lang = useLang();
  const reduce = useReducedMotion();
  const [features, setFeatures] = useState<Feature[]>([]);
  const [load状, setLoadState] = useState<LoadState>("loading");
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [panel, setPanel] = useState<Panel>("about");
  const [reportMode, setReportMode] = useState(false);
  const [pin, setPin] = useState<[number, number] | null>(null);
  const [formStance, setFormStance] = useState<DisputeStance>("dispute");
  const [country, setCountry] = useState<string>("all");
  const [receipt, setReceipt] = useState<DisputeReceipt | null>(null);

  const load = useCallback(async () => {
    setLoadState("loading");
    try {
      const res = await fetch("/api/public/flagged");
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setFeatures(data.features ?? []);
      setLoadState("ready");
    } catch {
      // Rethrown by the retry button so it can shake; the banner covers the
      // first, automatic attempt.
      setLoadState("error");
      throw new Error("Could not load the flagged locations.");
    }
  }, []);
  useEffect(() => {
    void load().catch(() => {});
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

  const onSubmitted = (r: DisputeReceipt) => {
    setReceipt(r);
    setPanel("thanks");
    setReportMode(false);
    void load().catch(() => {});
  };

  // Only claim the map is empty once we know it is.
  const emptyHint =
    load状 !== "ready"
      ? null
      : features.length === 0
        ? "No flagged locations published yet"
        : shown.length === 0
          ? `No flagged locations in ${countryName(country)}`
          : null;

  return (
    <div className="flex h-[calc(100dvh-var(--nav-h))] flex-col">
      <header className="glass-nav z-10 flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="eyebrow">Public layer · no login</p>
          <h1 className="truncate text-lg font-semibold tracking-tight">
            Open Deforestation Map
          </h1>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPanel("about")}
            aria-pressed={panel === "about"}
            className={`chip ${panel === "about" ? "chip-active" : ""}`}
          >
            <Info size={13} className="mr-1.5" aria-hidden="true" /> About
          </button>

          {countries.length > 0 && (
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="field !min-h-9 !w-auto py-1.5 text-sm"
              aria-label="Filter the map by country"
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
            type="button"
            onClick={() => {
              setReportMode((v) => !v);
              setPanel("about");
              setPin(null);
            }}
            aria-pressed={reportMode}
            className={`btn btn-sm ${reportMode ? "btn-primary" : "btn-ghost"}`}
          >
            <MapPinned size={14} className="mr-1.5" aria-hidden="true" />
            {reportMode ? "Cancel reporting" : "Report clearing"}
          </button>
        </div>
      </header>

      {/* Report mode is a mode: it gets a persistent, unmissable strip. */}
      <AnimatePresence initial={false}>
        {reportMode && (
          <motion.div
            key="report-hint"
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
            style={{ background: "var(--info-soft)", color: "var(--info)" }}
          >
            <p className="px-4 py-2 text-sm sm:px-5" role="status">
              Tap the location on the map where you&apos;ve seen clearing that isn&apos;t marked.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="min-h-64 flex-1 md:min-h-0">
          <PublicMap
            features={shown}
            selectedId={selectedId}
            reportMode={reportMode}
            pin={pin}
            onSelectFeature={selectFeature}
            onDropPin={dropPin}
            emptyHint={emptyHint}
          />
        </div>

        <aside
          className="glass-nav w-full shrink-0 overflow-y-auto md:w-96 lg:w-[26rem]"
          style={{ borderTop: "1px solid var(--glass-hairline)" }}
          aria-label="Map details and reporting"
        >
          <div className="p-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={panel}
                variants={reduce ? undefined : stepTransition}
                initial="initial"
                animate="enter"
                exit="exit"
              >
                {panel === "about" && (
                  <About
                    state={load状}
                    lang={lang}
                    features={features}
                    shown={shown}
                    country={country}
                    onRetry={load}
                    onResetCountry={() => setCountry("all")}
                    onSelect={selectFeature}
                  />
                )}

                {panel === "feature" && selected && (
                  <FeatureCard
                    f={selected.properties}
                    onConfirm={() => openForm("confirm")}
                    onDispute={() => openForm("dispute")}
                    onBack={() => setPanel("about")}
                  />
                )}

                {panel === "form" && (
                  <div className="flex flex-col gap-4">
                    <div>
                      <p className="eyebrow">Community label</p>
                      <h2 className="text-base font-semibold tracking-tight">
                        {selected ? "Report on this location" : "Report clearing you've seen"}
                      </h2>
                    </div>
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
                  <Thanks
                    receipt={receipt}
                    onDone={() => {
                      setPanel("about");
                      setPin(null);
                    }}
                    onAnother={() => {
                      setPin(null);
                      setSelectedId(undefined);
                      setReportMode(true);
                      setPanel("about");
                    }}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </aside>
      </div>
    </div>
  );
}

function About({
  state,
  lang,
  features,
  shown,
  country,
  onRetry,
  onResetCountry,
  onSelect,
}: {
  state: LoadState;
  lang: ReturnType<typeof useLang>;
  features: Feature[];
  shown: Feature[];
  country: string;
  onRetry: () => Promise<void>;
  onResetCountry: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-col gap-2">
        <h2 className="text-base font-semibold tracking-tight">What is this?</h2>
        <p className="muted">
          A global, open map of places where satellite imagery suggests forest was
          cleared after <strong>31 December 2020</strong>, the cut-off in the EU
          Deforestation Regulation.
        </p>
      </div>

      {state === "loading" && (
        <div className="flex flex-col gap-3" aria-busy="true">
          <SkeletonText lines={3} />
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
          <p className="text-xs faint" aria-live="polite">
            {t(lang, "loading")} flagged locations…
          </p>
        </div>
      )}

      {state === "error" && (
        <div className="flex flex-col gap-3">
          <div
            className="flex items-start gap-2.5 rounded-xl p-3"
            style={{ background: "var(--danger-soft)", color: "var(--danger)", border: "1px solid var(--danger)" }}
            role="alert"
          >
            <WifiOff size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              <strong>The flagged locations didn&apos;t load.</strong> The map and
              reporting still work; what&apos;s missing is the list of existing flags.
            </span>
          </div>
          <ActionButton
            onAction={onRetry}
            className="btn btn-ghost btn-sm self-start"
            loadingLabel={t(lang, "loading")}
          >
            {t(lang, "retry_label")}
          </ActionButton>
        </div>
      )}

      {state === "ready" && features.length === 0 && (
        <div className="flex flex-col gap-3">
          <div
            className="flex items-start gap-2.5 rounded-xl p-3"
            style={{ background: "var(--info-soft)", color: "var(--info)", border: "1px solid var(--info)" }}
          >
            <ShieldAlert size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
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
      )}

      {state === "ready" && features.length > 0 && (
        <div className="flex flex-col gap-4">
          <p className="muted" aria-live="polite">
            Showing <strong>{shown.length}</strong> of {features.length} flagged
            {features.length === 1 ? " location" : " locations"}
            {country !== "all" && ` in ${countryName(country)}`}.
          </p>

          <div
            className="flex items-start gap-2.5 rounded-xl p-3"
            style={{ background: "var(--warn-soft)", color: "var(--warn)", border: "1px solid var(--warn)" }}
          >
            <ShieldAlert size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              <strong>Read this first.</strong> A flag means <em>possible</em> forest-cover
              loss detected from orbit, <strong>not</strong> proof of illegal activity.
              Legal harvest looks identical to illegal clearing from space, and mature
              rubber or oil palm can read as natural forest. Treat a flag as a lead to
              check, not a verdict.
            </span>
          </div>

          {shown.length === 0 ? (
            <div className="flex flex-col items-start gap-2 rounded-xl p-4 text-center" style={{ border: "1px dashed var(--glass-border)" }}>
              <p className="w-full muted">
                No flagged locations in {countryName(country)} in this view.
              </p>
              <button type="button" onClick={onResetCountry} className="chip mx-auto">
                Show all countries
              </button>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {shown.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(f.id)}
                    className="tile w-full text-left"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{countryName(f.properties.countryCode)}</span>
                      <span className="tag tag-warn">{confidenceBand(f.properties.confidence)}</span>
                    </span>
                    <span className="mt-1 block text-xs faint">
                      {f.properties.commodity ?? "Commodity unknown"} ·{" "}
                      {f.properties.reports.confirm} agree · {f.properties.reports.dispute} dispute
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="muted">
            Red areas are flagged clearing. Tap one to see the details and tell us whether
            it looks right or wrong. Seen clearing that isn&apos;t on the map? Use{" "}
            <strong>Report clearing</strong> to drop a pin anywhere.
          </p>
        </div>
      )}

      <hr className="hairline" />
      <p className="text-xs faint">
        Locations are shown without any landholder identity. Reports may be published
        as open data -{" "}
        {/* A route handler that streams a file, not a client-side navigation, so
            this stays a plain anchor rather than a PendingLink. */}
        <a
          href="/api/public/disputes/export"
          className="underline underline-offset-2"
          style={{ color: "var(--accent)" }}
        >
          download the labels
        </a>
        {" "}(opens a file download).
      </p>
    </div>
  );
}

function FeatureCard({
  f,
  onConfirm,
  onDispute,
  onBack,
}: {
  f: FeatureProps;
  onConfirm: () => void;
  onDispute: () => void;
  onBack: () => void;
}) {
  const band = confidenceBand(f.confidence);
  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-col gap-2">
        <span className="tag" style={{ background: "var(--danger-soft)", color: "var(--danger)" }}>
          flagged clearing
        </span>
        <h2 className="text-base font-semibold tracking-tight">{countryName(f.countryCode)}</h2>
        {f.commodity && <p className="muted">Likely commodity: {f.commodity}</p>}
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
        <dt className="faint">Detection confidence</dt>
        <dd className="text-right">{band}</dd>
        {f.clearingWindow && (
          <>
            <dt className="faint">Clearing window</dt>
            <dd className="text-right">
              {f.clearingWindow.earliest} → {f.clearingWindow.latest}
            </dd>
          </>
        )}
        <dt className="faint">Observed through</dt>
        <dd className="text-right">{f.observedThrough}</dd>
        <dt className="faint">Community reports</dt>
        <dd className="text-right">
          {f.reports.confirm} agree · {f.reports.dispute} dispute
        </dd>
      </dl>

      <p className="rounded-xl p-3 text-xs" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>
        Flagged means possible clearing detected by satellite, not proof of illegal
        activity. Legal harvest and mature plantations can look the same from orbit.
      </p>

      {/* Both open the report form in place: instant panel change, no spinner. */}
      <div className="flex gap-2">
        <button type="button" onClick={onConfirm} className="btn btn-primary btn-sm flex-1">
          This looks right
        </button>
        <button type="button" onClick={onDispute} className="btn btn-ghost btn-sm flex-1">
          This looks wrong
        </button>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs faint">
          Model {f.modelVersion} · detected {f.detectedAt.slice(0, 10)}
        </p>
        <button type="button" onClick={onBack} className="chip shrink-0">
          Back
        </button>
      </div>
    </div>
  );
}

/** A farmer or journalist just made an accusation-adjacent claim under their own
 *  name. The acknowledgement has to state exactly what was stored, what it is
 *  not, and what happens next, without promising a follow-up we cannot deliver
 *  (there is no account, so there is no way to notify them). */
function Thanks({
  receipt,
  onDone,
  onAnother,
}: {
  receipt: DisputeReceipt | null;
  onDone: () => void;
  onAnother: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 text-sm" role="status">
      <div className="flex items-start gap-2.5">
        <CheckCircle2 size={20} className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }} aria-hidden="true" />
        <div>
          <h2 className="text-base font-semibold tracking-tight" style={{ color: "var(--accent)" }}>
            Report received
          </h2>
          <p className="muted">It is saved. You don&apos;t need to do anything else.</p>
        </div>
      </div>

      {receipt?.id && (
        <div className="glass-card p-3">
          <p className="eyebrow">Your reference</p>
          <p className="mt-1 font-mono text-sm break-all">{receipt.id}</p>
          <p className="mt-1 text-xs faint">
            There is no account here, so we can&apos;t email you. Keep this if you
            want to refer to the report later.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p className="eyebrow">What happens next</p>
        <ol className="flex flex-col gap-2 muted">
          <li className="flex gap-2.5">
            <span className="tag tag-muted shrink-0">1</span>
            <span>
              It is stored as an <strong>unverified</strong> label
              {receipt?.reviewStatus ? ` (status: ${receipt.reviewStatus})` : ""} — not
              as a finding, and not as an accusation against anyone.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="tag tag-muted shrink-0">2</span>
            <span>A reviewer checks it against imagery and any other reports for the same place.</span>
          </li>
          <li className="flex gap-2.5">
            <span className="tag tag-muted shrink-0">3</span>
            <span>
              Reviewed labels are published as open data and used to correct the
              detection model. That is how the map gets more accurate.
            </span>
          </li>
        </ol>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onDone} className="btn btn-primary btn-sm">
          Back to the map
        </button>
        <button type="button" onClick={onAnother} className="btn btn-ghost btn-sm">
          Report another location
        </button>
      </div>
    </div>
  );
}
