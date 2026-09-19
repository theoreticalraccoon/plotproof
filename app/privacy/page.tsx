// Privacy notice. Written to be true of what the code actually does today, not of what it is
// meant to do eventually.
import type { Metadata } from "next";
import PendingLink from "@/components/motion/PendingLink";
import Breadcrumb from "@/components/shell/Breadcrumb";

export const metadata: Metadata = {
  title: "Privacy and your data",
  description:
    "What PlotProof records, where it is kept, how long it is held, and how to delete it.",
};

const CONTENTS = [
  { id: "recorded", n: "01", label: "What gets recorded" },
  { id: "kept", n: "02", label: "Where it is kept" },
  { id: "published", n: "03", label: "What is published" },
  { id: "retention", n: "04", label: "How long it is kept" },
  { id: "delete", n: "05", label: "How to delete it" },
  { id: "never", n: "06", label: "What this app does not do" },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-5xl px-5 pb-20 pt-6 sm:px-8">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Privacy" }]} />

      <header className="mt-8">
        <div style={{ height: 3, width: 44, background: "var(--accent)" }} aria-hidden="true" />
        <h1 className="font-display mt-5 text-[2.3rem] leading-[1.04] sm:text-[3.1rem]">
          Privacy and your data
        </h1>
        <p
          className="mt-6 text-[1.08rem] leading-[1.58] muted sm:text-[1.15rem]"
          style={{ maxWidth: "58ch" }}
        >
          Plain language, no legal padding. This describes what the app does now.
        </p>
      </header>

      <hr className="hairline mt-10" />

      <div className="grid gap-x-16 lg:grid-cols-[12rem_1fr]">
        {/* In-page anchors: the jump is instant, so the colour change on press
            is the whole acknowledgement, a spinner here would be a lie. */}
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
                  className="flex min-h-[40px] items-baseline gap-3 text-[0.86rem] leading-snug text-[color:var(--fg-muted)] transition-colors duration-150 hover:text-[color:var(--fg)] active:text-[color:var(--accent)]"
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
          <Clause id="recorded" n="01" title="What gets recorded">
            <p>When a plot is attested, the app records:</p>
            <ul className="flex flex-col gap-1.5 pl-0">
              {[
                "The farmer's name, and an ID number if one is entered",
                "The plot boundary as coordinates, and its computed area",
                "A photo taken at the plot",
                "The farmer's signature or thumbprint as an image",
                "The field officer's name and the time of capture",
                "Where the officer was standing, if location was allowed",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-[0.62rem] h-px w-3 shrink-0"
                    style={{ background: "var(--fg-faint)" }}
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p>
              A thumbprint is biometric data, so the app will not save an attestation
              unless the farmer has been read the consent statement and has agreed.
              The moment of that agreement is stored with the record.
            </p>
          </Clause>

          <Clause id="kept" n="02" title="Where it is kept">
            <p>
              Field data stays in the browser on the device that captured it, in the
              browser&apos;s own storage. It is not currently uploaded anywhere: the
              server sync is not finished, so nothing you capture leaves the device.
            </p>
            {/* The one thing on this page that can cost someone their records,
                pulled out of the run of prose so it cannot be skimmed past. */}
            <p
              className="px-4 py-3.5 text-[0.98rem] sm:px-5"
              style={{
                background: "var(--warn-soft)",
                borderLeft: "3px solid var(--warn)",
                borderRadius: "0 var(--radius-sm) var(--radius-sm) 0",
                color: "var(--fg)",
              }}
            >
              This has a consequence worth knowing. If you clear your browser data or
              lose the device, the plots are gone and cannot be recovered. Treat the
              device as the only copy until server sync ships.
            </p>
            <p>
              If you create an account, your email address is held by Supabase, our
              authentication provider, so you can sign in. Your product and market
              selections sync to your account. Plot and farmer data does not.
            </p>
          </Clause>

          <Clause id="published" n="03" title="What is published">
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
          </Clause>

          <Clause id="retention" n="04" title="How long it is kept">
            <p>
              Field data is kept until you delete it. There is no automatic expiry,
              because the whole point of the record is to prove a plot&apos;s status
              against a cut-off date that does not move.
            </p>
          </Clause>

          <Clause id="delete" n="05" title="How to delete it">
            <p>
              Open{" "}
              <PendingLink
                href="/intake"
                className="font-medium underline underline-offset-[3px]"
                style={{ color: "var(--accent)" }}
              >
                Plot intake
              </PendingLink>{" "}
              and use <strong className="font-semibold" style={{ color: "var(--fg)" }}>Delete field data on this device</strong>. That erases
              every farmer, plot, attestation, photo and signature held here, at once
              and without recovery.
            </p>
            <p>
              A farmer may ask for their record to be deleted at any time and does not
              have to give a reason. If you hold their data, you have to act on that.
            </p>
          </Clause>

          <Clause id="never" n="06" title="What this app does not do">
            <ul className="flex flex-col gap-1.5 pl-0">
              {[
                "It does not sell or share data with advertisers",
                "It does not run third-party analytics or tracking",
                "It does not issue any official or legal determination",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-[0.62rem] h-px w-3 shrink-0"
                    style={{ background: "var(--fg-faint)" }}
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Clause>

          <footer className="mt-14 pt-5" style={{ borderTop: "1px solid var(--glass-hairline)" }}>
            <PendingLink
              href="/whats-real"
              className="inline-flex min-h-[44px] items-center text-[0.9rem] font-medium underline underline-offset-[3px]"
              style={{ color: "var(--fg-muted)" }}
            >
              See also: What is real, what is not
            </PendingLink>
          </footer>
        </div>
      </div>
    </main>
  );
}

// --- document furniture ---------------------------------------------------

// A numbered clause: rule, margin number, title, then prose at a fixed measure. No card, no
// border, the rule and the whitespace do the work.
function Clause({
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
    <section id={id} className="mt-12 scroll-mt-28 first:mt-10">
      <div className="flex items-baseline gap-3 sm:gap-4">
        <span className="font-mono text-[0.72rem] tabular-nums faint">{n}</span>
        <h2 className="text-[1.05rem] font-semibold tracking-tight sm:text-[1.2rem]">{title}</h2>
      </div>
      <div
        className="mt-4 flex flex-col gap-4 text-[0.95rem] leading-[1.68] muted"
        style={{ maxWidth: "68ch" }}
      >
        {children}
      </div>
    </section>
  );
}
