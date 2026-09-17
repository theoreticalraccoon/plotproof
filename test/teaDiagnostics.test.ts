/**
 * The ?diag=1 diagnostics surface. Run:
 *   node --experimental-strip-types test/teaDiagnostics.test.ts
 *
 * These tests exist because the diagnostics panel is the instrument the
 * real-device browser gate is measured with, and an instrument that lies is
 * worse than no instrument. So they check the two properties that make it
 * trustworthy:
 *
 *   1. It is OFF unless explicitly asked for.
 *   2. It reports the PUBLISHED card's values, and fails loudly when the
 *      runtime disagrees with them — rather than restating constants that
 *      would agree with anything.
 *
 * They also pin the class-ordering guard in `card.ts`, which is the one card
 * defect that is invisible downstream: a reordered taxonomy renames every
 * diagnosis while every other check still passes.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildDiagnosticRows,
  diagnosticsEnabled,
  type ArtifactCheck,
  type RuntimeFacts,
} from "../lib/grow/tea/diagnostics.ts";
import { __isUsableCardForTests } from "../lib/grow/tea/card.ts";
import { decide } from "../lib/grow/tea/predict.ts";
import type { TeaModelCard, TeaPrediction } from "../lib/grow/tea/types.ts";

const card = JSON.parse(
  readFileSync(new URL("../public/models/tea-disease-mnv3s-card.json", import.meta.url), "utf8"),
) as TeaModelCard;

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FAIL  ${name}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

const KEYS = card.taxonomy.classes.map((c) => c.key);
const SIZE = card.preprocessing.image_size;
const N = card.taxonomy.classes.length;

function logitsFor(key: string, margin: number): number[] {
  return KEYS.map((k) => (k === key ? margin : 0));
}

function goodRuntime(over: Partial<RuntimeFacts> = {}): RuntimeFacts {
  return {
    backend: "wasm (numThreads=1)",
    build: "onnxruntime-web/wasm",
    inputName: "input",
    inputShape: [1, 3, SIZE, SIZE],
    outputName: "logits",
    outputShape: [1, N],
    sessionInitMs: 1800,
    inferenceMs: 90,
    totalMs: 1950,
    ...over,
  };
}

const goodArtifact: ArtifactCheck = {
  bytes: card.model.bytes,
  sha256: card.model.sha256,
  matches: true,
};

function row(rows: ReturnType<typeof buildDiagnosticRows>, label: string) {
  const r = rows.find((x) => x.label === label);
  assert.ok(r, `expected a "${label}" row`);
  return r;
}
function failures(rows: ReturnType<typeof buildDiagnosticRows>) {
  return rows.filter((r) => r.ok === false);
}

// ===================== the gate: off by default ==========================

test("diagnostics are off unless ?diag=1 is asked for", () => {
  assert.equal(diagnosticsEnabled(""), false);
  assert.equal(diagnosticsEnabled("?lang=si"), false);
  assert.equal(diagnosticsEnabled("?diag=0"), false);
  assert.equal(diagnosticsEnabled("?diag=true"), false);
  assert.equal(diagnosticsEnabled("?diag"), false);
  assert.equal(diagnosticsEnabled("?diag=1"), true);
  assert.equal(diagnosticsEnabled("?lang=ta&diag=1"), true);
});

// ===================== healthy path ======================================

test("a healthy run reports the published model and no failures", () => {
  const prediction = decide(logitsFor("brown_blight", 40), card);
  assert.equal(prediction.state, "confident");
  const rows = buildDiagnosticRows(card, prediction, goodRuntime(), goodArtifact);

  assert.deepEqual(failures(rows), []);
  assert.equal(row(rows, "Card loaded").value, "yes");
  assert.ok(row(rows, "Model").value.includes(card.model.version));
  assert.equal(row(rows, "Card sha256").value, card.model.sha256);
  assert.equal(row(rows, "Served sha256").ok, true);
  assert.equal(row(rows, "Runtime backend").value, "wasm (numThreads=1)");
  assert.equal(row(rows, "Abstention threshold").value, String(card.abstention.threshold));
  assert.equal(row(rows, "Temperature").value, String(card.calibration.temperature));
  assert.equal(row(rows, "State").value, "confident");
  assert.equal(row(rows, "Abstention decision").ok, true);
  assert.equal(row(rows, "Model version shown").ok, true);
});

test("diagnostics restate no model constant of their own", () => {
  // Every model number shown must be traceable to the loaded card. Proven by
  // mutating the card and requiring the panel to move with it: a hard-coded
  // 160 or 0.9976 would keep showing the published value here.
  const shifted: TeaModelCard = {
    ...card,
    model: { ...card.model, version: "9.9.9" },
    preprocessing: { ...card.preprocessing, image_size: SIZE + 8 },
    calibration: { ...card.calibration, temperature: 1.234 },
    abstention: { ...card.abstention, threshold: 0.5 },
  };
  const rows = buildDiagnosticRows(shifted, null, goodRuntime(), goodArtifact);
  assert.ok(row(rows, "Model").value.includes("9.9.9"));
  assert.equal(row(rows, "Temperature").value, "1.234");
  assert.equal(row(rows, "Abstention threshold").value, "0.5");
  assert.ok(row(rows, "Preprocessing").value.includes(String(SIZE + 8)));
  // And the runtime that matched the REAL card must now be flagged against the
  // shifted one, which is the whole purpose of the check.
  assert.equal(row(rows, "Input tensor").ok, false);
});

// ===================== the failures it must catch =========================

test("a tensor shape that disagrees with the card fails", () => {
  const p = decide(logitsFor("healthy", 40), card);
  // NHWC instead of NCHW — silently produces a plausible wrong answer.
  const nhwc = buildDiagnosticRows(card, p, goodRuntime({ inputShape: [1, SIZE, SIZE, 3] }), null);
  assert.equal(row(nhwc, "Input tensor").ok, false);

  // A head with the wrong class count means the class mapping is wrong.
  const wrongHead = buildDiagnosticRows(card, p, goodRuntime({ outputShape: [1, N + 1] }), null);
  assert.equal(row(wrongHead, "Output tensor").ok, false);
});

test("bytes or hash differing from the card fails", () => {
  const p = decide(logitsFor("healthy", 40), card);
  const stale = buildDiagnosticRows(card, p, goodRuntime(), {
    bytes: card.model.bytes - 1,
    sha256: "0".repeat(64),
    matches: false,
  });
  assert.equal(row(stale, "Served bytes").ok, false);
  assert.equal(row(stale, "Served sha256").ok, false);
});

test("an absent card reports the load failure, not a blank panel", () => {
  const rows = buildDiagnosticRows(
    null,
    { state: "error", reason: "no_artifact" } as TeaPrediction,
    null,
    null,
  );
  assert.equal(row(rows, "Card loaded").ok, false);
  assert.ok(row(rows, "Load failure").value.includes("no_artifact"));
});

test("a runtime failure is reported as error, never as uncertain", () => {
  const rows = buildDiagnosticRows(
    card,
    { state: "error", reason: "load_failed", detail: "fetch failed" } as TeaPrediction,
    null,
    goodArtifact,
  );
  assert.equal(row(rows, "State").value, "error");
  assert.ok(row(rows, "Failure reason").value.includes("load_failed"));
  assert.equal(row(rows, "Runtime").ok, false);
  assert.equal(rows.some((r) => r.label === "Predicted class"), false);
});

// ===================== abstention, as the panel sees it ===================

test("an abstained run shows the decision and withholds the class", () => {
  // A margin small enough to land under the published threshold.
  const p = decide(logitsFor("red_rust", 0.3), card);
  assert.equal(p.state, "uncertain");
  const rows = buildDiagnosticRows(card, p, goodRuntime(), goodArtifact);

  assert.deepEqual(failures(rows), []);
  assert.ok(row(rows, "Abstention decision").value.startsWith("abstained"));
  assert.equal(row(rows, "Threshold used").ok, true);
  assert.ok(row(rows, "Class withheld").value.startsWith("yes"));
  // The panel names the leaning class for the tester; the ADVISORY still must
  // not. Nothing here is rendered by LeafAssessment.
  assert.equal(rows.some((r) => r.label === "Predicted class"), false);
});

// ===================== the card guard the panel relies on =================

test("a card whose classes are out of output order is refused", () => {
  assert.equal(__isUsableCardForTests(card), true);

  const reordered = {
    ...card,
    taxonomy: { ...card.taxonomy, classes: [...card.taxonomy.classes].reverse() },
  };
  // Parses, has six classes, valid threshold and temperature — and would rename
  // every diagnosis. Must be rejected.
  assert.equal(__isUsableCardForTests(reordered), false);

  const gap = {
    ...card,
    taxonomy: {
      ...card.taxonomy,
      classes: card.taxonomy.classes.map((c, i) => (i === 2 ? { ...c, outputIndex: 5 } : c)),
    },
  };
  assert.equal(__isUsableCardForTests(gap), false);
});

test("the published card still satisfies every gate the app applies", () => {
  assert.equal(__isUsableCardForTests(card), true);
  assert.ok(card.abstention.threshold > 1 / N, "threshold must beat chance");
  assert.ok(card.abstention.threshold <= 1);
  card.taxonomy.classes.forEach((c, i) => assert.equal(c.outputIndex, i));
});

console.log(`\n${passed} passed`);
