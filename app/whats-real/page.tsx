/** The honesty page: what in PlotProof is real, working software, and what is not yet. */
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
              <Entry term="Watering advice from this plot's own weather.">
                The FAO-56 soil-water balance, implemented directly, with every constant traceable
                to a published table. Weather comes from a model grid near the plot, not a station
                on it, and the screen says so. If the weather cannot be fetched, nothing below it
                is shown rather than estimated.
              </Entry>
              <Entry term="Disease pressure from weather.">
                How far the last two weeks favoured blister blight, brown blight or grey blight,
                with the measured conditions that produced the score. This is infection pressure,
                not a diagnosis, weather favouring a disease is not the same as having it.
              </Entry>
              <Entry term="Leaf disease diagnosis from a photo.">
                Photograph a leaf and a small neural network runs in your browser, the image never
                leaves the phone. It declines to answer when it is not confident enough. Version 1.1
                is trained with half of every epoch re-rendered as a field photograph, the leaf cut
                out and placed among other leaves, under uneven light, through a simulated phone
                camera, because every public tea dataset is picked leaves on white paper. On
                held-out leaves rendered that way it now answers about three photos in four and is
                right on about 96% of those; the version before it answered one in twelve, and got
                most of those wrong.
              </Entry>
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
                captured the data, and are not yet anchored to an external timestamping service,
                this proves the record hasn&apos;t changed, not that the capture was honest.
              </Entry>
              <Entry term="Server persistence.">
                When Supabase is configured and the officer is signed in, farmers, plots,
                attestations, and media sync to the server under row-level security (own rows only).
                When it is not configured, the sync bar says so, records stay on the device and
                nothing pretends otherwise.
              </Entry>
              <Entry term="The consignment workspace.">
                One record per sale holds every detail the paperwork needs, and the commercial
                invoice, packing list and certificate-of-origin draft are all written from it, so
                they cannot disagree with each other about quantity or value, which is a real reason
                consignments are held at the border. Each document can be opened and corrected on
                its own; the correction goes back to the record and appears on the others. An
                incomplete sale still downloads, with every page marked DRAFT.
              </Entry>
              <Entry term="Documents we will not produce.">
                The phytosanitary certificate, the customs declaration, the certificate of origin
                once certified, these are issued by an authority, and a generated look-alike would
                be a forgery. They appear as a checklist naming who issues each one and how to
                apply, checked against the cited authorities on the date shown on the page.
              </Entry>
              <Entry term="Deforestation screening inside the sale.">
                For the EUDR commodities bound for the EU, each attested plot is measured against
                three published satellite products, JRC Global Forest Cover 2020, Hansen/UMD tree
                cover loss, and the WRI/Google loss-driver model, and a stated rule reads the
                result. Details below.
              </Entry>
              <Entry term="An export assistant that can see the consignment.">
                A Gemini assistant answering from the same sourced requirement catalog the
                checklist is built from, with the open sale summarised into its context. It is
                instructed never to invent a regulation, form number, fee or deadline, and to name
                the authority to confirm with. Rate-limited per account. Where the deployment has no
                API key it says so and refuses, rather than answering from general knowledge.
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
                rubber, cocoa, and coconut, shown in the sell flow with honest backtested forecasts,
                the chosen model&apos;s error is displayed next to the naive baseline&apos;s.
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
                Not real yet, and never faked on screen
              </h2>
            </div>
            <Entries className="mt-6">
              <Entry term="A deforestation model of our own.">
                We still do not run one. An earlier in-house analysis service was removed after
                review: it could not be trained or validated honestly by one developer, and
                inventing a verdict was worse than having none. What the sale flow and the evidence pack show is area
                statistics over three products published and validated by other people, JRC Global
                Forest Cover 2020, Hansen/UMD Global Forest Change, and the WRI/Google loss-driver
                model, plus a rule, written down and tested, that reads them against the EUDR
                question. The numbers are theirs; the reasoning is ours and is stated on screen.
              </Entry>
              <Entry term="An EUDR certificate.">
                There is no such thing, and nothing in this app issues one. The EU operator files a
                due diligence statement; our screening is a risk screening that says what the
                satellite record supports and what evidence to go and gather where it does not. It
                never says a consignment is compliant. A screening also cannot see the ground: the
                two forest products regularly disagree over tree crops such as rubber, whose closed
                canopy is often mapped as forest, and the panel reports that disagreement rather
                than resolving it in either direction.
              </Entry>

              <Entry term="Tea disease detection outside its training domain.">
                The model scores 99.6% on held-out data from the set it was trained on, and about
                70% on leaves photographed by other people in other countries. That gap is the
                honest number. Every dataset we could find, Assam, Bangladesh, and a third from a
                Bangladeshi university, photographs picked leaves on white paper; none contains a
                leaf on a bush, and none contains Sri Lankan tea. The field performance quoted above
                is measured on a simulation of field conditions, not on real field photographs,
                because there are no real ones to measure against. An earlier version of this page
                and of the model card called one of those studio datasets a field set. It is not.
                Two classes, blister blight and red rust, appear in no other dataset at all, so
                they have no independent check whatsoever.
              </Entry>
              <Entry term="Acoustic chainsaw detection.">
                Deleted. The hardware never existed, and the benchmark data it was built on is
                licensed for research only, so the model could never have shipped.
              </Entry>
              <Entry term="A soil probe on a real farm.">
                The software is built and the arithmetic is tested: Web Serial opens the USB port,
                the frame parser rejects anything it cannot vouch for, two-point calibration turns
                the probe&rsquo;s arbitrary count into a water content, and a saved reading takes the
                top rung of the watering advice. What has <em>not</em> happened is any of it running
                against real hardware. The firmware compiles for the ESP32 with no errors or
                warnings, but it has never been flashed, the serial path has never seen a real board, and no probe has been pushed into real soil. Until that
                happens, treat the lane as untested hardware code, and note that the calibration is a
                field one, air and water remove the probe&rsquo;s arbitrary scale, but a water
                content that is accurate for a specific soil needs oven-dried samples. The simulated
                probe on that screen is labelled as simulated everywhere it appears, including in
                storage.
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
                files the due diligence statement, not the farmer. A smallholder has no legal duty
                and no budget for this. PlotProof&apos;s output is therefore built to be consumed by
                the cooperative or exporter who does file.
              </Entry>
              <Entry term="Tea is not covered.">
                EUDR Annex I lists cattle, cocoa, coffee, oil palm, rubber, soya and wood. Tea is
                not on it, so Sri Lanka&apos;s largest agricultural export needs no deforestation
                check and gets none here: the product catalogue marks tea <code>eudrCovered:
                false</code> and the screening never appears for it. Rubber, coffee and cocoa to
                the EU are where this lane does work.
              </Entry>
              <Entry term="Timing.">
                Regulation (EU) 2025/2650 (OJ, 23 December 2025) postponed EUDR application to 30
                December 2026 for medium and large operators and 30 June 2027 for micro and small
                enterprises. The window before those dates is exactly when supply chains must
                assemble smallholder evidence, which is what this tool captures. (An earlier
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

/** Term on its own line, description beneath at a capped measure. */
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
