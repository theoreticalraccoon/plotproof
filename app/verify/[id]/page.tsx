/** Public per-lot verification, the page a farmer or cooperative WhatsApps to an exporter. */
import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import PendingLink from "@/components/motion/PendingLink";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Lot verification",
  description: "Independent verification record for an attested farm plot.",
};

interface LotRow {
  id: string;
  country_code: string;
  commodity: string | null;
  ring: [number, number][];
  computed_area_ha: number;
  capture_method: string;
  captured_at: string;
  attested_at: string;
  officer_name: string;
  confirmation_method: string;
  consent_recorded: boolean;
  integrity_hash: string | null;
  integrity_algo: string | null;
  integrity_chain_seq: number | null;
}

function centroid(ring: [number, number][]): { lat: number; lng: number } {
  const pts = ring.slice(0, -1);
  const lng = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const lat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return { lat, lng };
}

export default async function VerifyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <Shell>
        <Masthead />
        <h1 className="font-display mt-6 text-[2rem] leading-[1.08] sm:text-[2.4rem]">
          Verification unavailable
        </h1>
        <p className="mt-4 text-[1.02rem] leading-[1.6] muted" style={{ maxWidth: "62ch" }}>
          This deployment has no verification database connected, so no lot can be looked up.
          Nothing is shown rather than something invented.
        </p>
        <Colophon />
      </Shell>
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lot_verification")
    .select("*")
    .eq("id", id)
    .maybeSingle<LotRow>();

  if (error) {
    // The public message is identical for "no such lot" and "query failed" so the page never
    // leaks schema details.
    console.error("[verify] lot_verification query failed:", error.message);
  }

  if (error || !data) {
    return (
      <Shell>
        <Masthead />
        <h1 className="font-display mt-6 text-[2rem] leading-[1.08] sm:text-[2.4rem]">
          No verified lot with this ID
        </h1>
        <p className="mt-4 text-[1.02rem] leading-[1.6] muted" style={{ maxWidth: "62ch" }}>
          Either the link is wrong, the lot was never attested, or it has not synced from the
          capture device. An unverifiable lot is shown as exactly that, unverifiable.
        </p>
        <p className="mt-7 text-[0.7rem] font-semibold uppercase tracking-[0.16em] faint">
          Requested ID
        </p>
        <p className="mt-1 break-all font-mono text-[0.8rem] leading-[1.5] muted">{id}</p>
        <Colophon />
      </Shell>
    );
  }

  const c = centroid(data.ring);
  const gfwUrl = `https://www.globalforestwatch.org/map/?map=${encodeURIComponent(
    JSON.stringify({ center: { lat: c.lat, lng: c.lng }, zoom: 14 }),
  )}`;

  return (
    <Shell>
      <Masthead />

      {/* The one dominant element on the page: what this lot is. Everything
          below it qualifies this line. */}
      <header className="mt-7">
        <h1 className="font-display text-[2.15rem] leading-[1.05] sm:text-[2.7rem]">
          {data.commodity ?? "Crop"} plot
        </h1>
        <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-[1.5rem] font-semibold tabular-nums tracking-tight sm:text-[1.7rem]">
            {data.computed_area_ha.toFixed(2)}
            <span className="ml-1 text-[0.95rem] font-medium muted">ha</span>
          </span>
          <span aria-hidden="true" className="faint">
            /
          </span>
          <span className="text-[0.95rem] font-medium tracking-[0.06em] muted">
            {data.country_code}
          </span>
        </p>
        <p className="mt-6 text-[0.7rem] font-semibold uppercase tracking-[0.16em] faint">
          Record ID
        </p>
        <p className="mt-1 break-all font-mono text-[0.8rem] leading-[1.5] muted">{data.id}</p>
      </header>

      <Rule />

      <Part n="01" title="What is verified" />
      <dl className="mt-2">
        <Row k="Boundary captured" v={`${data.captured_at.slice(0, 10)} (${data.capture_method})`} />
        <Row k="Area (geodesic, WGS84)" v={`${data.computed_area_ha.toFixed(4)} ha`} mono />
        <Row k="Attested in the field" v={data.attested_at.slice(0, 10)} />
        <Row k="Officer countersignature" v={data.officer_name} />
        <Row
          k="Farmer confirmation"
          v={`${data.confirmation_method} · consent ${data.consent_recorded ? "recorded" : "NOT recorded"}`}
        />
      </dl>

      <Rule />

      <Part n="02" title="Tamper-evidence seal" />
      {data.integrity_hash ? (
        <figure
          className="mt-4 px-4 py-4 sm:px-5"
          style={{
            background: "var(--bg-1)",
            border: "1px solid var(--glass-hairline)",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] faint">
              {data.integrity_algo} content hash
            </span>
            <span className="font-mono text-[0.74rem] tabular-nums faint">
              chain #{data.integrity_chain_seq}
            </span>
          </figcaption>
          {/* The full digest, not a truncation: an exporter who wants to compare
              it against the record they were sent needs every character. */}
          <p className="mt-3 break-all font-mono text-[0.8rem] leading-[1.75] sm:text-[0.86rem]">
            {data.integrity_hash}
          </p>
        </figure>
      ) : (
        <p className="mt-4 text-[0.98rem] muted">none (pre-integrity record)</p>
      )}

      <Rule />

      {/* The trust ladder. Three rungs, three treatments: a filled rung for what
          is proven, a ruled rung for what is only claimed, a dashed rung for
          what has to be checked somewhere else. */}
      <Part n="03" title="What this does and does not prove" />
      <div className="mt-5 flex flex-col gap-3">
        <Rung tier="proven" label="Proven">
          this exact boundary, area, and attestation record have not been altered since capture
          (hash-chained on the capture device), and a named field officer countersigned the capture
          with the farmer&apos;s recorded consent.
        </Rung>

        <Rung tier="claimed" label="Self-reported">
          the boundary itself was traced in the field by the officer and farmer. It is not
          government-survey data and is not land-title verification.
        </Rung>

        <Rung tier="external" label="Independently checkable">
          deforestation status is not our claim to make, {" "}
          <a
            className="font-medium underline underline-offset-[3px]"
            style={{ color: "var(--accent)", textDecorationThickness: "1px" }}
            href={gfwUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            view this exact location on Global Forest Watch
          </a>{" "}
          (Hansen/UMD data) and judge the authoritative record yourself.
        </Rung>
      </div>

      {/* Same destination as the sentence above, given a thumb-sized target:
          this page is opened from WhatsApp, and the cross-check is the whole
          point of the third rung. */}
      <a
        href={gfwUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 flex min-h-[60px] items-center justify-between gap-4 px-4 py-3 sm:px-5"
        style={{
          border: "1px solid var(--glass-hairline)",
          borderRadius: "var(--radius-sm)",
          background: "var(--glass)",
        }}
      >
        <span className="min-w-0">
          <span className="block text-[0.7rem] font-semibold uppercase tracking-[0.16em] faint">
            Independent cross-check
          </span>
          <span className="mt-0.5 block text-[0.98rem] font-semibold leading-snug">
            Open Global Forest Watch at these coordinates
          </span>
        </span>
        <ArrowUpRight
          size={20}
          strokeWidth={1.75}
          aria-hidden="true"
          className="shrink-0"
          style={{ color: "var(--accent)" }}
        />
      </a>

      <Rule />

      <Part n="04" title="For due diligence" />
      <p className="mt-4 text-[1rem] leading-[1.65] muted" style={{ maxWidth: "66ch" }}>
        The plot geometry is available as TRACES-shaped GeoJSON (WGS84) from the lot holder,
        the geolocation format an EU due-diligence statement expects. Under Regulation (EU)
        2023/1115 as amended by 2025/2650, the importing operator files the statement; this
        record is the smallholder-side evidence for it.
      </p>

      <Colophon />
    </Shell>
  );
}

// --- document furniture ---------------------------------------------------

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[46rem] px-5 pb-16 pt-8 sm:px-8 sm:pt-12">
      {children}
    </main>
  );
}

// Letterhead: one accent stroke and the smallest type on the page. The name of the issuer
// belongs at the top of a document, but it is not the headline.
function Masthead() {
  return (
    <div>
      <div style={{ height: 3, width: 44, background: "var(--accent)" }} aria-hidden="true" />
      <p className="mt-3 text-[0.7rem] font-semibold uppercase tracking-[0.18em] muted">
        PlotProof lot verification
      </p>
    </div>
  );
}

function Rule() {
  return <hr className="hairline mt-9" />;
}

/** A numbered part heading, the way a clause number sits in a legal document. */
function Part({ n, title }: { n: string; title: string }) {
  return (
    <div className="mt-7 flex items-baseline gap-3 sm:gap-4">
      <span className="font-mono text-[0.72rem] tabular-nums faint">{n}</span>
      <h2 className="text-[0.78rem] font-semibold uppercase tracking-[0.14em] muted">{title}</h2>
    </div>
  );
}

// One record line: hairline-separated label/value rows read as a certificate, where a grid of
// equal cards reads as a dashboard.
function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div
      className="grid grid-cols-1 gap-x-6 gap-y-0.5 py-3 sm:grid-cols-[14rem_1fr]"
      style={{ borderBottom: "1px solid var(--glass-hairline)" }}
    >
      <dt className="text-[0.85rem] muted">{k}</dt>
      <dd className={`text-[0.98rem] font-medium ${mono ? "font-mono tabular-nums" : ""}`}>{v}</dd>
    </div>
  );
}

/** A rung of the trust ladder. */
function Rung({
  tier,
  label,
  children,
}: {
  tier: "proven" | "claimed" | "external";
  label: string;
  children: React.ReactNode;
}) {
  const surface: React.CSSProperties =
    tier === "proven"
      ? {
          borderLeft: "3px solid var(--accent)",
          background: "var(--accent-soft)",
          borderRadius: "0 var(--radius-sm) var(--radius-sm) 0",
        }
      : tier === "claimed"
        ? { borderLeft: "3px solid var(--glass-hairline)" }
        : { borderLeft: "3px dashed var(--fg-faint)" };

  return (
    <div className="py-2 pl-4 sm:pl-5" style={surface}>
      <p
        className="text-[0.68rem] font-semibold uppercase tracking-[0.16em]"
        style={{ color: tier === "proven" ? "var(--accent)" : "var(--fg-faint)" }}
      >
        {label}
      </p>
      <p
        className={`mt-1.5 leading-[1.6] ${
          tier === "proven" ? "text-[1.02rem]" : "text-[0.96rem] muted"
        }`}
        style={{ maxWidth: "64ch" }}
      >
        {children}
      </p>
    </div>
  );
}

/** Fine print, deliberately the quietest thing on the page. */
function Colophon() {
  return (
    <footer className="mt-12 pt-5" style={{ borderTop: "1px solid var(--glass-hairline)" }}>
      <p className="text-[0.8rem] leading-[1.6] faint" style={{ maxWidth: "62ch" }}>
        De-identified by design: no farmer name, ID, or contact details appear on this page.
      </p>
      <PendingLink
        href="/whats-real"
        className="mt-2 inline-flex min-h-[44px] items-center text-[0.8rem] font-medium underline underline-offset-[3px]"
        style={{ color: "var(--fg-muted)" }}
      >
        What is real in PlotProof, and what is not
      </PendingLink>
    </footer>
  );
}
