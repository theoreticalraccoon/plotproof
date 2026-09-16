/**
 * Tea taxonomy contract. Run:
 *   node --experimental-strip-types test/teaClasses.test.ts
 *
 * The taxonomy exists in two places — models/tea/taxonomy.json (source of
 * truth, carries the evidence for every merge) and lib/grow/teaClasses.ts (what
 * the app imports). Two copies drift. These tests are what stops them, and what
 * stops a class ID being renumbered after a model has shipped emitting it.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  TEA_CLASSES,
  ACTIVE_CLASSES,
  ACTIVE_CLASS_IDS,
  TAXONOMY_VERSION,
  teaClassById,
  teaClassByKey,
  teaClassFromSourceLabel,
  hasEnvironmentalPrior,
} from "../lib/grow/teaClasses.ts";

const json = JSON.parse(readFileSync(new URL("../models/tea/taxonomy.json", import.meta.url), "utf8"));

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

// --- the two copies must agree ---
test("taxonomy version matches the JSON source of truth", () => {
  assert.equal(TAXONOMY_VERSION, json.taxonomy_version);
});

test("every class in the JSON exists in TS with the same id, key and active flag", () => {
  assert.equal(TEA_CLASSES.length, json.classes.length);
  for (const jc of json.classes) {
    const tc = teaClassById(jc.classId);
    assert.ok(tc, `classId ${jc.classId} (${jc.key}) missing from teaClasses.ts`);
    assert.equal(tc.key, jc.key, `key mismatch for classId ${jc.classId}`);
    assert.equal(tc.active, jc.active, `active mismatch for ${jc.key}`);
    assert.equal(tc.displayName, jc.displayName, `displayName mismatch for ${jc.key}`);
  }
});

test("the active class vector matches the JSON, in order", () => {
  assert.deepEqual([...ACTIVE_CLASS_IDS], json.active_class_ids);
});

test("riskEngineKey agrees between JSON and TS", () => {
  for (const jc of json.classes) {
    const tc = teaClassById(jc.classId)!;
    assert.equal(tc.riskEngineKey, jc.riskEngineKey ?? null, `riskEngineKey mismatch for ${jc.key}`);
  }
});

// --- structural invariants ---
test("class ids are unique and contiguous from zero", () => {
  const ids = TEA_CLASSES.map((c) => c.classId);
  assert.equal(new Set(ids).size, ids.length, "duplicate classId");
  assert.deepEqual(ids, [...ids].sort((a, b) => a - b), "classIds must be declared in ascending order");
  assert.deepEqual(ids, ids.map((_, i) => i), "classIds must be contiguous from 0");
});

test("class keys are unique", () => {
  const keys = TEA_CLASSES.map((c) => c.key);
  assert.equal(new Set(keys).size, keys.length);
});

test("no source label is claimed by two different classes", () => {
  // The dangerous collision: one dataset folder that could map to two classes.
  // teaClassFromSourceLabel would silently return whichever is declared first.
  const norm = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, " ").trim();
  const seen = new Map<string, string>();
  for (const c of TEA_CLASSES) {
    for (const l of c.sourceLabels) {
      const n = norm(l);
      const prev = seen.get(n);
      assert.ok(
        prev === undefined || prev === c.key,
        `source label "${l}" is claimed by both ${prev} and ${c.key}`,
      );
      seen.set(n, c.key);
    }
  }
});

// --- the v1 model contract ---
test("v1 actives are exactly the six CS-D classes", () => {
  assert.deepEqual(
    ACTIVE_CLASSES.map((c) => c.key),
    ["healthy", "blister_blight", "brown_blight", "red_rust", "red_spider_mite", "helopeltis"],
  );
});

test("blister blight is active but explicitly not cross-dataset testable", () => {
  const b = teaClassByKey("blister_blight")!;
  assert.equal(b.active, true);
  assert.equal(
    b.crossDatasetTestable,
    false,
    "CS-D is the only dataset containing blister blight; claiming otherwise would license a validation we cannot run",
  );
});

// --- the pest/pathogen boundary, which fusion depends on ---
test("no pest carries an environmental infection prior", () => {
  for (const c of TEA_CLASSES.filter((c) => c.kind === "pest")) {
    assert.equal(
      hasEnvironmentalPrior(c),
      false,
      `${c.key} is a pest and must not be weighted by a fungal infection window`,
    );
  }
});

test("healthy carries no infection prior either", () => {
  assert.equal(hasEnvironmentalPrior(teaClassByKey("healthy")!), false);
});

test("only the risk engine's three pathogens carry a prior", () => {
  const withPrior = TEA_CLASSES.filter(hasEnvironmentalPrior).map((c) => c.riskEngineKey).sort();
  assert.deepEqual(withPrior, ["blister_blight", "brown_blight", "grey_blight"]);
});

test("the ambiguous algal trio stays unmerged", () => {
  // Merging these on literature alone, against two annotation teams who split
  // them, would be unrecoverable once a model is trained on the merge.
  for (const k of ["red_rust", "algal_leaf_spot", "red_leaf_spot"] as const) {
    assert.ok(teaClassByKey(k), `${k} must remain its own class`);
  }
  const ids = new Set(["red_rust", "algal_leaf_spot", "red_leaf_spot"].map((k) => teaClassByKey(k as never)!.classId));
  assert.equal(ids.size, 3, "the three must have distinct class ids");
});

// --- the dataset-label bridge ---
test("dataset folder names map to canonical classes across spellings", () => {
  assert.equal(teaClassFromSourceLabel("Tea_Mosquito_Bug")!.key, "helopeltis");
  assert.equal(teaClassFromSourceLabel("Helopeltis")!.key, "helopeltis");
  assert.equal(teaClassFromSourceLabel("Gray Blight")!.key, "grey_blight");
  assert.equal(teaClassFromSourceLabel("Grey Blight")!.key, "grey_blight");
  assert.equal(teaClassFromSourceLabel("brown blight")!.key, "brown_blight");
  assert.equal(teaClassFromSourceLabel("Healthy_leaves")!.key, "healthy");
});

test("an unknown folder name returns undefined rather than guessing", () => {
  assert.equal(teaClassFromSourceLabel("Some New Disease"), undefined);
});

test("rejection is not a class in the vector", () => {
  assert.equal(json.rejection.isClass, false);
  assert.ok(!TEA_CLASSES.some((c) => String(c.key).includes("not_a")));
});

console.log(`\n${passed} passed`);
