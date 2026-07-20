/**
 * Capture-method confidence mapping. Run:
 *   node --experimental-strip-types test/confidence.test.ts
 */
import assert from "node:assert/strict";
import { captureConfidence } from "../lib/intake/confidence.ts";

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

test("traced is high confidence (no GPS error)", () => {
  assert.equal(captureConfidence("traced").level, "high");
});

test("imported is low confidence (not field-verified)", () => {
  assert.equal(captureConfidence("imported").level, "low");
});

test("traced ranks above walked", () => {
  const order = { high: 3, medium: 2, low: 1 } as const;
  assert.ok(
    order[captureConfidence("traced").level] > order[captureConfidence("walked").level],
  );
});

test("every method has a non-empty rationale for the PDF", () => {
  for (const m of ["imported", "traced", "corners", "walked"] as const) {
    assert.ok(captureConfidence(m).rationale.length > 10);
  }
});

console.log(`\n${passed} passed`);
