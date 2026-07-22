/**
 * Privacy notice. Written to be true of what the code actually does today, not
 * of what it is meant to do eventually. If the sync path or the analysis path
 * changes, this page changes in the same commit.
 */
import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumb from "@/components/shell/Breadcrumb";

export const metadata: Metadata = {
  title: "Privacy and your data",
  description:
    "What PlotProof records, where it is kept, how long it is held, and how to delete it.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-5 px-5 py-6 sm:px-8">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Privacy" }]} />

      <header>
        <h1 className="text-xl font-semibold tracking-tight">Privacy and your data</h1>
        <p className="text-sm muted">
          Plain language, no legal padding. This describes what the app does now.
        </p>
      </header>

      <Section title="What gets recorded">
        <p>When a plot is attested, the app records:</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>The farmer&apos;s name, and an ID number if one is entered</li>
          <li>The plot boundary as coordinates, and its computed area</li>
          <li>A photo taken at the plot</li>
          <li>The farmer&apos;s signature or thumbprint as an image</li>
          <li>The field officer&apos;s name and the time of capture</li>
          <li>Where the officer was standing, if location was allowed</li>
        </ul>
        <p>
          A thumbprint is biometric data, so the app will not save an attestation
          unless the farmer has been read the consent statement and has agreed.
          The moment of that agreement is stored with the record.
        </p>
      </Section>

      <Section title="Where it is kept">
        <p>
          Field data stays in the browser on the device that captured it, in the
          browser&apos;s own storage. It is not currently uploaded anywhere: the
          server sync is not finished, so nothing you capture leaves the device.
        </p>
        <p>
          This has a consequence worth knowing. If you clear your browser data or
          lose the device, the plots are gone and cannot be recovered. Treat the
          device as the only copy until server sync ships.
        </p>
        <p>
          If you create an account, your email address is held by Supabase, our
          authentication provider, so you can sign in. Your product and market
          selections sync to your account. Plot and farmer data does not.
        </p>
      </Section>

      <Section title="What is published">
        <p>
          Nothing about a farmer or a plot is published. The public map shows no
          landholder identity, and it currently shows no detections at all.
        </p>
        <p>
          If you submit a report through the public map, it is stored as an
          unverified community label. Reports may be published as open data with
          free text and photographs removed. Do not put personal details in the
          comment box.
        </p>
      </Section>

      <Section title="How long it is kept">
        <p>
          Field data is kept until you delete it. There is no automatic expiry,
          because the whole point of the record is to prove a plot&apos;s status
          against a cut-off date that does not move.
        </p>
      </Section>

      <Section title="How to delete it">
        <p>
          Open <Link href="/intake" className="underline underline-offset-2" style={{ color: "var(--accent)" }}>Plot intake</Link>{" "}
          and use <strong>Delete field data on this device</strong>. That erases
          every farmer, plot, attestation, photo and signature held here, at once
          and without recovery.
        </p>
        <p>
          A farmer may ask for their record to be deleted at any time and does not
          have to give a reason. If you hold their data, you have to act on that.
        </p>
      </Section>

      <Section title="What this app does not do">
        <ul className="ml-4 list-disc space-y-1">
          <li>It does not sell or share data with advertisers</li>
          <li>It does not run third-party analytics or tracking</li>
          <li>It does not issue any official or legal determination</li>
        </ul>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass-card flex flex-col gap-2.5 p-4 text-sm">
      <h2 className="font-semibold">{title}</h2>
      <div className="flex flex-col gap-2 muted">{children}</div>
    </section>
  );
}
