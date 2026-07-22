"use client";

/**
 * Evidence pack (on-screen). The demo's "show the generated pack" step.
 *
 * Every way the analysis step can stall is handled explicitly, cold serverless
 * start, queued/running job, slow network, outright failure, or an
 * insufficient-data verdict, each degrades into a sentence the presenter can
 * read out, never a spinner or a stack trace. Print / Save-as-PDF is the pack
 * output for now (the PDFKit generator is still parked on caveats sign-off).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Printer } from "lucide-react";
import Reveal from "@/components/motion/Reveal";
import Breadcrumb from "@/components/shell/Breadcrumb";
import { Skeleton } from "@/components/motion/Skeleton";
import { hoverLift } from "@/lib/motion/variants";
import { printAs } from "@/lib/print";
import { getAttestationForPlot, getFarmer, getPlot, mediaObjectUrl } from "@/lib/intake/store";
import { captureConfidence } from "@/lib/intake/confidence";
import { fetchJson, NetError, warmup } from "@/lib/net";
import type { AnalysisResult, JobHandle, JobPoll } from "@/lib/analysis";
import type { LocalAttestation, LocalFarmer, LocalPlot } from "@/lib/intake/types";
import type { AcousticExhibit } from "@/lib/acoustic/types";

const CUTOFF = "2020-12-31";
const POLL_MS = 1200;
const MAX_WAIT_MS = 45_000;

type JobState =
  | "loading" // reading the plot from the device
  | "notfound"
  | "warming" // waking the analysis service
  | "queued"
  | "running"
  | "ready"
  | "slow" // taking longer than expected, still trying
  | "failed";

export default function EvidencePackPage() {
  const { id } = useParams<{ id: string }>();
  const [plot, setPlot] = useState<LocalPlot | null>(null);
  const [farmer, setFarmer] = useState<LocalFarmer | null>(null);
  const [attestation, setAttestation] = useState<LocalAttestation | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [acoustic, setAcoustic] = useState<AcousticExhibit | null>(null);
  const [state, setState] = useState<JobState>("loading");
  const [error, setError] = useState<string | null>(null);
  const cancelled = useRef(false);

  const runAnalysis = useCallback(async (p: LocalPlot) => {
    setError(null);
    setState("warming");
    warmup(); // wake a cold function before we need it
    try {
      const req = {
        plotId: p.id,
        geometry: { type: "Polygon" as const, coordinates: [p.ring] },
        countryCode: p.countryCode,
        commodity: p.commodity ?? "unknown",
        cutoffDate: CUTOFF,
      };
      const handle = await fetchJson<JobHandle>("/api/analysis/submit", {
        method: "POST",
        body: req,
        timeoutMs: 15000,
        retries: 2, // absorb a cold start
      });
      setState("queued");

      const deadline = Date.now() + MAX_WAIT_MS;
      for (;;) {
        if (cancelled.current) return;
        const poll = await fetchJson<JobPoll>(
          `/api/analysis/poll?jobId=${encodeURIComponent(handle.jobId)}`,
          { timeoutMs: 10000, retries: 2 },
        );
        if (poll.status === "succeeded") {
          setResult(poll.result);
          setState("ready");
          return;
        }
        if (poll.status === "failed") {
          setError("The analysis service reported a failure for this plot.");
          setState("failed");
          return;
        }
        setState(poll.status === "running" ? "running" : "queued");
        if (Date.now() > deadline) {
          setState("slow");
          return;
        }
        await sleep(POLL_MS);
      }
    } catch (e) {
      setError(e instanceof NetError ? e.message : "Analysis could not be started.");
      setState("failed");
    }
  }, []);

  // Load the plot from the device, then start analysis.
  useEffect(() => {
    cancelled.current = false;
    let revoked: string | null = null;
    (async () => {
      const p = await getPlot(id);
      if (!p) {
        setState("notfound");
        return;
      }
      setPlot(p);
      setFarmer((await getFarmer(p.farmerId)) ?? null);
      const att = (await getAttestationForPlot(p.id)) ?? null;
      setAttestation(att);
      if (att) {
        const url = await mediaObjectUrl(att.photoMediaId);
        if (url) {
          revoked = url;
          setPhotoUrl(url);
        }
      }
      const c = centroid(p.ring);
      void fetchJson<AcousticExhibit>(
        `/api/acoustic/exhibit?lng=${c.lng}&lat=${c.lat}&radiusKm=3&days=90`,
      )
        .then(setAcoustic)
        .catch(() => setAcoustic(null)); // acoustic is a bonus exhibit, never blocks
      await runAnalysis(p);
    })();
    return () => {
      cancelled.current = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [id, runAnalysis]);

  if (state === "loading")
    return (
      <main className="mx-auto max-w-3xl px-5 py-6 sm:px-6" role="status" aria-label="Loading the evidence pack">
        <Skeleton className="h-4 w-40" />
        <div className="glass-card mt-4 p-6 sm:p-8">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="mt-2 h-4 w-40" />
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-4" style={{ width: `${70 + (i % 3) * 10}%` }} />
            ))}
          </div>
          <Skeleton className="mt-6 h-28 w-full" />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Skeleton className="aspect-square w-full" />
            <Skeleton className="aspect-square w-full" />
          </div>
        </div>
      </main>
    );
  if (state === "notfound")
    return (
      <Centered>
        <p>This plot isn&apos;t on this device.</p>
        <a href="/intake" className="btn btn-primary mt-3">
          Go to intake
        </a>
      </Centered>
    );
  if (!plot) return null;

  const conf = captureConfidence(plot.captureMethod);
  const generatedAt = new Date();

  return (
    <main className="mx-auto max-w-3xl px-5 py-6 sm:px-6 print:p-0">
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Breadcrumb
          items={[
            { label: "Intake", href: "/intake" },
            { label: "EUDR evidence pack" },
          ]}
        />
        <motion.div {...hoverLift}>
          <button
            onClick={() => printAs(`EUDR Evidence Pack ${plot.id.slice(0, 8)}`)}
            disabled={state !== "ready"}
            className="btn btn-primary btn-sm"
          >
            <Printer size={15} /> Download PDF
          </button>
        </motion.div>
      </div>

      <Reveal>
      <article className="doc-sheet p-6 sm:p-8 print:border-0 print:p-0 print:shadow-none">
      <header className="border-b border-gray-300 pb-3">
        <h1 className="text-xl font-bold">EUDR Evidence Pack</h1>
        <p className="text-sm text-gray-600">PlotProof · document {plot.id.slice(0, 8)}</p>
      </header>

      {/* analysis status banner */}
      <JobBanner state={state} error={error} onRetry={() => plot && runAnalysis(plot)} />

      {/* identifiers */}
      <Section title="Plot & farmer">
        <Grid>
          <Field k="Farmer" v={farmer?.fullName ?? "-"} />
          <Field k="Farmer ID" v={farmer?.nationalId ?? attestation?.farmerIdSnapshot ?? "-"} />
          <Field k="Cooperative" v={plot.cooperativeId} />
          <Field k="Country" v={plot.countryCode} />
          <Field k="Commodity" v={plot.commodity ?? "-"} />
          <Field k="Capture method" v={`${conf.label} (${conf.level} confidence)`} />
          <Field k="Captured" v={`${plot.capturedAt} (UTC)`} />
          <Field k="Generated" v={`${generatedAt.toISOString()} (UTC) / ${generatedAt.toLocaleString()} (local)`} />
        </Grid>
        <p className="mt-1 text-xs text-gray-500">{conf.rationale}</p>
      </Section>

      {/* verdict */}
      <Section title="Verdict">
        {result ? (
          <div>
            <p className="text-lg font-semibold">{verdictSentence(result.verdict)}</p>
            <p className="text-sm text-gray-600">
              Detection confidence {(result.confidence * 100).toFixed(0)}% · model {result.modelVersion}
            </p>
            {result.verdict === "flagged" && result.clearingDateRange && (
              <p className="text-sm text-gray-600">
                Estimated clearing window {result.clearingDateRange.earliest} →{" "}
                {result.clearingDateRange.latest}
                {result.clearedHectares != null && ` · ~${result.clearedHectares.toFixed(2)} ha`}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Awaiting analysis result…</p>
        )}
      </Section>

      {/* geometry + CRS */}
      <Section title="Plot geometry">
        <Grid>
          <Field k="Drawn area" v={`${plot.computedAreaHa.toFixed(3)} ha`} />
          <Field k="Claimed area" v={plot.claimedAreaHa != null ? `${plot.claimedAreaHa.toFixed(3)} ha` : "-"} />
          <Field k="Area basis (CRS)" v="Geodesic on WGS84 ellipsoid (EPSG:4326)" />
          <Field k="Vertices" v={String(plot.ring.length - 1)} />
        </Grid>
        <p className="mt-1 text-xs text-gray-500">
          Authoritative equal-area recomputation in the country&apos;s projected CRS is
          performed server-side (pending schema); this figure is the on-device geodesic area.
        </p>
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-gray-600">Coordinate table (WGS84 lon, lat)</summary>
          <table className="mt-1 w-full max-w-sm text-left">
            <tbody>
              {plot.ring.slice(0, -1).map((pt, i) => (
                <tr key={i}>
                  <td className="pr-3 text-gray-400">{i + 1}</td>
                  <td className="pr-4 font-mono">{pt[0].toFixed(6)}</td>
                  <td className="font-mono">{pt[1].toFixed(6)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </Section>

      {/* imagery */}
      <Section title="Before / after imagery">
        {result && result.imagery.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {result.imagery.map((t, i) => (
              <figure key={i}>
                {t.url.startsWith("http") ? (
                  // Real rendered tile from the analysis service: true colour,
                  // plot outlined, acquisition date burned in, consistent stretch.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={t.url}
                    alt={`${t.role} satellite tile, ${t.acquisitionDate}`}
                    loading="lazy"
                    decoding="async"
                    className="aspect-square w-full rounded border border-gray-300 object-cover"
                  />
                ) : (
                  <div className="flex aspect-square items-center justify-center rounded border border-gray-300 bg-gray-100 text-xs text-gray-400">
                    sample imagery ({t.role}), stub result
                  </div>
                )}
                <figcaption className="mt-1 text-xs text-gray-600">
                  {t.role}: {t.acquisitionDate} · {t.sensor} · cloud {(t.cloudCover * 100).toFixed(0)}%
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            {result?.verdict === "insufficient_data"
              ? "No renderable imagery, insufficient clear observations for this plot."
              : "Imagery renders once analysis completes."}
          </p>
        )}
      </Section>

      {/* methodology */}
      <Section title="Methodology">
        <ul className="list-disc pl-5 text-sm text-gray-700">
          <li>Model: {result?.modelVersion ?? "-"} (U-Net per-pixel forest probability).</li>
          <li>
            Sources: Sentinel-2 L2A (optical, 10 m), Sentinel-1 GRD (radar), Hansen Global
            Forest Change (baseline). Accessed {result?.dataAccessedAt?.slice(0, 10) ?? "-"} (UTC).
          </li>
          <li>Assessment cut-off: {CUTOFF}. Forest definition: applicable national profile.</li>
          <li>Change detection outside the model: sustained forest-fraction drop across observations.</li>
        </ul>
      </Section>

      {/* caveats */}
      <Section title="Caveats">
        <div className="space-y-2 text-sm text-gray-700">
          <p>
            <strong>Scope.</strong> This pack reports possible forest-cover change within the
            mapped boundary between the observation dates. It does not establish who caused a
            change, whether it was lawful, or whether standing vegetation is natural forest.
          </p>
          <p>
            <strong>Legal harvesting is indistinguishable from illegal clearing</strong> from
            orbit. A flagged result means forest cover was lost, not that a rule was broken.
          </p>
          <p>
            <strong>Mature rubber and oil palm read as natural forest</strong> to optical
            sensors, so plantation can be misclassified either way.
          </p>
          <p>
            <strong>Plots below ~0.2 ha</strong> are at the edge of what 10 m imagery resolves;
            such plots return reduced confidence or insufficient data.
          </p>
        </div>
      </Section>

      {/* attestation exhibit */}
      <Section title="Attestation">
        {attestation ? (
          <div className="flex flex-wrap gap-4 text-sm">
            {photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="Plot" loading="lazy" decoding="async" className="max-h-40 rounded border" />
            )}
            <div>
              <Field k="Officer" v={attestation.officerName} />
              <Field k="Captured" v={`${attestation.capturedAt} (UTC)`} />
              <Field k="Farmer confirmed" v={`${attestation.farmerNameSnapshot} · ${attestation.confirmationMethod}`} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">This plot has not been attested in the field.</p>
        )}
      </Section>

      {/* acoustic exhibit */}
      <Section title="Acoustic corroboration (near this plot)">
        {acoustic && acoustic.summary.total > 0 ? (
          <div className="text-sm">
            <p>
              {acoustic.summary.chainsaw} chainsaw + {acoustic.summary.heavyVehicle} heavy-vehicle
              detections from {acoustic.summary.nodes} node(s) within {acoustic.radiusKm} km
              {acoustic.summary.firstAt &&
                `, ${acoustic.summary.firstAt.slice(0, 10)} → ${acoustic.summary.lastAt?.slice(0, 10)} (UTC)`}
              .
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No acoustic detections near this plot.</p>
        )}
      </Section>

      <footer className="mt-6 border-t border-gray-300 pt-3 text-xs text-gray-400">
        On-screen evidence pack. Downloadable PDF generation is pending final caveats sign-off.
      </footer>
      </article>
      </Reveal>
    </main>
  );
}

// --- pieces ---------------------------------------------------------------

function JobBanner({ state, error, onRetry }: { state: JobState; error: string | null; onRetry: () => void }) {
  if (state === "ready") return null;
  const copy: Record<string, string> = {
    warming: "Waking the analysis service (first run can take a few seconds)…",
    queued: "Analysis queued, waiting for the service to pick it up…",
    running: "Analysing satellite imagery for this plot…",
    slow: "Analysis is taking longer than usual, the network or service is slow.",
    failed: error ?? "Analysis couldn't be completed.",
  };
  const bad = state === "failed" || state === "slow";
  return (
    <div
      className="my-3 flex items-center gap-3 rounded-xl p-3 text-sm print:hidden"
      style={
        bad
          ? { background: "var(--warn-soft)", color: "var(--warn)" }
          : { background: "var(--info-soft)", color: "var(--info)" }
      }
    >
      {!bad && <span className="spinner" aria-hidden="true" />}
      <span>{copy[state]}</span>
      {bad && (
        <button onClick={onRetry} className="btn btn-ghost btn-sm ml-auto">
          Retry
        </button>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 break-inside-avoid">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h2>
      {children}
    </section>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">{children}</div>;
}
function Field({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <span className="text-gray-500">{k}: </span>
      <span className="text-gray-900">{v}</span>
    </div>
  );
}
function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh flex-col items-center justify-center gap-2 p-8 text-center text-sm muted">{children}</div>;
}

function verdictSentence(v: AnalysisResult["verdict"]): string {
  if (v === "clear") return "No forest-cover loss detected within this plot over the observed period.";
  if (v === "flagged") return "Possible forest-cover loss detected within this plot.";
  return "Not enough clear imagery to determine a verdict for this plot.";
}

function centroid(ring: [number, number][]): { lng: number; lat: number } {
  const pts = ring.slice(0, -1);
  const n = pts.length || 1;
  return {
    lng: pts.reduce((s, p) => s + p[0], 0) / n,
    lat: pts.reduce((s, p) => s + p[1], 0) / n,
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
