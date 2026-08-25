"use client";

/**
 * Evidence pack (on-screen). The demo's "show the generated pack" step.
 *
 * Every way the analysis step can stall is handled explicitly, cold serverless
 * start, queued/running job, slow network, outright failure, or an
 * insufficient-data verdict, each degrades into a sentence the presenter can
 * read out, never a spinner or a stack trace. Print / Save-as-PDF is the pack
 * output; there is deliberately no server-side PDF generator.
 *
 * Layout note: the sheet is set like a filed document, section label in the
 * left margin and the body in a single measured column, so a reader scans the
 * labels down the edge and reads across only where they stop. Page chrome
 * (toolbar, job status) lives OUTSIDE the sheet — it is not part of the record
 * and it must not print.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, FileJson, Printer } from "lucide-react";
import Reveal from "@/components/motion/Reveal";
import ActionButton from "@/components/motion/ActionButton";
import PendingLink from "@/components/motion/PendingLink";
import Breadcrumb from "@/components/shell/Breadcrumb";
import { Skeleton } from "@/components/motion/Skeleton";
import { staggerContainer, staggerItem } from "@/lib/motion/variants";
import { printAs } from "@/lib/print";
import { getAttestationForPlot, getFarmer, getPlot, mediaBlob, mediaObjectUrl } from "@/lib/intake/store";
import { verifyAttestationIntegrity, type VerifyResult } from "@/lib/intake/integrity";
import { captureConfidence } from "@/lib/intake/confidence";
import { fetchJson, NetError, warmup } from "@/lib/net";
import type { AnalysisResult, JobHandle, JobPoll } from "@/lib/analysis";
import type { LocalAttestation, LocalFarmer, LocalPlot } from "@/lib/intake/types";
import type { AcousticExhibit } from "@/lib/acoustic/types";

const CUTOFF = "2020-12-31";
const POLL_MS = 1200;
const MAX_WAIT_MS = 45_000;

/**
 * The sheet is white paper in BOTH themes (see .doc-sheet), so anything drawn
 * on it uses paper ink rather than theme tokens — a themed colour would go
 * orange-on-white in dark mode and fail contrast. These are the only hardcoded
 * colours in this file, and they are hardcoded for the same reason .doc-sheet
 * hardcodes its background.
 */
const INK_OK = "#15803d";
const INK_BAD = "#b91c1c";

/** Skeletons drawn on the paper sheet need paper-coloured tint and sheen for
 *  the same reason; the shimmer and its reduced-motion fallback still come
 *  from the shared .skeleton rules. */
const PAPER_SKELETON = {
  "--skeleton-tint": "rgba(17, 24, 39, 0.075)",
  "--skeleton-sheen": "rgba(255, 255, 255, 0.75)",
  "--skeleton-sheen-accent": "rgba(15, 107, 70, 0.07)",
} as React.CSSProperties;

type JobState =
  | "loading" // reading the plot from the device
  | "notfound"
  | "warming" // waking the analysis service
  | "queued"
  | "running"
  | "ready"
  | "slow" // taking longer than expected, still trying
  | "unavailable" // no analysis service connected: no verdict exists, say so
  | "failed";

export default function EvidencePackPage() {
  const { id } = useParams<{ id: string }>();
  const [plot, setPlot] = useState<LocalPlot | null>(null);
  const [farmer, setFarmer] = useState<LocalFarmer | null>(null);
  const [attestation, setAttestation] = useState<LocalAttestation | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [acoustic, setAcoustic] = useState<AcousticExhibit | null>(null);
  // Tracked separately from `acoustic`: a null exhibit that has not been asked
  // for yet is not the same claim as "no detections near this plot", and the
  // page must not make the second claim while the first is still true.
  const [acousticPending, setAcousticPending] = useState(true);
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
      if (e instanceof NetError && e.status === 503) {
        setState("unavailable");
        return;
      }
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
        .catch(() => setAcoustic(null)) // acoustic is a bonus exhibit, never blocks
        .finally(() => setAcousticPending(false));
      await runAnalysis(p);
    })();
    return () => {
      cancelled.current = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [id, runAnalysis]);

  if (state === "loading") return <PackSkeleton />;

  if (state === "notfound")
    return (
      <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-5 py-16 sm:px-6">
        <div style={{ height: 3, width: 44, background: "var(--accent)" }} aria-hidden="true" />
        <h1 className="font-display mt-5 text-[1.9rem] leading-[1.1] sm:text-[2.3rem]">
          This plot isn&apos;t on this device.
        </h1>
        <p className="mt-4 text-[0.95rem] muted" style={{ maxWidth: "58ch" }}>
          Field records live in the browser storage of the device that captured them.
        </p>
        <div className="mt-7">
          <PendingLink href="/intake" className="btn btn-primary">
            Go to intake
          </PendingLink>
        </div>
      </main>
    );

  if (!plot) return null;

  const conf = captureConfidence(plot.captureMethod);
  const generatedAt = new Date();
  const analysisPending =
    state === "warming" || state === "queued" || state === "running";
  const printReady = state === "ready" || state === "unavailable";
  const gfwUrl = `https://www.globalforestwatch.org/map/?map=${encodeURIComponent(
    JSON.stringify({
      center: { lat: centroid(plot.ring).lat, lng: centroid(plot.ring).lng },
      zoom: 14,
    }),
  )}`;

  return (
    <main className="mx-auto max-w-3xl px-5 py-6 sm:px-6 print:p-0">
      {/* ---- page chrome: not part of the record, never printed ---------- */}
      <div className="print:hidden">
        <Breadcrumb
          items={[
            { label: "Intake", href: "/intake" },
            { label: "EUDR evidence pack" },
          ]}
        />

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2.5">
          <span
            title={
              printReady
                ? undefined
                : "Available once the analysis step finishes or reports that no service is connected."
            }
          >
            <ActionButton
              className="btn btn-primary btn-sm"
              disabled={!printReady}
              onAction={() => printAs(`EUDR Evidence Pack ${plot.id.slice(0, 8)}`)}
              loadingLabel="Opening…"
              successToast="Print dialog opened. Choose Save as PDF for a file copy."
            >
              <Printer size={15} aria-hidden="true" /> Download PDF
            </ActionButton>
          </span>

          <ActionButton
            className="btn btn-ghost btn-sm"
            onAction={() => downloadDds(plot, farmer)}
            successToast={`Saved dds-geolocation-${plot.id.slice(0, 8)}.geojson to your downloads.`}
          >
            <FileJson size={15} aria-hidden="true" /> DDS geolocation (GeoJSON)
          </ActionButton>

          <span className="hidden h-5 w-px sm:block" style={{ background: "var(--glass-hairline)" }} aria-hidden="true" />

          {/* Independent cross-check: the authoritative public deforestation map
              at this plot's location. Their data, their verdict, not ours. */}
          <ExternalAction href={gfwUrl}>Check on Global Forest Watch</ExternalAction>

          {/* The shareable artifact: public, de-identified, honest about its
              own limits. Works once the plot has synced to the server. */}
          <ExternalAction href={`/verify/${plot.id}`} rel="noopener">
            Public verification page
          </ExternalAction>
        </div>

        {/* Status of the analysis step. It describes the page, not the record,
            so it sits above the sheet rather than inside it. */}
        <JobBanner state={state} error={error} onRetry={() => runAnalysis(plot)} />
      </div>

      {/* ---- the record ---------------------------------------------------- */}
      <Reveal>
        <article className="doc-sheet mt-5 px-6 py-7 sm:px-10 sm:py-9 print:mt-0 print:border-0 print:p-0 print:shadow-none">
          <header className="doc-rule flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-b pb-5">
            <div>
              <p className="doc-faint text-[0.66rem] font-semibold uppercase tracking-[0.18em]">
                PlotProof
              </p>
              <h1 className="mt-2 text-[1.75rem] font-bold leading-[1.08] tracking-tight sm:text-[2.1rem]">
                EUDR Evidence Pack
              </h1>
            </div>
            <dl className="doc-faint text-[0.72rem] leading-relaxed">
              <div className="flex gap-2">
                <dt>Document</dt>
                <dd className="font-mono" style={{ color: "#111827" }}>
                  {plot.id.slice(0, 8)}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt>Cut-off</dt>
                <dd className="font-mono" style={{ color: "#111827" }}>
                  {CUTOFF}
                </dd>
              </div>
            </dl>
          </header>

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
            <p className="doc-faint mt-4 text-[0.8rem] leading-relaxed" style={{ maxWidth: "68ch" }}>
              {conf.rationale}
            </p>
          </Section>

          <Section title="Satellite assessment">
            <div aria-busy={analysisPending || undefined}>
              {result ? (
                <div>
                  <p className="text-[1.1rem] font-semibold leading-snug" style={{ maxWidth: "48ch" }}>
                    {verdictSentence(result.verdict)}
                  </p>
                  <p className="doc-faint mt-2 text-[0.85rem]">
                    Detection confidence {(result.confidence * 100).toFixed(0)}% · model{" "}
                    {result.modelVersion}
                  </p>
                  {result.verdict === "flagged" && result.clearingDateRange && (
                    <p className="doc-faint mt-1 text-[0.85rem]">
                      Estimated clearing window {result.clearingDateRange.earliest} →{" "}
                      {result.clearingDateRange.latest}
                      {result.clearedHectares != null && ` · ~${result.clearedHectares.toFixed(2)} ha`}
                    </p>
                  )}
                </div>
              ) : state === "unavailable" ? (
                <div>
                  <p className="text-[1.1rem] font-semibold leading-snug" style={{ maxWidth: "48ch" }}>
                    No satellite assessment. None has been performed for this plot.
                  </p>
                  <p className="doc-faint mt-2 text-[0.85rem] leading-relaxed" style={{ maxWidth: "68ch" }}>
                    This deployment has no analysis service connected, so this pack
                    contains the plot geometry and field attestation only. Assess the
                    coordinates against the EU JRC Global Forest Cover 2020 layer and
                    Global Forest Watch before relying on them.
                  </p>
                </div>
              ) : analysisPending ? (
                <div role="status" aria-label="Awaiting the analysis result" className="print:hidden">
                  <PaperSkeleton className="h-5 w-full max-w-md" />
                  <PaperSkeleton className="skeleton-sm mt-2.5 h-5 w-2/3 max-w-sm" />
                  <PaperSkeleton className="skeleton-sm mt-4 h-3 w-56" />
                </div>
              ) : (
                <p className="doc-faint text-[0.9rem]">Awaiting analysis result…</p>
              )}
            </div>
          </Section>

          <Section title="Plot geometry">
            <Grid>
              <Field k="Drawn area" v={`${plot.computedAreaHa.toFixed(3)} ha`} mono />
              <Field
                k="Claimed area"
                v={plot.claimedAreaHa != null ? `${plot.claimedAreaHa.toFixed(3)} ha` : "-"}
                mono
              />
              <Field k="Area basis (CRS)" v="Geodesic on WGS84 ellipsoid (EPSG:4326)" />
              <Field k="Vertices" v={String(plot.ring.length - 1)} mono />
            </Grid>
            <p className="doc-faint mt-4 text-[0.8rem] leading-relaxed" style={{ maxWidth: "68ch" }}>
              Authoritative equal-area recomputation in the country&apos;s projected CRS is
              performed server-side (pending schema); this figure is the on-device geodesic area.
            </p>
            <details className="mt-4">
              <summary className="doc-faint inline-flex min-h-[32px] cursor-pointer items-center text-[0.8rem] font-medium">
                Coordinate table (WGS84 lon, lat)
              </summary>
              <table className="mt-2 w-full max-w-sm text-left text-[0.8rem]">
                <tbody>
                  {plot.ring.slice(0, -1).map((pt, i) => (
                    <tr key={i}>
                      <td className="doc-faint py-0.5 pr-4 tabular-nums">{i + 1}</td>
                      <td className="py-0.5 pr-5 font-mono tabular-nums">{pt[0].toFixed(6)}</td>
                      <td className="py-0.5 font-mono tabular-nums">{pt[1].toFixed(6)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </Section>

          <Section title="Before / after imagery">
            {result && result.imagery.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
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
                        className="doc-rule aspect-square w-full border object-cover"
                      />
                    ) : (
                      <div className="doc-rule doc-faint flex aspect-square items-center justify-center border text-center text-[0.75rem]">
                        sample imagery ({t.role}), stub result
                      </div>
                    )}
                    <figcaption className="doc-faint mt-2 text-[0.75rem] leading-snug">
                      {t.role}: {t.acquisitionDate} · {t.sensor} · cloud{" "}
                      {(t.cloudCover * 100).toFixed(0)}%
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : analysisPending ? (
              <div
                role="status"
                aria-label="Awaiting imagery"
                className="grid grid-cols-2 gap-4 print:hidden"
              >
                <PaperSkeleton className="aspect-square w-full" />
                <PaperSkeleton className="aspect-square w-full" />
              </div>
            ) : (
              <p className="doc-faint text-[0.9rem] leading-relaxed" style={{ maxWidth: "68ch" }}>
                {result?.verdict === "insufficient_data"
                  ? "No renderable imagery, insufficient clear observations for this plot."
                  : state === "unavailable"
                    ? "No satellite imagery, no analysis service is connected to this deployment."
                    : "Imagery renders once analysis completes."}
              </p>
            )}
          </Section>

          <Section title="Methodology">
            {result ? (
              <ul className="flex flex-col gap-2 text-[0.87rem] leading-relaxed" style={{ maxWidth: "70ch" }}>
                <Bullet>Model: {result.modelVersion}.</Bullet>
                <Bullet>
                  Sources: Sentinel-2 L2A (optical, 10 m), Sentinel-1 GRD (radar), Hansen Global
                  Forest Change (baseline). Accessed {result.dataAccessedAt?.slice(0, 10) ?? "-"} (UTC).
                </Bullet>
                <Bullet>
                  Assessment cut-off: {CUTOFF}. Forest definition: national parameters,{" "}
                  <strong>not yet verified against official national sources</strong>, treat
                  the threshold values as provisional.
                </Bullet>
                <Bullet>
                  Change detection outside the model: sustained forest-fraction drop across
                  observations.
                </Bullet>
              </ul>
            ) : (
              <p className="text-[0.87rem] leading-relaxed" style={{ maxWidth: "70ch" }}>
                No in-house satellite analysis is performed — deliberately. For deforestation
                context, consult the authoritative public datasets for these coordinates: JRC
                Tropical Moist Forest and Global Forest Watch (Hansen Global Forest Change).
                Plot geometry is captured on-device in WGS84 (EPSG:4326); area is geodesic.
                The EUDR cut-off date used throughout is {CUTOFF}.
              </p>
            )}
          </Section>

          {/* The caveats are the most legally consequential paragraphs in the
              pack, so they are set as a block of leading terms rather than as
              four more sentences of body copy. */}
          <Section title="Caveats">
            <dl className="flex flex-col gap-3.5 text-[0.87rem] leading-relaxed" style={{ maxWidth: "70ch" }}>
              <Caveat term="Scope.">
                This pack reports possible forest-cover change within the mapped boundary between
                the observation dates. It does not establish who caused a change, whether it was
                lawful, or whether standing vegetation is natural forest.
              </Caveat>
              <Caveat term="Legal harvesting is indistinguishable from illegal clearing">
                from orbit. A flagged result means forest cover was lost, not that a rule was broken.
              </Caveat>
              <Caveat term="Mature rubber and oil palm read as natural forest">
                to optical sensors, so plantation can be misclassified either way.
              </Caveat>
              <Caveat term="Plots below ~0.2 ha">
                are at the edge of what 10 m imagery resolves; such plots return reduced confidence
                or insufficient data.
              </Caveat>
            </dl>
          </Section>

          <Section title="Attestation">
            {attestation ? (
              <div className="flex flex-col gap-5">
                <div className="flex flex-wrap items-start gap-5">
                  {photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoUrl}
                      alt="Plot"
                      loading="lazy"
                      decoding="async"
                      className="doc-rule max-h-40 border object-cover"
                    />
                  )}
                  <dl className="flex min-w-0 flex-col gap-2.5">
                    <Field k="Officer" v={attestation.officerName} />
                    <Field k="Captured" v={`${attestation.capturedAt} (UTC)`} />
                    <Field
                      k="Farmer confirmed"
                      v={`${attestation.farmerNameSnapshot} · ${attestation.confirmationMethod}`}
                    />
                  </dl>
                </div>
                <IntegritySeal attestation={attestation} plot={plot} />
              </div>
            ) : (
              <p className="doc-faint text-[0.9rem]">This plot has not been attested in the field.</p>
            )}
          </Section>

          <Section title="Acoustic corroboration (near this plot)">
            {acousticPending ? (
              <div role="status" aria-label="Loading acoustic corroboration" className="print:hidden">
                <PaperSkeleton className="skeleton-sm h-3.5 w-full max-w-md" />
                <PaperSkeleton className="skeleton-sm mt-2 h-3.5 w-1/2 max-w-xs" />
              </div>
            ) : acoustic && acoustic.summary.total > 0 ? (
              <p className="text-[0.9rem] leading-relaxed" style={{ maxWidth: "70ch" }}>
                {acoustic.summary.chainsaw} chainsaw + {acoustic.summary.heavyVehicle} heavy-vehicle
                detections from {acoustic.summary.nodes} node(s) within {acoustic.radiusKm} km
                {acoustic.summary.firstAt &&
                  `, ${acoustic.summary.firstAt.slice(0, 10)} → ${acoustic.summary.lastAt?.slice(0, 10)} (UTC)`}
                .
              </p>
            ) : (
              <p className="doc-faint text-[0.9rem]">No acoustic detections near this plot.</p>
            )}
          </Section>

          <footer className="doc-rule doc-faint mt-8 border-t pt-4 text-[0.72rem]">
            On-screen evidence pack. Use Print / Save as PDF for a file copy.
          </footer>
        </article>
      </Reveal>
    </main>
  );
}

// --- pieces ---------------------------------------------------------------

/** A quiet tertiary action that leaves the app. Not a PendingLink: it opens a
 *  new tab, so there is no in-app navigation to report — the press scale and
 *  the outbound arrow are the whole acknowledgement. */
function ExternalAction({
  href,
  rel = "noopener noreferrer",
  children,
}: {
  href: string;
  rel?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel={rel}
      className="inline-flex min-h-[44px] items-center gap-1.5 text-[0.85rem] font-medium text-[color:var(--fg-muted)] underline decoration-[color:var(--glass-hairline)] underline-offset-[5px] transition-colors duration-150 hover:text-[color:var(--fg)] hover:decoration-[color:var(--accent)] active:text-[color:var(--accent)]"
    >
      {children}
      <ArrowUpRight size={14} strokeWidth={2} aria-hidden="true" />
    </a>
  );
}

/**
 * Status of the analysis step. Each state is a sentence a presenter can read
 * out; the tone rule on the left carries the severity and the text itself stays
 * at full contrast, so nothing is legible only by colour.
 */
function JobBanner({ state, error, onRetry }: { state: JobState; error: string | null; onRetry: () => Promise<void> }) {
  if (state === "ready") return null;
  const copy: Record<string, string> = {
    warming: "Waking the analysis service (first run can take a few seconds)…",
    queued: "Analysis queued, waiting for the service to pick it up…",
    running: "Analysing satellite imagery for this plot…",
    slow: "Analysis is taking longer than usual, the network or service is slow.",
    unavailable:
      "Satellite analysis is not connected in this deployment. This pack shows captured evidence only, no verdict is produced.",
    failed: error ?? "Analysis couldn't be completed.",
  };
  const bad = state === "failed" || state === "slow" || state === "unavailable";
  const tone = bad ? "var(--warn)" : "var(--info)";
  return (
    <div
      role="status"
      aria-busy={!bad || undefined}
      className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 print:hidden"
      style={{
        borderLeft: `3px solid ${tone}`,
        background: bad ? "var(--warn-soft)" : "var(--info-soft)",
        borderRadius: "0 var(--radius-sm) var(--radius-sm) 0",
      }}
    >
      <span
        className="text-[0.66rem] font-semibold uppercase tracking-[0.16em]"
        style={{ color: tone }}
      >
        Analysis
      </span>
      {!bad && <span className="spinner" aria-hidden="true" />}
      <span className="min-w-0 flex-1 text-[0.9rem] leading-snug" style={{ maxWidth: "68ch" }}>
        {copy[state]}
      </span>
      {bad && state !== "unavailable" && (
        <ActionButton className="btn btn-ghost btn-sm" onAction={onRetry} loadingLabel="Retrying…">
          Retry
        </ActionButton>
      )}
    </div>
  );
}

/** Section label in the left margin, body in one measured column. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="doc-rule mt-7 grid gap-x-8 gap-y-3 break-inside-avoid border-t pt-5 sm:grid-cols-[9rem_1fr]">
      <h2 className="doc-faint text-[0.68rem] font-semibold uppercase tracking-[0.14em]">{title}</h2>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-2 gap-x-6 gap-y-4">{children}</dl>;
}
function Field({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="doc-faint text-[0.65rem] font-semibold uppercase tracking-[0.1em]">{k}</dt>
      <dd className={`mt-1 text-[0.9rem] leading-snug break-words ${mono ? "font-mono tabular-nums" : ""}`}>
        {v}
      </dd>
    </div>
  );
}
function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="mt-[0.62rem] h-px w-3 shrink-0"
        style={{ background: "#9ca3af" }}
      />
      <span className="min-w-0">{children}</span>
    </li>
  );
}
function Caveat({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="inline font-semibold">{term}</dt>{" "}
      <dd className="inline">{children}</dd>
    </div>
  );
}

/**
 * The attestation's tamper-evidence seal. Shows the content hash and chain
 * position, and re-verifies every hash from the stored bytes on demand. The
 * caveat is stated on screen: this proves the record hasn't changed since
 * capture on the device, it does not independently prove the capture.
 */
function IntegritySeal({ attestation, plot }: { attestation: LocalAttestation; plot: LocalPlot | null }) {
  const [result, setResult] = useState<VerifyResult | null>(null);
  const reduce = useReducedMotion();
  const integrity = attestation.integrity;

  if (!integrity) {
    return (
      <p className="doc-faint text-[0.8rem] leading-relaxed" style={{ maxWidth: "70ch" }}>
        Saved before the integrity layer existed: this record carries no tamper-evidence seal.
      </p>
    );
  }

  const verify = async () => {
    if (!plot) throw new Error("The plot this attestation belongs to is not loaded.");
    const [photoBlob, signatureBlob] = await Promise.all([
      mediaBlob(attestation.photoMediaId),
      attestation.signatureMediaId ? mediaBlob(attestation.signatureMediaId) : undefined,
    ]);
    setResult(
      await verifyAttestationIntegrity({
        integrity,
        hashInput: {
          plotId: attestation.plotId,
          officerId: attestation.officerId,
          officerName: attestation.officerName,
          capturedAt: attestation.capturedAt,
          location: attestation.location,
          farmerNameSnapshot: attestation.farmerNameSnapshot,
          farmerIdSnapshot: attestation.farmerIdSnapshot,
          confirmationMethod: attestation.confirmationMethod,
          consentAt: attestation.consentAt,
        },
        ring: plot.ring,
        photoBlob,
        signatureBlob,
      }),
    );
  };

  const rows = result?.checks ?? [];

  return (
    <div className="doc-rule border-t pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <span className="doc-faint text-[0.65rem] font-semibold uppercase tracking-[0.1em]">
          Record seal (SHA-256)
        </span>
        <span className="doc-faint font-mono text-[0.72rem] tabular-nums">
          chain #{integrity.chainSeq}
        </span>
      </div>
      <p className="mt-1.5 break-all font-mono text-[0.78rem] leading-[1.7]">
        {integrity.contentHash}
      </p>
      <p className="doc-faint mt-3 text-[0.8rem] leading-relaxed" style={{ maxWidth: "70ch" }}>
        Photo, signature, boundary, and identity fields were hashed on the officer&apos;s device at
        save time and chained to the previous record. This makes later edits detectable; it does not
        by itself prove the original capture, and it is not yet anchored to an external timestamp.
      </p>
      <div className="mt-3 print:hidden">
        <ActionButton
          className="btn btn-ghost btn-sm"
          onAction={verify}
          disabled={!plot}
          loadingLabel="Verifying…"
          successLabel="Verified from stored bytes"
        >
          Re-verify from stored bytes
        </ActionButton>
      </div>
      {rows.length > 0 &&
        (reduce ? (
          <ul className="mt-3 flex flex-col gap-1">
            {rows.map((c) => (
              <CheckRow key={c.label} check={c} />
            ))}
          </ul>
        ) : (
          <motion.ul
            className="mt-3 flex flex-col gap-1"
            initial="hidden"
            animate="show"
            variants={staggerContainer(0.07)}
          >
            {rows.map((c) => (
              <motion.li key={c.label} variants={staggerItem}>
                <CheckRow check={c} bare />
              </motion.li>
            ))}
          </motion.ul>
        ))}
    </div>
  );
}

function CheckRow({ check, bare }: { check: VerifyResult["checks"][number]; bare?: boolean }) {
  const body = (
    <span className="flex gap-2 text-[0.8rem] leading-relaxed">
      <span aria-hidden="true" style={{ color: check.ok ? INK_OK : INK_BAD }}>
        {check.ok ? "✓" : "✗"}
      </span>
      <span className="min-w-0">
        <span style={{ color: check.ok ? INK_OK : INK_BAD }}>{check.label}</span>
        {check.detail && <span className="doc-faint"> — {check.detail}</span>}
      </span>
    </span>
  );
  return bare ? body : <li>{body}</li>;
}

/** Paper-safe skeleton (see PAPER_SKELETON). */
function PaperSkeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <Skeleton className={className} style={{ ...PAPER_SKELETON, ...style }} />;
}

/** Placeholder for the whole pack while the plot is read off the device. Same
 *  sheet, same margin-label grid, so nothing moves when the record arrives. */
function PackSkeleton() {
  return (
    <main
      className="mx-auto max-w-3xl px-5 py-6 sm:px-6"
      role="status"
      aria-busy="true"
      aria-label="Loading the evidence pack"
    >
      <div className="print:hidden">
        <Skeleton className="skeleton-sm h-4 w-56" />
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2.5">
          <Skeleton className="h-[38px] w-40" />
          <Skeleton className="h-[38px] w-56" />
        </div>
      </div>

      <div className="doc-sheet mt-5 px-6 py-7 sm:px-10 sm:py-9">
        <div className="doc-rule border-b pb-5">
          <PaperSkeleton className="skeleton-sm h-2.5 w-24" />
          <PaperSkeleton className="mt-3 h-8 w-72 max-w-full" />
        </div>
        {[8, 6, 4].map((fields, s) => (
          <div
            key={s}
            className="doc-rule mt-7 grid gap-x-8 gap-y-3 border-t pt-5 sm:grid-cols-[9rem_1fr]"
          >
            <PaperSkeleton className="skeleton-sm h-2.5 w-24" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {Array.from({ length: fields }).map((_, i) => (
                <div key={i}>
                  <PaperSkeleton className="skeleton-sm h-2 w-20" />
                  <PaperSkeleton className="skeleton-sm mt-2 h-3.5" style={{ width: `${60 + (i % 3) * 15}%` }} />
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="doc-rule mt-7 grid gap-x-8 gap-y-3 border-t pt-5 sm:grid-cols-[9rem_1fr]">
          <PaperSkeleton className="skeleton-sm h-2.5 w-24" />
          <div className="grid grid-cols-2 gap-4">
            <PaperSkeleton className="aspect-square w-full" />
            <PaperSkeleton className="aspect-square w-full" />
          </div>
        </div>
      </div>
    </main>
  );
}

function verdictSentence(v: AnalysisResult["verdict"]): string {
  if (v === "clear") return "No forest-cover loss detected within this plot over the observed period.";
  if (v === "flagged") return "Possible forest-cover loss detected within this plot.";
  return "Not enough clear imagery to determine a verdict for this plot.";
}

/**
 * TRACES-ready geolocation file. EUDR due diligence statements carry producer
 * geolocation as GeoJSON (WGS84, EPSG:4326); this emits one Feature per plot
 * with the property names the EU Information System expects, so an exporter or
 * cooperative can attach it to their DDS without reformatting.
 */
function downloadDds(plot: LocalPlot, farmer: LocalFarmer | null): void {
  const fc = {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        geometry: { type: "Polygon" as const, coordinates: [plot.ring] },
        properties: {
          ProducerName: farmer?.fullName ?? "",
          ProducerCountry: plot.countryCode,
          ProductionPlace: plot.id,
          Area: Number(plot.computedAreaHa.toFixed(4)),
        },
      },
    ],
  };
  const blob = new Blob([JSON.stringify(fc)], { type: "application/geo+json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dds-geolocation-${plot.id.slice(0, 8)}.geojson`;
  a.click();
  URL.revokeObjectURL(url);
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
