/**
 * Per-document status: pure logic (key identity, progress, toggle). Run:
 *   node --experimental-strip-types test/status.test.ts
 */
import assert from "node:assert/strict";
import { cycleStatus, intentKey, progressSummary } from "../lib/compliance/status.ts";

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

const intent = { productId: "coffee_green", originCountry: "LK", destination: "EU" as const, organicClaim: false };

test("same sale -> same key; changed market or claim -> new checklist", () => {
  assert.equal(intentKey(intent), intentKey({ ...intent }));
  assert.notEqual(intentKey(intent), intentKey({ ...intent, destination: "UK" }));
  assert.notEqual(intentKey(intent), intentKey({ ...intent, organicClaim: true }));
});

test("progress counts only currently-required docs (stale entries ignored)", () => {
  const statuses = { commercial_invoice: "ready", old_doc: "ready", packing_list: "in_progress" } as const;
  const p = progressSummary(statuses, ["commercial_invoice", "packing_list", "eudr_dds"]);
  assert.deepEqual(p, { ready: 1, total: 3 });
});

test("empty statuses -> zero ready", () => {
  assert.deepEqual(progressSummary({}, ["a", "b"]), { ready: 0, total: 2 });
});

test("mark-done toggle cycles ready <-> in_progress", () => {
  assert.equal(cycleStatus(undefined), "ready");
  assert.equal(cycleStatus("not_started"), "ready");
  assert.equal(cycleStatus("ready"), "in_progress");
});

console.log(`\n${passed} passed`);
