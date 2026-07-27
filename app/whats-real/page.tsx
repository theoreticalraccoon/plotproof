/**
 * The honesty page: what in PlotProof is real, working software, and what is
 * not yet. Kept deliberately blunt. If a feature's status changes, this page
 * changes in the same commit — a stale claim here is worse than no page.
 */
import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumb from "@/components/shell/Breadcrumb";

export const metadata: Metadata = {
  title: "What is real, what is not",
  description:
    "A plain inventory of which PlotProof features are real working software and which are previews or not yet built.",
};

export default function WhatsRealPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-5 px-5 py-6 sm:px-8">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "What is real" }]} />

      <header>
        <h1 className="text-xl font-semibold tracking-tight">What is real, what is not</h1>
        <p className="text-sm muted">
          A tool that helps prove things should be honest about itself first. This page is the
          inventory: every feature, labelled by what it actually does today.
        </p>
      </header>

      <Section title="Real and working">
        <ul className="ml-4 list-disc space-y-1.5">
          <li>
            <strong>Offline plot capture.</strong> Trace on a map, walk the boundary, mark corners,
            or import a file. Geometry is validated (self-intersection, area sanity, overlap against
            other plots) and stored on the device instantly; no connection needed in the field.
          </li>
          <li>
            <strong>Field attestation with informed consent.</strong> Plot photo, officer identity,
            farmer confirmation by signature or thumbprint, and a spoken consent statement recorded
            with its timestamp. A thumbprint is biometric data; the app refuses to save without
            consent.
          </li>
          <li>
            <strong>Tamper-evidence on attestations.</strong> Every attestation is SHA-256 hashed
            (photo bytes, signature bytes, boundary, identity fields) and chained to the previous
            record on the device. Later edits are detectable. Limits, stated plainly: the hashes are
            computed by the same device that captured the data, and are not yet anchored to an
            external timestamping service — this proves the record hasn&apos;t changed, not that the
            capture was honest.
          </li>
          <li>
            <strong>Server persistence.</strong> When Supabase is configured and the officer is
            signed in, farmers, plots, attestations, and media sync to the server under row-level
            security (own rows only). When it is not configured, the sync bar says so — records stay
            on the device and nothing pretends otherwise.
          </li>
          <li>
            <strong>Export document generators.</strong> Commercial invoice, packing list, and
            certificate-of-origin drafts, plus a compliance checklist derived from product, origin,
            and destination.
          </li>
          <li>
            <strong>DDS geolocation export.</strong> Each plot exports its boundary as
            TRACES-shaped GeoJSON (WGS84) that an exporter or cooperative can attach to their EU due
            diligence statement.
          </li>
          <li>
            <strong>Public lot verification.</strong> Every attested, synced plot has a
            de-identified public page (/verify/&lt;id&gt;) stating exactly what is proven
            (tamper-evidence, officer countersignature, recorded consent), what is self-reported
            (the traced boundary), and where to check independently (Global Forest Watch at the
            plot&apos;s coordinates). It is the page a cooperative sends an exporter.
          </li>
          <li>
            <strong>Price intelligence.</strong> World reference prices (World Bank Pink Sheet,
            monthly, CC BY) for tea, coffee, rubber, cocoa, and coconut, shown in the sell flow with
            honest backtested forecasts — the chosen model&apos;s error is displayed next to the
            naive baseline&apos;s. Reference prices, not farm-gate offers; the screen says so.
            Products with no public series (cinnamon, pepper, cardamom) say so instead of showing an
            invented number.
          </li>
        </ul>
      </Section>

      <Section title="Not real yet — and never faked on screen">
        <ul className="ml-4 list-disc space-y-1.5">
          <li>
            <strong>Satellite deforestation verdicts.</strong> We deliberately do not run our own
            deforestation model. An earlier in-house analysis service was removed after review: it
            could not be trained or validated honestly by one developer. For deforestation context,
            plots link to the authoritative public datasets instead — JRC Tropical Moist Forest and
            Global Forest Watch (Hansen) — so any verdict-shaped claim is theirs, not ours.
          </li>
          <li>
            <strong>Acoustic monitoring.</strong> Research, currently paused — it needs field
            sensors (ESP32 + LoRa) that do not exist yet. The chainsaw classifier is real ML
            (ESC-50 benchmark, cross-validated metrics on the acoustic page; research-licensed
            data, unvalidated on field audio), but nothing here implies an operational network.
          </li>
          <li>
            <strong>Real plots.</strong> No real farmer plot has been captured yet. Any plot you see
            in a demonstration was self-traced and is labelled demonstration data, not evidence.
          </li>
        </ul>
      </Section>

      <Section title="Where this sits against EUDR">
        <ul className="ml-4 list-disc space-y-1.5">
          <li>
            <strong>Who files, legally.</strong> Under the EU Deforestation Regulation the operator
            placing goods on the EU market files the due diligence statement — not the farmer. A
            smallholder has no legal duty and no budget for this. PlotProof&apos;s output is
            therefore built to be consumed by the cooperative or exporter who does file.
          </li>
          <li>
            <strong>Timing.</strong> Regulation (EU) 2025/2650 (OJ, 23 December 2025) postponed
            EUDR application to 30 December 2026 for medium and large operators and 30 June 2027
            for micro and small enterprises. The window before those dates is exactly when supply
            chains must assemble smallholder evidence — which is what this tool captures. (An
            earlier version of this page misstated these dates; corrected against the regulation.)
          </li>
          <li>
            <strong>Plots under 4 hectares.</strong> EUDR&apos;s geolocation rule allows a single
            point instead of a polygon for plots below 4 ha. Most Sri Lankan smallholder plots
            qualify, so the minimum bar is lower than full polygon capture. PlotProof still captures
            the polygon: it exceeds the minimum, supports overlap and area checks, and is what makes
            the attestation worth signing.
          </li>
        </ul>
      </Section>

      <p className="text-sm muted">
        See also <Link href="/privacy" className="underline underline-offset-2">Privacy and your data</Link>.
      </p>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass flex flex-col gap-2 p-4 text-sm">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}
