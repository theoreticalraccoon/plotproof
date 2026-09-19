/** /models, the short technical evidence page. */
import type { Metadata } from "next";
import Breadcrumb from "@/components/shell/Breadcrumb";
import PendingLink from "@/components/motion/PendingLink";

// Every number comes from these artifacts at build time.
import card from "@/public/models/tea-disease-mnv3s-card.json";
import evaluation from "@/models/tea/evaluation.json";
import taxonomy from "@/models/tea/taxonomy.json";
import provenance from "@/models/tea/provenance.json";
import prices from "@/public/models/prices.json";

export const metadata: Metadata = {
  title: "How the models work",
  description: "What the tea leaf model can name, how it scores, when it refuses, and what it was trained on.",
};

type TestRow = {
  test_set: string;
  samples: number;
  accuracy: number;
  per_class: Record<string, { support: number }>;
};

const tests = evaluation.tests as unknown as TestRow[];
const classes = (taxonomy.classes as { key: string; displayName: string; active: boolean }[]).filter((c) => c.active);
const datasets = provenance.datasets as { id: string; name: string; doi: string; licence: string }[];
const coverage = card.abstention.coverage_by_test_set as Record<string, { coverage: number; accuracy_on_accepted: number }>;

const LABELS: Record<string, string> = {
  "Test 1": "Same source as training",
  "Test 2": "Another lab (EWU)",
  "Test 3": "Another lab (TLD-BD)",
  "Test 4": "Simulated field photos",
};
const label = (name: string) => LABELS[name.match(/^Test \d/)?.[0] ?? ""] ?? name;
const floor = (t: TestRow) => Math.max(...Object.values(t.per_class).map((c) => c.support)) / t.samples;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

const ROLES: Record<string, string> = {
  cs_d: "Training and Test 1",
  ewu_tea_leaf_disease: "Test 2 only",
  tld_bd: "Test 3 only",
};

export default function ModelsPage() {
  const crossCovered = new Set(
    (evaluation.tests as unknown as { test_set: string; classes_present: string[] }[])
      .filter((t) => /cross-dataset/i.test(t.test_set))
      .flatMap((t) => t.classes_present),
  );

  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl px-5 pb-20 pt-6 sm:px-8">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Models" }]} />

      <header className="mt-8">
        <div style={{ height: 3, width: 44, background: "var(--accent)" }} aria-hidden="true" />
        <h1 className="font-display mt-5 text-[2.3rem] leading-[1.04] sm:text-[3rem]">How the models work</h1>
        <p className="mt-5 text-[1.05rem] leading-[1.6] muted" style={{ maxWidth: "60ch" }}>
          One small neural network names tea leaf diseases from a photo. It runs on the phone, and the
          photo never leaves it. Every number below is read from the model files when the site builds.
        </p>
      </header>

      <Part title="What it can name">
        <ul className="mt-2 flex flex-wrap gap-2">
          {classes.map((c) => (
            <li key={c.key} className="chip text-[0.8rem]">
              {c.displayName}
              {!crossCovered.has(c.key) && <span style={{ color: "var(--warn)" }}> *</span>}
            </li>
          ))}
        </ul>
        <P>
          <span style={{ color: "var(--warn)" }}>*</span> Only tested on photos from the training source.
          No other dataset has them.
        </P>
      </Part>

      <Part title="How well it does">
        <Table
          head={["Test", "Photos", "Accuracy", "Always-guess floor", "Answers given", "Right when it answers"]}
          rows={tests.map((t) => {
            const c = coverage[t.test_set];
            return [
              label(t.test_set),
              t.samples.toLocaleString(),
              pct(t.accuracy),
              pct(floor(t)),
              c ? pct(c.coverage) : "-",
              c ? pct(c.accuracy_on_accepted) : "-",
            ];
          })}
        />
        <P>
          The drop on other labs&apos; photos is the honest number. When its confidence is under{" "}
          {card.abstention.threshold}, it says it isn&apos;t sure instead of guessing. There are no public
          photos of leaves on Sri Lankan bushes, so accuracy on a real farm photo is still unknown.
        </P>
      </Part>

      <Part title="What it was trained on">
        <P>
          {card.model.architecture.split(" (")[0]}, {(card.model.bytes / 1_048_576).toFixed(1)} MB. Trained on CS-D only;
          the other two sets are held out for testing. CS-D lists 80,329 images but holds 9,000 originals,
          so it is split by original photo to keep copies out of the test set.
        </P>
        <Table
          head={["Dataset", "Used for", "Licence"]}
          rows={datasets
            .filter((d) => ROLES[d.id])
            .map((d) => [
              <a key={d.id} href={`https://doi.org/${d.doi}`} className="underline underline-offset-4" rel="noreferrer noopener" target="_blank">
                {d.name}
              </a>,
              ROLES[d.id],
              d.licence,
            ])}
        />
      </Part>

      <Part title="Everything else">
        <P>
          The rest is published formulas, not trained models: FAO-56 for irrigation, weather rules for
          disease pressure, and word matching for HS codes. Prices are forecast from{" "}
          <a href={prices.source.url} className="underline underline-offset-4" rel="noreferrer noopener" target="_blank">
            {prices.source.name}
          </a>{" "}
          and shown beside a &ldquo;same as last month&rdquo; guess.
        </P>
        <Table
          head={["Commodity", "Forecast error", "Naive guess error"]}
          rows={Object.values(
            prices.commodities as Record<string, { label: string; model: { backtestMape1m: number; naiveMape1m: number } }>,
          ).map((c) => [c.label, `${c.model.backtestMape1m}%`, `${c.model.naiveMape1m}%`])}
        />
        <p className="mt-8 text-[0.85rem] faint">
          Plain-language version:{" "}
          <PendingLink inline href="/whats-real" className="underline underline-offset-4">
            what is real
          </PendingLink>
          .
        </p>
      </Part>
    </main>
  );
}

function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="pt-12">
      <h2 className="font-display text-[1.5rem] leading-tight sm:text-[1.75rem]">{title}</h2>
      <hr className="hairline mt-4" />
      <div className="mt-5">{children}</div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 text-[0.92rem] leading-relaxed muted" style={{ maxWidth: "64ch" }}>
      {children}
    </p>
  );
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[30rem] border-collapse text-[0.84rem]">
        <thead>
          <tr>
            {head.map((h) => (
              <th
                key={h}
                scope="col"
                className="border-b px-2.5 py-2 text-left text-[0.7rem] font-semibold uppercase tracking-[0.08em] faint"
                style={{ borderColor: "var(--glass-hairline)" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j} className="border-b px-2.5 py-2 align-top tabular-nums" style={{ borderColor: "var(--glass-hairline)" }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
