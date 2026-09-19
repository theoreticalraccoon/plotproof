"use client";

/** Evidence pack (on-screen). The demo's "show the generated pack" step. */
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
import type { LocalAttestation, LocalFarmer, LocalPlot } from "@/lib/intake/types";
import { lossThresholdHa, screenPlot, type VerdictLevel } from "@/lib/eudr/verdict";
import { latestCheck, requestCheck, saveCheck, type ForestCheck } from "@/lib/eudr/check";
import { useSaleBook } from "@/lib/sale/store";
import { t } from "@/lib/i18n";

const CUTOFF = "2020-12-31";

// The sheet is white paper in BOTH themes (see .doc-sheet), so anything drawn on it uses paper
// ink rather than theme tokens.
const INK_OK = "#15803d";
const INK_BAD = "#b91c1c";

// Skeletons drawn on the paper sheet need paper-coloured tint and sheen for the same reason;
// the shimmer and its reduced-motion fallback still come from the shared .skeleton rules.
const PAPER_SKELETON = {
  "--skeleton-tint": "rgba(17, 24, 39, 0.075)",
  "--skeleton-sheen": "rgba(255, 255, 255, 0.75)",
  "--skeleton-sheen-accent": "rgba(15, 107, 70, 0.07)",
} as React.CSSProperties;

/** Only the device read can stall now: the pack is assembled entirely from local records. */
type PackState = "loading" | "notfound" | "ready";

export default function EvidencePackPage() {
  const { id } = useParams<{ id: string }>();
  const [plot, setPlot] = useState<LocalPlot | null>(null);
  const [farmer, setFarmer] = useState<LocalFarmer | null>(null);
  const [attestation, setAttestation] = useState<LocalAttestation | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [state, setState] = useState<PackState>("loading");

  // Assemble the pack from the device. Everything here is local, so there is nothing to poll and
  // nothing that can time out.
  useEffect(() => {
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
      setState("ready");
    })();
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [id]);

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
          <ActionButton
            className="btn btn-primary btn-sm"
            onAction={() => printAs(`EUDR Evidence Pack ${plot.id.slice(0, 8)}`)}
            loadingLabel="Opening…"
            successToast="Print dialog opened. Choose Save as PDF for a file copy."
          >
            <Printer size={15} aria-hidden="true" /> Download PDF
          </ActionButton>

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

          <Section title="Forest status at these coordinates">
            <ForestStatus plot={plot} />
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

          <Section title="Methodology">
            <ul className="flex flex-col gap-2 text-[0.87rem] leading-relaxed" style={{ maxWidth: "70ch" }}>
              <Bullet>
                <strong>Published data, fixed rules.</strong> The boundary is sent to the Global
                Forest Watch Data API, which returns forest cover on 31 Dec 2020 (EU JRC Global
                Forest Cover), tree-cover loss since 2021 (Hansen/UMD), the recorded cause of that
                loss (WRI/Google drivers) and plantation overlap. Written rules turn those numbers
                into the rating above. There is no trained deforestation model: no labelled Sri
                Lankan ground truth exists to test one against, and every figure here can be
                re-checked against the source datasets.
              </Bullet>
              <Bullet>
                <strong>Screening threshold.</strong> Loss below 1% of the plot (minimum 0.05 ha)
                is treated as edge noise, not a finding.
              </Bullet>
              <Bullet>
                <strong>Geometry.</strong> Captured on-device in WGS84 (EPSG:4326); area is
                geodesic on the ellipsoid.
              </Bullet>
              <Bullet>
                <strong>Cut-off.</strong> The EUDR assessment date used throughout is {CUTOFF}.
              </Bullet>
            </ul>
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
              <Caveat term="Small plots.">
                Tree-cover loss is mapped at 30 m, about 0.09 ha a pixel, so on plots under about
                0.5 ha a handful of pixels decides the result.
              </Caveat>
              <Caveat term="A screening, not a compliance decision.">
                The EU operator files the due-diligence statement and may ask for more evidence.
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

          <footer className="doc-rule doc-faint mt-8 border-t pt-4 text-[0.72rem]">
            On-screen evidence pack. Use Print / Save as PDF for a file copy.
          </footer>
        </article>
      </Reveal>
    </main>
  );
}

// --- pieces ---------------------------------------------------------------

const LEVEL_INK: Record<VerdictLevel, string> = {
  low: INK_OK,
  review: "#b45309",
  high: INK_BAD,
  unknown: "#4b5563",
};

const ha2 = (n: number) => `${n.toFixed(2)} ha`;
const byArea = (m: Record<string, number>) =>
  Object.entries(m)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${ha2(v)}`)
    .join(", ");

// The GFW screening for this plot. Reuses a check already run on /sell, or runs one on open.
function ForestStatus({ plot }: { plot: LocalPlot }) {
  const { sales } = useSaleBook();
  const [check, setCheck] = useState<ForestCheck | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tried = useRef(false);

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    const result = await requestCheck(plot.ring);
    if ("error" in result) setError(result.error);
    else {
      saveCheck(plot.id, result);
      setCheck(result);
    }
    setBusy(false);
  }, [plot.id, plot.ring]);

  useEffect(() => {
    const found = latestCheck(plot.id, sales);
    if (found) setCheck((c) => (c && c.at >= found.at ? c : found));
    else if (!tried.current) {
      tried.current = true;
      void run();
    }
  }, [plot.id, sales, run]);

  const verdict = check ? screenPlot(check.stats) : null;
  const s = check?.stats;
  const errorText = error
    ? t("en", `eudr_err_${error}`) === `eudr_err_${error}` ? t("en", "eudr_err_upstream_failed") : t("en", `eudr_err_${error}`)
    : null;

  return (
    <div>
      {verdict && s ? (
        <>
          <p className="text-[1.1rem] font-semibold leading-snug" style={{ color: LEVEL_INK[verdict.level] }}>
            {t("en", `eudr_level_${verdict.level}`)}
          </p>
          <ul className="mt-2 flex flex-col gap-1.5 text-[0.87rem] leading-relaxed" style={{ maxWidth: "68ch" }}>
            {verdict.reasons.map((r) => (
              <Bullet key={r.key}>{t("en", r.key, r.slots)}</Bullet>
            ))}
          </ul>
          <div className="mt-4">
          <Grid>
            <Field k="Plot area (GFW)" v={ha2(s.plotHa)} mono />
            <Field k="Forest on 31 Dec 2020" v={ha2(s.forest2020Ha)} mono />
            <Field k="Loss on that forest since 2021" v={ha2(s.lossOnForestAfterCutoffHa)} mono />
            <Field k="Loss anywhere since 2021" v={ha2(s.lossAnyAfterCutoffHa)} mono />
            <Field k="Screening threshold" v={ha2(lossThresholdHa(s.plotHa))} mono />
            {byArea(s.lossOnForestByYear) && <Field k="Loss by year" v={byArea(s.lossOnForestByYear)} />}
            {byArea(s.lossOnForestByDriver) && <Field k="Recorded cause" v={byArea(s.lossOnForestByDriver)} />}
            {byArea(s.forestPlantationByType) && <Field k="Mapped as plantation" v={byArea(s.forestPlantationByType)} />}
          </Grid>
          </div>
          {verdict.evidence.length > 0 && (
            <>
              <p className="mt-5 text-[0.8rem] font-semibold">What to keep with this pack</p>
              <ul className="mt-1.5 flex flex-col gap-1.5 text-[0.85rem] leading-relaxed" style={{ maxWidth: "68ch" }}>
                {verdict.evidence.map((e) => (
                  <Bullet key={e}>{t("en", e)}</Bullet>
                ))}
              </ul>
            </>
          )}
          <p className="doc-faint mt-4 text-[0.75rem] leading-relaxed">
            Checked {new Date(check.at).toISOString().slice(0, 16).replace("T", " ")} UTC via the Global Forest
            Watch Data API · {s.versions.jrc} · {s.versions.hansen}
          </p>
        </>
      ) : (
        <p className="text-[1.05rem] font-semibold leading-snug">
          {busy ? "Checking the boundary against Global Forest Watch…" : "Not yet checked."}
        </p>
      )}

      {errorText && (
        <p role="alert" className="mt-3 text-[0.85rem]" style={{ color: INK_BAD }}>
          {errorText}
        </p>
      )}

      <div className="mt-4 print:hidden">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void run()} disabled={busy} aria-busy={busy}>
          {busy ? "Checking…" : check ? "Re-run the check" : "Run the check"}
        </button>
      </div>
    </div>
  );
}

/** A quiet tertiary action that leaves the app. */
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

// The attestation's tamper-evidence seal. Shows the content hash and chain position, and
// re-verifies every hash from the stored bytes on demand.
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
        {check.detail && <span className="doc-faint">, {check.detail}</span>}
      </span>
    </span>
  );
  return bare ? body : <li>{body}</li>;
}

/** Paper-safe skeleton (see PAPER_SKELETON). */
function PaperSkeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <Skeleton className={className} style={{ ...PAPER_SKELETON, ...style }} />;
}

// Placeholder for the whole pack while the plot is read off the device. Same sheet, same
// margin-label grid, so nothing moves when the record arrives.
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


/** TRACES-ready geolocation file. */
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

