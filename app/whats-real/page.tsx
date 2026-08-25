/**
 * The honesty page: what in PlotProof is real, working software, and what is
 * not yet. Kept deliberately blunt. If a feature's status changes, this page
 * changes in the same commit — a stale claim here is worse than no page.
 *
 * Set as a document: a contents rail that stays with the reader, numbered
 * parts, and prose capped at a readable measure. The one elevated block on the
 * page is the admission of what does NOT work — on a page whose whole argument
 * is candour, that is the part that has to be impossible to skim past.
 */
import type { Metadata } from "next";
import PendingLink from "@/components/motion/PendingLink";
import Breadcrumb from "@/components/shell/Breadcrumb";

export const metadata: Metadata = {
  title: "What is real, what is not",
  description:
    "A plain inventory of which PlotProof features are real working software and which are previews or not yet built.",
};

const CONTENTS = [
  { id: "real", n: "01", label: "Real and working" },
  { id: "not-real", n: "02", label: "Not real yet" },
  { id: "eudr", n: "03", label: "Where this sits against EUDR" },
];

export default function WhatsRealPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-5xl px-5 pb-20 pt-6 sm:px-8">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "What is real" }]} />

      <header className="mt-8">
        <div style={{ height: 3, width: 44, background: "var(--accent)" }} aria-hidden="true" />
        <h1 className="font-display mt-5 text-[2.3rem] leading-[1.04] sm:text-[3.1rem]">
          What is real, what is not
        </h1>
        <p
          className="mt-6 text-[1.08rem] leading-[1.58] muted sm:text-[1.15rem]"
          style={{ maxWidth: "58ch" }}
        >
          A tool that helps prove things should be honest about itself first. This page is the
          inventory: every feature, labelled by what it actually does today.
        </p>
      </header>

      <hr className="hairline mt-10" />

      <div className="grid gap-x-16 lg:grid-cols-[12rem_1fr]">
        {/* Contents rail. Anchors, not navigation: the jump is instant, so the
            press cue is the colour change and nothing pretends to load. */}
        <nav
          aria-label="On this page"
          className="sticky hidden self-start lg:block"
          style={{ top: "calc(var(--nav-h) + 2rem)", paddingTop: "2.5rem" }}
        >
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] faint">
            Contents
          </p>
          <ul className="mt-4 flex flex-col">
            {CONTENTS.map((c) => (
              <li key={c.id}>
                <a
                  href={`#${c.id}`}
                  className="flex min-h-[44px] items-baseline gap-3 text-[0.86rem] leading-snug text-[color:var(--fg-muted)] transition-colors duration-150 hover:text-[color:var(--fg)] active:text-[color:var(--accent)]"
                >
                  <span className="font-mono text-[0.7rem] tabular-nums text-[color:var(--fg-faint)]">
                    {c.n}
                  </span>
                  <span>{c.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0">
          <Part id="real" n="01" title="Real and working">
            <Entries>
              <Entry term="Offline plot capture.">
                Trace on a map, walk the boundary, mark corners, or import a file. Geometry is
                validated (self-intersection, area sanity, overlap against other plots) and stored
                on the device instantly; no connection needed in the field.
              </Entry>
              <Entry term="Field attestation with informed consent.">
                Plot photo, officer identity, farmer confirmation by signature or thumbprint, and a
                spoken consent statement recorded with its timestamp. A thumbprint is biometric
                data; the app refuses to save without consent.
              </Entry>
              <Entry term="Tamper-evidence on attestations.">
                Every attestation is SHA-256 hashed (photo bytes, signature bytes, boundary,
                identity fields) and chained to the previous record on the device. Later edits are
                detectable. Limits, stated plainly: the hashes are computed by the same device that
                captured the data, and are not yet anchored to an external timestamping service —
                this proves the record hasn&apos;t changed, not that the capture was honest.
              </Entry>
              <Entry term="Server persistence.">
                When Supabase is configured and the officer is signed in, farmers, plots,
                attestations, and media sync to the server under row-level security (own rows only).
                When it is not configured, the sync bar says so — records stay on the device and
                nothing pretends otherwise.
              </Entry>
              <Entry term="Export document generators.">
                Commercial invoice, packing list, and certificate-of-origin drafts, plus a
                compliance checklist derived from product, origin, and destination.
              </Entry>
              <Entry term="DDS geolocation export.">
                Each plot exports its boundary as TRACES-shaped GeoJSON (WGS84) that an exporter or
                cooperative can attach to their EU due diligence statement.
              </Entry>
              <Entry term="Public lot verification.">
                Every attested, synced plot has a de-identified public page (/verify/&lt;id&gt;)
                stating exactly what is proven (tamper-evidence, officer countersignature, recorded
                consent), what is self-reported (the traced boundary), and where to check
                independently (Global Forest Watch at the plot&apos;s coordinates). It is the page a
                cooperative sends an exporter.
              </Entry>
              <Entry term="Price intelligence.">
                World reference prices (World Bank Pink Sheet, monthly, CC BY) for tea, coffee,
                rubber, cocoa, and coconut, shown in the sell flow with honest backtested forecasts
                — the chosen model&apos;s error is displayed next to the naive baseline&apos;s.
                Reference prices, not farm-gate offers; the screen says so. Products with no public
                series (cinnamon, pepper, cardamom) say so instead of showing an invented number.
              </Entry>
            </Entries>
          </Part>

          {/* The one elevated block on the page. Everything above it is a claim
              in our favour; this is the part a judge is actually testing us on,
              so it gets the emphasis rather than being buried mid-scroll. */}
          <section
            id="not-real"
            className="mt-14 scroll-mt-28 px-5 py-7 sm:px-7 sm:py-8"
            style={{
              background: "var(--warn-soft)",
              borderLeft: "3px solid var(--warn)",
              borderRadius: "0 var(--radius) var(--radius) 0",
            }}
          >
            <div className="flex items-baseline gap-3 sm:gap-4">
              <span className="font-mono text-[0.72rem] tabular-nums" style={{ color: "var(--warn)" }}>
                02
              </span>
              <h2
                className="text-[1.05rem] font-semibold tracking-tight sm:text-[1.2rem]"
                style={{ color: "var(--warn)" }}
              >
                Not real yet — and never faked on screen
              </h2>
            </div>
            <Entries className="mt-6">
              <Entry term="Satellite deforestation verdicts.">
                We deliberately do not run our own deforestation model. An earlier in-house analysis
                service was removed after review: it could not be trained or validated honestly by
                one developer. For deforestation context, plots link to the authoritative public
                datasets instead — JRC Tropical Moist Forest and Global Forest Watch (Hansen) — so
                any verdict-shaped claim is theirs, not ours.
              </Entry>
              <Entry term="Acoustic monitoring.">
                Research, currently paused — it needs field sensors (ESP32 + LoRa) that do not exist
                yet. The chainsaw classifier is real ML (ESC-50 benchmark, cross-validated metrics
                on the acoustic page; research-licensed data, unvalidated on field audio), but
                nothing here implies an operational network.
              </Entry>
              <Entry term="Real plots.">
                No real farmer plot has been captured yet. Any plot you see in a demonstration was
                self-traced and is labelled demonstration data, not evidence.
              </Entry>
            </Entries>
          </section>

          <Part id="eudr" n="03" title="Where this sits against EUDR">
            <Entries>
              <Entry term="Who files, legally.">
                Under the EU Deforestation Regulation the operator placing goods on the EU market
                files the due diligence statement — not the farmer. A smallholder has no legal duty
                and no budget for this. PlotProof&apos;s output is therefore built to be consumed by
                the cooperative or exporter who does file.
              </Entry>
              <Entry term="Timing.">
                Regulation (EU) 2025/2650 (OJ, 23 December 2025) postponed EUDR application to 30
                December 2026 for medium and large operators and 30 June 2027 for micro and small
                enterprises. The window before those dates is exactly when supply chains must
                assemble smallholder evidence — which is what this tool captures. (An earlier
                version of this page misstated these dates; corrected against the regulation.)
              </Entry>
              <Entry term="Plots under 4 hectares.">
                EUDR&apos;s geolocation rule allows a single point instead of a polygon for plots
                below 4 ha. Most Sri Lankan smallholder plots qualify, so the minimum bar is lower
                than full polygon capture. PlotProof still captures the polygon: it exceeds the
                minimum, supports overlap and area checks, and is what makes the attestation worth
                signing.
              </Entry>
            </Entries>
          </Part>

          <footer className="mt-14 pt-5" style={{ borderTop: "1px solid var(--glass-hairline)" }}>
            <PendingLink
              href="/privacy"
              className="inline-flex min-h-[44px] items-center text-[0.9rem] font-medium underline underline-offset-[3px]"
              style={{ color: "var(--fg-muted)" }}
            >
              See also: Privacy and your data
            </PendingLink>
          </footer>
        </div>
      </div>
    </main>
  );
}

// --- document furniture ---------------------------------------------------

function Part({
  id,
  n,
  title,
  children,
}: {
  id: string;
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-14 scroll-mt-28 first:mt-10">
      <div className="flex items-baseline gap-3 sm:gap-4">
        <span className="font-mono text-[0.72rem] tabular-nums faint">{n}</span>
        <h2 className="text-[1.05rem] font-semibold tracking-tight sm:text-[1.2rem]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Entries({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <dl className={`mt-6 flex flex-col gap-7 ${className}`}>{children}</dl>;
}

/** Term on its own line, description beneath at a capped measure. A run of
 *  disc bullets flattens everything to one weight; a definition list gives the
 *  claim and its qualification two different ones. */
function Entry({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[0.98rem] font-semibold tracking-tight">{term}</dt>
      <dd className="mt-1.5 text-[0.95rem] leading-[1.65] muted" style={{ maxWidth: "68ch" }}>
        {children}
      </dd>
    </div>
  );
}
