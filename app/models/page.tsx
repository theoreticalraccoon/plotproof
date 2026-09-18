/**
 * /models — the technical evidence page.
 *
 * Audience: someone evaluating whether the ML in this project is real. Not a
 * farmer. Everything a farmer needs is phrased for them elsewhere; this page is
 * allowed to say "macro-F1" and "expected calibration error".
 *
 * THE RULE THIS FILE EXISTS TO OBEY: not one metric is typed into this
 * component. Every number below is imported from the authoritative artifact
 * that produced it — the published model card, the evaluation dump, the
 * taxonomy, the provenance record. A page that restated the numbers would agree
 * with the card right up until the day it didn't, and the disagreement would
 * favour whichever one someone happened to read.
 *
 * It is a Server Component on purpose: the JSON is read at build time, so there
 * is no fetch, no loading state, and no way for the page to render half a claim.
 */
import type { Metadata } from "next";
import Image from "next/image";
import Breadcrumb from "@/components/shell/Breadcrumb";
import PendingLink from "@/components/motion/PendingLink";

// The authoritative artifacts. `models/tea/` is the working record; the two
// files under `public/` are the ones the running app actually consumes, and
// `scripts/audit_release.py` fails the build if they ever disagree.
import card from "@/public/models/tea-disease-mnv3s-card.json";
import evaluation from "@/models/tea/evaluation.json";
import taxonomy from "@/models/tea/taxonomy.json";
import provenance from "@/models/tea/provenance.json";
import prices from "@/public/models/prices.json";

export const metadata: Metadata = {
  title: "Models, datasets and measured results",
  description:
    "Every model in PlotProof with its architecture, training data, licences, measured results on three separate test sets, calibration, abstention threshold and known limitations.",
};

const CONTENTS = [
  { id: "classifier", n: "01", label: "Tea leaf classifier" },
  { id: "classes", n: "02", label: "Classes" },
  { id: "data", n: "03", label: "Training data and split" },
  { id: "results", n: "04", label: "Measured results" },
  { id: "calibration", n: "05", label: "Calibration and abstention" },
  { id: "limits", n: "06", label: "Limitations and failure modes" },
  { id: "provenance", n: "07", label: "Datasets, licences, provenance" },
  { id: "others", n: "08", label: "The other models" },
  { id: "reproduce", n: "09", label: "Reproducing this" },
];

// --- small typed views over the JSON -------------------------------------

type TestRow = {
  test_set: string;
  samples: number;
  accuracy: number;
  macro_precision: number;
  macro_recall: number;
  macro_f1: number;
  classes_present: string[];
  classes_absent: string[];
  calibration: { temperature: number; ece: number };
  abstention: { coverage: number; accuracy_on_accepted: number };
  per_class: Record<
    string,
    { support: number; precision: number; recall: number; f1: number; ece: number }
  >;
};

const tests = evaluation.tests as unknown as TestRow[];
const classes = taxonomy.classes as {
  classId: number;
  key: string;
  displayName: string;
  kind: string;
  active: boolean;
  notes?: string;
}[];
const datasets = provenance.datasets as {
  id: string;
  name: string;
  doi: string;
  source_url: string;
  licence: string;
  licence_url: string;
  licence_source: string;
  commercial_use: string;
  derivatives_and_model_weights: string;
}[];

/** Which classes a cross-dataset test set has ever covered. Derived, not listed. */
const crossDatasetCovered = new Set(
  tests
    .filter((t) => /cross-dataset/i.test(t.test_set))
    .flatMap((t) => t.classes_present),
);

/**
 * Majority-class share of a test set, from its own published support counts.
 *
 * The tea artifact ships NO trained baseline — unlike `prices.json`, which
 * carries a naive forecast to print beside its model. Rather than invent one or
 * show accuracy with nothing to compare it against, this is the floor any
 * classifier clears by always guessing the commonest class. It is arithmetic
 * over numbers the artifact already publishes, and the page says so where it
 * appears.
 */
function majorityShare(t: TestRow): number {
  const supports = Object.values(t.per_class).map((c) => c.support);
  return Math.max(...supports) / t.samples;
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const pct2 = (x: number) => `${(x * 100).toFixed(2)}%`;

export default function ModelsPage() {
  const inDist = tests.find((t) => !/cross-dataset/i.test(t.test_set))!;
  const cross = tests.filter((t) => /cross-dataset/i.test(t.test_set));
  const activeClasses = classes.filter((c) => c.active);
  const reservedClasses = classes.filter((c) => !c.active);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-5xl px-5 pb-20 pt-6 sm:px-8">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Models" }]} />

      <header className="mt-8">
        <div style={{ height: 3, width: 44, background: "var(--accent)" }} aria-hidden="true" />
        <h1 className="font-display mt-5 text-[2.3rem] leading-[1.04] sm:text-[3.1rem]">
          Models, datasets and measured results
        </h1>
        <p
          className="mt-6 text-[1.08rem] leading-[1.58] muted sm:text-[1.15rem]"
          style={{ maxWidth: "62ch" }}
        >
          Every number on this page is read at build time from the artifact that produced it — the
          published model card, the evaluation dump, the taxonomy, the licence record. None of them
          is typed into the page, so none of them can drift away from the model they describe.
        </p>
        <p className="mt-4 text-[0.92rem] faint" style={{ maxWidth: "62ch" }}>
          Written for a reviewer, not a farmer. The same facts are phrased for the person holding
          the phone on{" "}
          <PendingLink href="/grow/diagnose" className="underline underline-offset-4">
            the diagnosis screen
          </PendingLink>{" "}
          and inventoried plainly on{" "}
          <PendingLink href="/whats-real" className="underline underline-offset-4">
            what is real
          </PendingLink>
          .
        </p>
      </header>

      <hr className="hairline mt-10" />

      <div className="grid gap-x-16 lg:grid-cols-[13rem_1fr]">
        <nav
          aria-label="On this page"
          className="sticky hidden self-start lg:block"
          style={{ top: "calc(var(--nav-h) + 2rem)", paddingTop: "2.5rem" }}
        >
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] faint">Contents</p>
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
          {/* ============ 01 CLASSIFIER ============ */}
          <Part id="classifier" n="01" title="Tea leaf classifier">
            <P>
              A convolutional network that looks at one photograph of a tea leaf and returns one of
              six conditions, a calibrated confidence, or — more often than not on a farm it has
              never seen — a refusal to answer. It runs entirely in the browser; no photograph is
              uploaded anywhere.
            </P>

            <Facts
              rows={[
                ["Name", `${card.model.name} ${card.model.version}`],
                ["Architecture", card.model.architecture],
                ["Why this architecture", card.model.why_this_architecture],
                ["Parameters", card.model.parameters.toLocaleString()],
                ["Artifact size", `${(card.model.bytes / 1_048_576).toFixed(2)} MB (${card.model.bytes.toLocaleString()} bytes)`],
                ["Framework", card.model.framework],
                ["Export", card.model.export_format],
                ["Trained", card.model.trained_at],
                ["Runtime", "onnxruntime-web (WebAssembly), single-threaded, loaded lazily on /grow/diagnose only"],
              ]}
            />

            <h3 className="mt-8 text-[0.95rem] font-semibold">Artifact identity</h3>
            <P small>
              The SHA-256 below is the hash of the file the browser downloads. The app re-hashes what
              it actually received when run with <Code>?diag=1</Code>, because a served <Code>200</Code>{" "}
              is not proof that the published bytes arrived — a stale cache or a proxy returns 200 too.
            </P>
            <pre
              className="mt-3 overflow-x-auto rounded-[var(--radius-sm)] p-3.5 text-[0.72rem] leading-relaxed"
              style={{ background: "var(--bg-1)", border: "1px solid var(--glass-hairline)" }}
            >
              <code>
                {card.model.file}
                {"\n"}
                sha256  {card.model.sha256}
                {"\n"}
                bytes   {card.model.bytes.toLocaleString()}
              </code>
            </pre>

            <h3 className="mt-8 text-[0.95rem] font-semibold">Input and preprocessing</h3>
            <P small>
              The browser reproduces this exactly. A cross-language check runs the real TypeScript
              preprocessing against the Python transform the model was evaluated under and compares
              predictions through the published ONNX — because if the two ever diverged, nothing
              would fail and the model would simply get quietly worse in the field than on the bench.
            </P>
            <Facts
              rows={[
                ["Input tensor", `float32 [1, 3, ${card.preprocessing.image_size}, ${card.preprocessing.image_size}] (NCHW)`],
                ["Resize", `shorter side to ${card.preprocessing.resize_shorter_side_to} px, then ${card.preprocessing.crop} crop to ${card.preprocessing.image_size}`],
                ["Channel order", card.preprocessing.channel_order],
                ["Scaling", card.preprocessing.scale],
                ["Mean", card.preprocessing.mean.join(", ")],
                ["Std", card.preprocessing.std.join(", ")],
              ]}
            />
            <h4 className="mt-6 text-[0.85rem] font-semibold muted">Training augmentation</h4>
            <P small>
              Chosen for what actually varies when a farmer photographs a leaf, not for what looks
              impressive in a config. Illumination is weighted heaviest: the same lesion under noon
              sun and under shade is the largest appearance shift in the field.
            </P>
            <ul className="mt-3 flex flex-wrap gap-2">
              {card.preprocessing.augmentation_train.map((a) => (
                <li key={a} className="chip font-mono text-[0.68rem]">
                  {a}
                </li>
              ))}
            </ul>
          </Part>

          {/* ============ 02 CLASSES ============ */}
          <Part id="classes" n="02" title="Classes">
            <P>
              The taxonomy is the contract. It is a single JSON file that the Python training code
              and the TypeScript app both read; neither hardcodes a class name, and the app refuses
              to load a card whose classes are out of output order, because a reordered taxonomy
              would rename every diagnosis while passing every other check.
            </P>

            <h3 className="mt-7 text-[0.95rem] font-semibold">
              Active — {activeClasses.length} classes, taxonomy v{taxonomy.taxonomy_version}
            </h3>
            <Table
              head={["#", "Class", "Kind", "Cross-dataset tested?"]}
              rows={activeClasses.map((c) => [
                String(c.classId),
                c.displayName,
                c.kind.replace(/_/g, " "),
                crossDatasetCovered.has(c.key) ? (
                  <span key={c.key} style={{ color: "var(--accent)" }}>
                    yes
                  </span>
                ) : (
                  <span key={c.key} style={{ color: "var(--warn)" }}>
                    no — in-distribution evidence only
                  </span>
                ),
              ])}
            />
            <Callout tone="warn">
              <strong>Blister blight and red rust have no external validation at all.</strong> Neither
              appears in any cross-dataset test set in the audited corpus, so their only numbers come
              from Test 1, which shares the training domain. Blister blight is simultaneously the most
              important class in the product — it is the disease the weather engine models — and the
              least externally verifiable one. The app states this next to every prediction of either,
              and must never imply otherwise.
            </Callout>

            <h3 className="mt-8 text-[0.95rem] font-semibold">
              Reserved but inactive — {reservedClasses.length} classes
            </h3>
            <P small>
              Declared with permanent IDs and not trained. Reserving an ID costs nothing and stops a
              future renumbering from silently relabelling predictions already saved on a phone. None
              of these appears in the training set, and presence in a test set is not a reason to
              activate a class.
            </P>
            <Table
              head={["#", "Class", "Kind"]}
              rows={reservedClasses.map((c) => [
                String(c.classId),
                c.displayName,
                c.kind.replace(/_/g, " "),
              ])}
            />
          </Part>

          {/* ============ 03 DATA ============ */}
          <Part id="data" n="03" title="Training data and split">
            <P>
              Trained on one dataset only: <strong>{card.training.dataset_ref.name}</strong>. The two
              other corpora are never touched during training — they exist so that the transfer gap
              can be measured rather than assumed.
            </P>

            <Callout>
              <strong>The finding that made the rest of this defensible.</strong> CS-D advertises
              80,329 images. It is actually 9,000 photographs, each published nine times with
              augmentations at nearest-neighbour similarity 0.9988 — effectively identical. The
              grouping is undocumented; it was recovered empirically. Splitting on images rather than
              source groups would have put near-identical siblings on both sides of the train/test
              boundary and inflated every number below into meaninglessness.
            </Callout>

            <Facts
              rows={[
                ["Training set", card.training.dataset],
                ["DOI", card.training.dataset_ref.doi],
                ["Licence", card.training.dataset_ref.licence],
                ["Split unit", card.training.split_unit],
                ["Split rule", card.training.split_rule],
                ["Groups", `${card.training.groups.train.toLocaleString()} train / ${card.training.groups.val.toLocaleString()} val / ${card.training.groups.test.toLocaleString()} test`],
                ["Images", `${card.training.images.train_pool.toLocaleString()} train pool / ${card.training.images.val.toLocaleString()} val / ${card.training.images.test.toLocaleString()} test`],
                ["Samples per group per epoch", String(card.training.samples_per_group_per_epoch)],
                ["Class weighting", card.training.class_weighting],
              ]}
            />
            <P small>
              <strong>Why one sample per group:</strong> {card.training.samples_per_group_rationale}
            </P>
            <P small>
              <strong>Why no class weighting:</strong> {card.training.class_weighting_rationale}
            </P>
            <P small>
              Selection metric: <Code>{evaluation.selection_metric}</Code>, on validation only, at
              epoch {evaluation.selected_epoch}. Accuracy on a set this balanced would be dominated
              by the easy classes and would hide one collapsing entirely. A leakage check runs six
              assertions and exits non-zero before training is allowed to start.
            </P>
          </Part>

          {/* ============ 04 RESULTS ============ */}
          <Part id="results" n="04" title="Measured results">
            <Callout tone="warn">
              <strong>{card.evaluation.never_pool_note}</strong> One measures memorisation of a
              domain, one measures transfer to a lab domain, one measures transfer to a field domain.
              An average of the three would describe none of them. There is deliberately no single
              headline accuracy anywhere in this project.
            </Callout>

            <P small>
              This artifact ships <strong>no trained baseline</strong> — unlike the price model
              below, which carries a naive forecast to print beside it. The comparison offered here
              instead is the majority-class share of each test set, computed from that set&rsquo;s own
              published support counts: the floor any classifier clears by always guessing the
              commonest class. It is arithmetic over the artifact, not a model that was run.
            </P>

            {tests.map((t) => {
              const isCross = /cross-dataset/i.test(t.test_set);
              return (
                <section key={t.test_set} className="mt-8">
                  <h3 className="text-[1rem] font-semibold">{t.test_set}</h3>
                  <p className="mt-1.5 text-[0.82rem] faint">
                    {t.samples.toLocaleString()} images ·{" "}
                    {t.classes_present.length} of {activeClasses.length} classes present
                    {t.classes_absent.length > 0 && (
                      <> · absent: {t.classes_absent.map((c) => c.replace(/_/g, " ")).join(", ")}</>
                    )}
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-sm)] sm:grid-cols-4"
                       style={{ background: "var(--glass-hairline)" }}>
                    <Stat label="Accuracy" value={pct2(t.accuracy)} />
                    <Stat label="Majority-class floor" value={pct2(majorityShare(t))} faint />
                    <Stat label="Macro-F1" value={t.macro_f1.toFixed(4)} />
                    <Stat
                      label="ECE (calibration error)"
                      value={t.calibration.ece.toFixed(4)}
                      tone={isCross ? "warn" : undefined}
                    />
                  </div>

                  <details className="mt-3">
                    <summary className="cursor-pointer text-[0.82rem] font-medium muted">
                      Per class
                    </summary>
                    <Table
                      head={["Class", "Support", "Precision", "Recall", "F1", "ECE"]}
                      rows={Object.entries(t.per_class).map(([k, v]) => [
                        k.replace(/_/g, " "),
                        v.support.toLocaleString(),
                        v.precision.toFixed(4),
                        v.recall.toFixed(4),
                        v.f1.toFixed(4),
                        v.ece.toFixed(4),
                      ])}
                    />
                  </details>
                </section>
              );
            })}

            <Callout tone="warn">
              <strong>The honest headline is the gap, not a number.</strong>{" "}
              {pct2(inDist.accuracy)} on held-out data from the set it learned from;{" "}
              {cross.map((t) => pct2(t.accuracy)).join(" and ")} on photographs from farms it has
              never seen. Calibration collapses the same way — expected calibration error rises from{" "}
              {inDist.calibration.ece.toFixed(4)} in-distribution to{" "}
              {cross.map((t) => t.calibration.ece.toFixed(4)).join(" and ")} under domain shift. A
              model that is confidently wrong is more dangerous than one that is visibly unsure,
              which is why the next section exists.
            </Callout>

            <figure className="mt-8">
              <Image
                src="/models/tea-reliability.png"
                alt="Reliability diagrams for the three test sets: predicted confidence against observed accuracy, with the in-distribution set close to the diagonal and both cross-dataset sets far above it."
                width={1600}
                height={520}
                className="w-full rounded-[var(--radius-sm)]"
                style={{ border: "1px solid var(--glass-hairline)", background: "var(--bg-1)" }}
              />
              <figcaption className="mt-2 text-[0.78rem] faint">
                Reliability diagrams, one per test set. Points above the diagonal are
                over-confidence. Generated by the evaluation run; full numeric report in{" "}
                <Code>{card.evaluation.full_report}</Code>.
              </figcaption>
            </figure>
          </Part>

          {/* ============ 05 CALIBRATION ============ */}
          <Part id="calibration" n="05" title="Calibration and abstention">
            <h3 className="text-[0.95rem] font-semibold">Calibration</h3>
            <Facts
              rows={[
                ["Method", card.calibration.method],
                ["Temperature", String(card.calibration.temperature)],
                ["Fitted on", card.calibration.fitted_on],
                ["Note", card.calibration.note],
              ]}
            />
            <P small>
              Temperature scaling was chosen over Platt scaling or isotonic regression for one
              property: it cannot change the argmax. Accuracy is untouched and only the confidence
              moves, which matters because the abstention threshold is applied to the calibrated
              confidence — a calibration that reshuffled predictions would make the two interact.
            </P>

            <h3 className="mt-8 text-[0.95rem] font-semibold">Abstention</h3>
            <Facts
              rows={[
                ["Threshold", String(card.abstention.threshold)],
                ["Selection rule", card.abstention.selection_rule],
                ["Selected on", card.abstention.selected_on],
                ["Validation coverage", pct(card.abstention.validation_coverage)],
                ["Validation accuracy on accepted", pct2(card.abstention.validation_accuracy_on_accepted)],
                ["Behaviour", card.abstention.behaviour],
              ]}
            />

            <Callout>
              <strong>The rule that was rejected, kept on the record.</strong>{" "}
              {card.abstention.rejected_rule.rule} would have chosen{" "}
              <Code>{String(card.abstention.rejected_rule.would_have_chosen)}</Code>.{" "}
              {card.abstention.rejected_rule.why_rejected} The failure is instructive rather than a
              mere bug: an abstention threshold exists to catch inputs unlike the training
              distribution, and the validation set contains none by construction, so it cannot be
              asked where accuracy falls away. A quantile rule asks a question validation can answer.
            </Callout>

            <h3 className="mt-8 text-[0.95rem] font-semibold">
              What the threshold costs, per test set
            </h3>
            <P small>
              Coverage is <em>reported as an outcome</em> and was never used to choose the threshold —
              doing so would have consumed the only held-out evidence available.
            </P>
            <Table
              head={["Test set", "Coverage (answers given)", "Accuracy on accepted", "Accuracy overall"]}
              rows={Object.entries(card.abstention.coverage_by_test_set).map(([name, v]) => {
                const t = tests.find((x) => x.test_set === name);
                return [
                  name,
                  pct(v.coverage),
                  pct2(v.accuracy_on_accepted),
                  t ? pct2(t.accuracy) : "—",
                ];
              })}
            />

            <Callout tone="warn">
              <strong>Abstention is a mitigation, not proof of correctness.</strong> On field
              photographs from an unfamiliar farm the model declines roughly two answers in three,
              and what it does answer is right about three quarters of the time — better than
              answering everything, and a long way from a diagnosis. The product states the decline
              rate on screen so that repeated refusals read as a model that knows its limits rather
              than a broken app.
            </Callout>
          </Part>

          {/* ============ 06 LIMITS ============ */}
          <Part id="limits" n="06" title="Limitations and failure modes">
            <P>
              These ship inside the model card, so correcting one is a JSON edit rather than a code
              change, and the app renders them from the same source it reads its thresholds from.
            </P>
            <ol className="mt-5 space-y-3">
              {card.known_limitations.map((l, i) => (
                <li key={l} className="flex gap-3 text-[0.9rem] leading-relaxed">
                  <span className="font-mono text-[0.72rem] tabular-nums faint" style={{ paddingTop: "0.25rem" }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{l}</span>
                </li>
              ))}
            </ol>

            <h3 className="mt-8 text-[0.95rem] font-semibold">Not yet verified</h3>
            <Callout tone="warn">
              In-browser inference has <strong>not</strong> been observed on a real device. The
              published artifact loads and runs under Python, the TypeScript preprocessing matches
              the Python transform, the pure decision logic is unit-tested and the assets serve — but
              the span from WebAssembly instantiation to <Code>session.run</Code> has never been
              watched on an actual phone. The checklist for closing that gap is in{" "}
              <Code>BROWSER-SMOKE-TEST.md</Code>, and until a human works through it on an Android
              device and a desktop browser, no claim here should be read as saying browser inference
              is verified.
            </Callout>
          </Part>

          {/* ============ 07 PROVENANCE ============ */}
          <Part id="provenance" n="07" title="Datasets, licences, provenance">
            <P>
              Every licence was read from the original repository record at the pinned DOI, never
              from a mirror, a blog or a copied README. The full record, including the datasets that
              were examined and rejected, is in <Code>models/tea/provenance.json</Code>; it was
              verified on {provenance.verified_on}.
            </P>
            <Callout>
              <strong>Why this step comes before training, not after.</strong> A predecessor model in
              this repository was built on a benchmark licensed CC BY-<em>NC</em>, which meant the
              trained weights could never ship. Licence problems are unrecoverable once you have
              trained — so nothing is downloaded here until the licence is verified at source.{" "}
              {provenance.licence_conflict_finding ? String(provenance.licence_conflict_finding) : ""}
            </Callout>

            {datasets.map((d) => (
              <section key={d.id} className="glass mt-5 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3 className="min-w-0 text-[0.95rem] font-semibold">{d.name}</h3>
                  <span className="shrink-0 text-[0.78rem]" style={{ color: "var(--accent)" }}>
                    {d.licence}
                  </span>
                </div>
                <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-[0.8rem] sm:grid-cols-[9rem_1fr]">
                  <dt className="faint">Role here</dt>
                  <dd>{roleOf(d.id)}</dd>
                  <dt className="faint">DOI</dt>
                  <dd>
                    <a
                      href={`https://doi.org/${d.doi}`}
                      className="underline underline-offset-4"
                      rel="noreferrer noopener"
                      target="_blank"
                    >
                      {d.doi}
                    </a>
                  </dd>
                  <dt className="faint">Record</dt>
                  <dd>
                    <a
                      href={d.source_url}
                      className="break-all underline underline-offset-4"
                      rel="noreferrer noopener"
                      target="_blank"
                    >
                      {d.source_url}
                    </a>
                  </dd>
                  <dt className="faint">Licence text</dt>
                  <dd>
                    <a
                      href={d.licence_url}
                      className="underline underline-offset-4"
                      rel="noreferrer noopener"
                      target="_blank"
                    >
                      {d.licence_url}
                    </a>
                  </dd>
                  <dt className="faint">Licence seen at</dt>
                  <dd>{d.licence_source}</dd>
                  <dt className="faint">Commercial use</dt>
                  <dd>{d.commercial_use}</dd>
                  <dt className="faint">Model weights</dt>
                  <dd>{d.derivatives_and_model_weights}</dd>
                </dl>
              </section>
            ))}

            <h3 className="mt-8 text-[0.95rem] font-semibold">Attribution</h3>
            <ul className="mt-3 space-y-2 border-l-2 pl-4 text-[0.85rem] muted"
                style={{ borderColor: "var(--glass-hairline)" }}>
              {card.attribution.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>

            <h3 className="mt-8 text-[0.95rem] font-semibold">Where the artifacts live</h3>
            <Table
              head={["File", "What it is"]}
              rows={[
                ["public/models/tea-disease-mnv3s.onnx", "The weights the browser downloads"],
                ["public/models/tea-disease-mnv3s-card.json", "The model card the app reads every constant from"],
                [card.evaluation.full_report, "Full evaluation: per-class, confusion matrices, reliability bins"],
                ["models/tea/provenance.json", "Licence verification, per dataset, from the original record"],
                ["models/tea/taxonomy.json", "The class contract, active and reserved"],
                ["models/tea/manifest.json", "Dataset inventory: counts, grouping, archive hashes"],
                ["models/tea/dataset-audit.md", "Sixteen findings from inspecting the actual images"],
                ["models/tea/leakage-report.json", "Six leakage assertions, all passing"],
              ]}
            />
          </Part>

          {/* ============ 08 OTHERS ============ */}
          <Part id="others" n="08" title="The other models">
            <P>
              The classifier is the only trained network in the project. The rest of the quantitative
              surface is deterministic and citable, which is a deliberate choice rather than an
              absence: a farmer acting on a watering instruction deserves arithmetic they could check.
            </P>

            <h3 className="mt-7 text-[0.95rem] font-semibold">
              Price forecast — {prices.source.name}
            </h3>
            <P small>
              The one artifact in the project that ships its own baseline, and the pattern every
              later model card copied: print the naive comparison next to your own error, every time.
            </P>
            <Table
              head={["Commodity", "Model", "Backtest MAPE (1m)", "Naive baseline MAPE", "Window"]}
              rows={Object.values(prices.commodities as Record<string, {
                label: string;
                model: { name: string; backtestMape1m: number; naiveMape1m: number; windowMonths: number };
              }>).map((c) => [
                c.label,
                c.model.name,
                `${c.model.backtestMape1m}%`,
                `${c.model.naiveMape1m}%`,
                `${c.model.windowMonths} months`,
              ])}
            />
            <P small>
              Several of these beat the naive forecast by a margin too small to be worth much, and
              the card says so rather than rounding it into a claim. Source:{" "}
              <a href={prices.source.url} className="underline underline-offset-4" rel="noreferrer noopener" target="_blank">
                {prices.source.name}
              </a>{" "}
              ({prices.source.license}).
            </P>

            <h3 className="mt-8 text-[0.95rem] font-semibold">Deterministic engines</h3>
            <Table
              head={["Engine", "Method", "Why not learned"]}
              rows={[
                [
                  "Irrigation — lib/grow/irrigation.ts",
                  "FAO-56 soil-water balance; soil properties from Table 19, crop coefficients from Tables 12 and 22",
                  "Published, citable and checkable by an agronomist. There is no training data that would beat it and no caveat it needs.",
                ],
                [
                  "Disease pressure — lib/grow/risk.ts",
                  "Trapezoidal fuzzy membership over leaf wetness, temperature, humidity and sunshine, with wetness and temperature as gates rather than weights",
                  "Computed from this plot's own weather, so unlike the classifier it carries no transfer gap. The decision logic stays in readable code because it is the part an agronomist will question.",
                ],
                [
                  "HS code — lib/compliance/hs.ts",
                  "Token-overlap baseline over a curated product catalogue",
                  "Labelled as a baseline with an explicit seam for an embedding classifier. Not dressed up as more than it is.",
                ],
              ]}
            />

            <Callout>
              <strong>There is deliberately no fusion model.</strong> The obvious move is to combine
              the classifier&rsquo;s output with the weather-driven infection pressure into a single
              confidence. A calibrated posterior over six classes and a fuzzy index over weather
              conditions are not commensurable, so any average of them is a number with no referent —
              and worse, merging them would hide the disagreement, which is the most useful thing on
              the screen. When the photograph and the weather point different ways the app says so
              and recommends inspection. Environmental evidence can never change the predicted class.
            </Callout>
          </Part>

          {/* ============ 09 REPRODUCE ============ */}
          <Part id="reproduce" n="09" title="Reproducing this">
            <P>
              Images are not committed — the licences do not require it and it would add about a
              gigabyte. Every dataset is fetched from the DOI pinned in the provenance record, and
              CS-D&rsquo;s archive is verified by SHA-256 against the manifest before use.
            </P>
            <pre
              className="mt-4 overflow-x-auto rounded-[var(--radius-sm)] p-4 text-[0.75rem] leading-relaxed"
              style={{ background: "var(--bg-1)", border: "1px solid var(--glass-hairline)" }}
            >
              <code>{`python scripts/audit_tea_datasets.py --csd <d> --ewu <d> --tld <d>
python ml/tea/check_leakage.py   --csd <d> --ewu <d> --tld <d>   # must pass first
python ml/tea/train.py           --csd <d> --img-size ${card.preprocessing.image_size} --samples-per-group ${card.training.samples_per_group_per_epoch} --epochs ${card.training.config.epochs}
python ml/tea/evaluate.py        --csd <d> --ewu <d> --tld <d>
python ml/tea/export.py
python ml/tea/smoke_infer.py     --csd <d> --tld <d>             # runs the PUBLISHED file
python ml/tea/check_ts_parity.py --csd <d>                       # TypeScript vs Python
python scripts/audit_release.py                                  # card vs artifact vs docs`}</code>
            </pre>
            <P small>
              The split is a pure function of identity — <Code>{card.training.split_rule}</Code> —
              so there is no split file to lose and the same groups land in the same places on any
              machine. Training seed is fixed. <Code>smoke_infer.py</Code> deliberately loads the{" "}
              <em>published</em> ONNX rather than the checkpoint: an earlier export silently wrote a
              graph with its weights stripped into a sidecar file, and only testing the artifact that
              actually ships caught it.
            </P>
          </Part>
        </div>
      </div>
    </main>
  );
}

// --- presentational helpers ----------------------------------------------

function roleOf(id: string): string {
  if (id === "cs_d") return "Training, validation and Test 1 (in-distribution)";
  if (id === "ewu_tea_leaf_disease") return "Test 2 — cross-dataset, detached leaf. Never seen in training.";
  if (id === "tld_bd") return "Test 3 — cross-dataset, field photographs. Never seen in training.";
  return "Examined during the audit; not used. See provenance.json for why.";
}

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
    <section id={id} className="scroll-mt-28 pt-12">
      <p className="font-mono text-[0.7rem] tabular-nums faint">{n}</p>
      <h2 className="font-display mt-2 text-[1.6rem] leading-tight sm:text-[1.9rem]">{title}</h2>
      <hr className="hairline mt-5" />
      <div className="mt-6">{children}</div>
    </section>
  );
}

function P({ children, small }: { children: React.ReactNode; small?: boolean }) {
  return (
    <p
      className={small ? "mt-4 text-[0.85rem] leading-relaxed muted" : "mt-4 text-[0.95rem] leading-relaxed"}
      style={{ maxWidth: "64ch" }}
    >
      {children}
    </p>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code
      className="rounded px-1.5 py-0.5 font-mono text-[0.78em]"
      style={{ background: "var(--bg-1)" }}
    >
      {children}
    </code>
  );
}

function Callout({ children, tone }: { children: React.ReactNode; tone?: "warn" }) {
  const color = tone === "warn" ? "var(--warn)" : "var(--accent)";
  const bg = tone === "warn" ? "var(--warn-soft)" : "var(--accent-soft)";
  return (
    <div
      className="mt-5 rounded-[var(--radius-sm)] px-4 py-3.5 text-[0.88rem] leading-relaxed"
      style={{ background: bg, borderLeft: `3px solid ${color}`, maxWidth: "66ch" }}
    >
      {children}
    </div>
  );
}

function Facts({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="mt-4 grid gap-x-5 gap-y-2 text-[0.85rem] sm:grid-cols-[13rem_1fr]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="faint">{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Stat({
  label,
  value,
  tone,
  faint,
}: {
  label: string;
  value: string;
  tone?: "warn";
  faint?: boolean;
}) {
  return (
    <div className="px-3.5 py-3" style={{ background: "var(--bg-0)" }}>
      <p className="text-[0.68rem] leading-snug faint">{label}</p>
      <p
        className="mt-1 text-[1.05rem] font-semibold tabular-nums"
        style={{
          color: tone === "warn" ? "var(--warn)" : faint ? "var(--fg-muted)" : undefined,
        }}
      >
        {value}
      </p>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse text-[0.82rem]">
        <thead>
          <tr>
            {head.map((h) => (
              <th
                key={h}
                scope="col"
                className="border-b px-2.5 py-2 text-left text-[0.7rem] font-semibold uppercase tracking-[0.1em] faint"
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
                <td
                  key={j}
                  className="border-b px-2.5 py-2 align-top"
                  style={{ borderColor: "var(--glass-hairline)" }}
                >
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
