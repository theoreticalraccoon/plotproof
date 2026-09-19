/** /models, the technical evidence page. */
import type { Metadata } from "next";
import Image from "next/image";
import Breadcrumb from "@/components/shell/Breadcrumb";
import PendingLink from "@/components/motion/PendingLink";

// The authoritative artifacts.
import card from "@/public/models/tea-disease-mnv3s-card.json";
import evaluation from "@/models/tea/evaluation.json";
import taxonomy from "@/models/tea/taxonomy.json";
import provenance from "@/models/tea/provenance.json";
import prices from "@/public/models/prices.json";

export const metadata: Metadata = {
  title: "How the models work",
  description:
    "What the tea leaf model was trained on, how it scores on four test sets, when it refuses to answer, and what it still gets wrong.",
};

const CONTENTS = [
  { id: "classifier", n: "01", label: "The leaf model" },
  { id: "classes", n: "02", label: "What it can name" },
  { id: "data", n: "03", label: "Training data" },
  { id: "results", n: "04", label: "Test results" },
  { id: "calibration", n: "05", label: "When it refuses" },
  { id: "limits", n: "06", label: "Known problems" },
  { id: "provenance", n: "07", label: "Datasets and licences" },
  { id: "others", n: "08", label: "Everything else" },
  { id: "reproduce", n: "09", label: "Running it yourself" },
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

/** Majority-class share of a test set, from its own published support counts. */
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
          How the models work, and how well
        </h1>
        <p
          className="mt-6 text-[1.08rem] leading-[1.58] muted sm:text-[1.15rem]"
          style={{ maxWidth: "62ch" }}
        >
          Nothing on this page is typed in by hand. Each number is pulled from the model card, the
          evaluation report or the licence record when the site builds, so if the model changes,
          the page changes with it.
        </p>
        <p className="mt-4 text-[0.92rem] faint" style={{ maxWidth: "62ch" }}>
          This is the long version, for anyone checking our work. Farmers get the short version
          on{" "}
          <PendingLink inline href="/grow/diagnose" className="underline underline-offset-4">
            the diagnosis screen
          </PendingLink>{" "}
          and{" "}
          <PendingLink inline href="/whats-real" className="underline underline-offset-4">
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
          <Part id="classifier" n="01" title="The leaf model">
            <P>
              A small neural network looks at one photo of a tea leaf and names one of six
              conditions, with a confidence score. If it isn&apos;t sure enough, it says so and
              names nothing. It runs on the phone. The photo never leaves it.
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

            <h3 className="mt-8 text-[0.95rem] font-semibold">Which file this is</h3>
            <P small>
              The SHA-256 below is the fingerprint of the file the browser downloads. Add{" "}
              <Code>?diag=1</Code> to the diagnosis page and the app hashes what it actually received.
              A <Code>200</Code> response doesn&apos;t prove you got this file; a stale cache returns
              200 too.
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

            <h3 className="mt-8 text-[0.95rem] font-semibold">How a photo is prepared</h3>
            <P small>
              The browser has to prepare each photo exactly the way training did. A check script
              runs the app&apos;s TypeScript and the training Python on the same images and compares
              the answers. If they ever drifted apart nothing would crash. The model would just get
              worse, quietly.
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
            <h4 className="mt-6 text-[0.85rem] font-semibold muted">Making studio photos look like field photos</h4>
            <P small>
              Every public tea dataset we found is picked leaves on white paper. Farmers photograph
              leaves still on the bush. So half of every training round, each leaf is cut out of its
              photo, dropped into a blurry background made of other leaves, given patchy sunlight and
              shade, and run through a fake phone camera: off white balance, blur, noise, heavy JPEG.
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
          <Part id="classes" n="02" title="What it can name">
            <P>
              The class list lives in one JSON file that both the training code and the app read.
              Neither has a class name typed into it. If the order ever got shuffled, every diagnosis
              would come out under the wrong name and nothing else would notice, so the app refuses
              to load a model whose classes are out of order.
            </P>

            <h3 className="mt-7 text-[0.95rem] font-semibold">
              Active, {activeClasses.length} classes, taxonomy v{taxonomy.taxonomy_version}
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
                    no, in-distribution evidence only
                  </span>
                ),
              ])}
            />
            <Callout tone="warn">
              <strong>Nobody outside the training data has checked blister blight or red rust.</strong>{" "}
              No other dataset contains either one, so their scores come only from Test 1, which uses
              the same source as training. That hurts most for blister blight, the disease the weather
              engine is built around. The app says so under every blister blight or red rust result.
            </Callout>

            <h3 className="mt-8 text-[0.95rem] font-semibold">
              Reserved but inactive, {reservedClasses.length} classes
            </h3>
            <P small>
              These have permanent ID numbers but the model never learned them. Keeping the numbers
              reserved means adding a class later can&apos;t relabel results already saved on
              someone&apos;s phone.
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
          <Part id="data" n="03" title="Training data">
            <P>
              Trained on one dataset: <strong>{card.training.dataset_ref.name}</strong>. The other two
              are kept out of training completely. They&apos;re there to show how the model copes with
              photos from somewhere else.
            </P>

            <Callout>
              <strong>CS-D says it has 80,329 images. It has 9,000.</strong> Each photo was published
              nine times with small edits that leave the copies nearly identical. The dataset doesn&apos;t
              mention this; we found it by comparing images. Had we split by image, copies of the same
              photo would have landed in both training and testing, and every score below would be
              inflated. So we split by original photo.
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
              <strong>One copy per photo per round:</strong> {card.training.samples_per_group_rationale}
            </P>
            <P small>
              <strong>No class weighting:</strong> {card.training.class_weighting_rationale}
            </P>
            <P small>
              The saved model is the one with the best <Code>{evaluation.selection_metric}</Code> on
              validation, from round {evaluation.selected_epoch}. Plain accuracy can look fine while one
              class fails completely; macro-F1 can&apos;t. Before training starts, a script runs six
              checks for leaks between the splits and stops everything if one fails.
            </P>
          </Part>

          {/* ============ 04 RESULTS ============ */}
          <Part id="results" n="04" title="Test results">
            <Callout tone="warn">
              <strong>Four tests, four different questions, so no single accuracy figure.</strong>{" "}
              Tests 1 to 3 are all leaves photographed on paper: one set from the same source as
              training, two from other labs in Bangladesh. Test 4 takes the held-out training-source
              leaves and fakes field conditions around them. Averaging them would answer none of the
              four questions.
            </Callout>

            <P small>
              There&apos;s no second model to compare against. What you get instead is the
              &ldquo;majority-class floor&rdquo;: the score you&apos;d get by always guessing the most
              common class in that test set. Anything worth using has to clear it comfortably.
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
              <strong>The drop is what matters.</strong> On unseen photos from its own source the
              model gets {pct2(inDist.accuracy)} right. On the two other labs&apos; photos it gets{" "}
              {cross.map((t) => pct2(t.accuracy)).join(" and ")}. Its confidence goes wrong too:
              calibration error goes from {inDist.calibration.ece.toFixed(4)} to{" "}
              {cross.map((t) => t.calibration.ece.toFixed(4)).join(" and ")}, meaning it sounds surer
              than it should on photos it hasn&apos;t seen before. That&apos;s why it has a rule for
              refusing to answer, below.
            </Callout>

            <figure className="mt-8">
              <Image
                src="/models/tea-reliability.png"
                alt="Reliability diagrams: for each test set, how confident the model said it was against how often it was right."
                width={1600}
                height={520}
                className="w-full rounded-[var(--radius-sm)]"
                style={{ border: "1px solid var(--glass-hairline)", background: "var(--bg-1)" }}
              />
              <figcaption className="mt-2 text-[0.78rem] faint">
                One chart per test set. A point above the diagonal means the model was more confident
                than it had any right to be. Full numbers in{" "}
                <Code>{card.evaluation.full_report}</Code>.
              </figcaption>
            </figure>
          </Part>

          {/* ============ 05 CALIBRATION ============ */}
          <Part id="calibration" n="05" title="When it refuses">
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
              Temperature scaling only stretches or squeezes the confidence. It can&apos;t change
              which class wins, so accuracy stays exactly the same. That matters here because the
              refusal threshold below is applied to this adjusted confidence.
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
              <strong>Third try.</strong> The first threshold, 0.9976, was set from paper-background
              photos only. It refused about two photos in three. The second, 0.53, mixed easy and hard
              validation photos. The easy ones were nearly always right, which dragged the threshold
              down until the model answered 95% of photos from other labs and got over a quarter of
              those wrong. The current one is set on the fake-field photos alone, since those are the
              ones that show where the model starts failing.
            </Callout>

            <h3 className="mt-8 text-[0.95rem] font-semibold">
              How often it answers, per test set
            </h3>
            <P small>
              These numbers are results, not inputs. The threshold was picked without looking at any
              test set; otherwise the tests would stop being tests.
            </P>
            <Table
              head={["Test set", "Answers given", "Right when it answers", "Right overall"]}
              rows={Object.entries(card.abstention.coverage_by_test_set).map(([name, v]) => {
                const t = tests.find((x) => x.test_set === name);
                return [
                  name,
                  pct(v.coverage),
                  pct2(v.accuracy_on_accepted),
                  t ? pct2(t.accuracy) : "-",
                ];
              })}
            />

            <Callout tone="warn">
              <strong>We don&apos;t know how accurate it is on a real farm photo.</strong> There are
              no public photos of tea leaves on Sri Lankan bushes to test with. Test 4 is the closest
              we have, and it&apos;s simulated. When the app refuses, it tells the farmer how often
              that happens, so a refusal doesn&apos;t look like a bug.
            </Callout>
          </Part>

          {/* ============ 06 LIMITS ============ */}
          <Part id="limits" n="06" title="Known problems">
            <P>
              These live in the model card next to the thresholds, so the list can&apos;t fall out of
              date with the model.
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

            <h3 className="mt-8 text-[0.95rem] font-semibold">Still unchecked</h3>
            <Callout tone="warn">
              Nobody has watched the model run on a real phone yet. The model file runs in Python,
              the photo preparation matches, the decision code has tests, and desktop Chrome runs it
              fine. A mid-range Android phone is still untested. The steps for checking one are in{" "}
              <Code>BROWSER-SMOKE-TEST.md</Code>.
            </Callout>
          </Part>

          {/* ============ 07 PROVENANCE ============ */}
          <Part id="provenance" n="07" title="Datasets and licences">
            <P>
              Each licence below was checked on the dataset&apos;s original page, not a mirror or a
              copied README. The full record, including datasets we looked at and turned down, is in{" "}
              <Code>models/tea/provenance.json</Code>. Last checked {provenance.verified_on}.
            </P>
            <Callout>
              <strong>We check licences before downloading anything.</strong> An earlier model in
              this project was trained on a CC BY-<em>NC</em> dataset, which meant it could never
              ship. You can&apos;t fix that after training.{" "}
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

            <h3 className="mt-8 text-[0.95rem] font-semibold">Where the files are</h3>
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
          <Part id="others" n="08" title="Everything else">
            <P>
              The leaf classifier is the only neural network here. Everything else is plain formulas
              from published sources. If a farmer is told to water, someone should be able to check
              the sum.
            </P>

            <h3 className="mt-7 text-[0.95rem] font-semibold">
              Price forecast, {prices.source.name}
            </h3>
            <P small>
              Each forecast is shown next to the simplest possible guess, &ldquo;next month equals
              this month&rdquo;, so you can see whether the model is actually earning its keep.
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
              For some of these the model barely beats that guess, and the table shows it.
              Source:{" "}
              <a href={prices.source.url} className="underline underline-offset-4" rel="noreferrer noopener" target="_blank">
                {prices.source.name}
              </a>{" "}
              ({prices.source.license}).
            </P>

            <h3 className="mt-8 text-[0.95rem] font-semibold">The formula-based parts</h3>
            <Table
              head={["Engine", "Method", "Why not learned"]}
              rows={[
                [
                  "Irrigation, lib/grow/irrigation.ts",
                  "FAO-56 soil-water balance; soil properties from Table 19, crop coefficients from Tables 12 and 22",
                  "An agronomist can check every step against the FAO paper. No training data would do better.",
                ],
                [
                  "Disease pressure, lib/grow/risk.ts",
                  "Trapezoidal fuzzy membership over leaf wetness, temperature, humidity and sunshine, with wetness and temperature as gates rather than weights",
                  "It uses this plot's own weather, so it doesn't have the classifier's problem with unfamiliar photos. The rules stay readable because they're what an agronomist will question.",
                ],
                [
                  "HS code, lib/compliance/hs.ts",
                  "Token-overlap baseline over a curated product catalogue",
                  "It's a simple word match, labelled as one. A smarter classifier can replace it later.",
                ],
              ]}
            />

            <Callout>
              <strong>Why the photo and the weather aren&apos;t combined into one score.</strong> One
              is a probability over six diseases, the other is a 0 to 1 weather index, and averaging
              them gives a number that means nothing. It would also hide the most useful case: when the
              photo says one thing and the weather says another. The app shows both and suggests a
              closer look. The weather can never change what the photo result says.
            </Callout>
          </Part>

          {/* ============ 09 REPRODUCE ============ */}
          <Part id="reproduce" n="09" title="Running it yourself">
            <P>
              The images aren&apos;t in the repo; they&apos;re about a gigabyte. Download each dataset
              from the DOI in the provenance record. CS-D&apos;s archive is checked against a SHA-256
              in the manifest before anything uses it.
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
              Which split a photo lands in is worked out from a hash of the original photo it came
              from (<Code>{card.training.split_rule}</Code>), so every machine gets the same split and
              there&apos;s no split file to lose. The random seed is fixed too. <Code>smoke_infer.py</Code> tests the
              published model file, not the training checkpoint. That&apos;s how we caught an export that
              had quietly left its weights in a separate file.
            </P>
          </Part>
        </div>
      </div>
    </main>
  );
}

// --- presentational helpers ----------------------------------------------

function roleOf(id: string): string {
  if (id === "cs_d") return "Training, validation and Test 1";
  if (id === "ewu_tea_leaf_disease") return "Test 2. Leaves on paper, never used in training.";
  if (id === "tld_bd") return "Test 3. Leaves on paper, from Bangladesh, never used in training.";
  return "Looked at and not used. provenance.json says why.";
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
