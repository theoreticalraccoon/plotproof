/**
 * Export-document arithmetic. Run:
 *   node --experimental-strip-types test/documents.test.ts
 */
import assert from "node:assert/strict";
import {
  computePackingTotals,
  suggestNetPerPackage,
  lineAmount,
  docNumber,
} from "../lib/compliance/documents.ts";

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

// --- packing totals ---
test("straightforward packing totals", () => {
  const t = computePackingTotals({ packages: 40, netKgPerPackage: 25, grossKgPerPackage: 26 });
  assert.deepEqual(t, { packages: 40, totalNetKg: 1000, totalGrossKg: 1040 });
});
test("gross is clamped up to net when entered smaller (never lighter than net)", () => {
  const t = computePackingTotals({ packages: 10, netKgPerPackage: 25, grossKgPerPackage: 20 });
  assert.equal(t.totalNetKg, 250);
  assert.equal(t.totalGrossKg, 250);
});
test("fractional package counts are floored; negatives clamp to zero", () => {
  assert.equal(computePackingTotals({ packages: 40.9, netKgPerPackage: 25, grossKgPerPackage: 26 }).packages, 40);
  const z = computePackingTotals({ packages: -3, netKgPerPackage: -5, grossKgPerPackage: -1 });
  assert.deepEqual(z, { packages: 0, totalNetKg: 0, totalGrossKg: 0 });
});

// --- suggested split ---
test("suggested net per package splits the total evenly", () => {
  assert.equal(suggestNetPerPackage(1000, 40), 25);
});
test("suggested net per package is safe when packages is zero", () => {
  assert.equal(suggestNetPerPackage(1000, 0), 0);
});

// --- invoice line amount ---
test("line amount multiplies and rounds cleanly", () => {
  assert.equal(lineAmount(2000, 4.25), 8500);
  assert.equal(lineAmount(3, 0.1), 0.3); // no float noise
});

// --- document number ---
test("document number carries the prefix and last 8 digits", () => {
  assert.equal(docNumber("INV", 1_700_000_012_345), "INV-00012345");
  assert.ok(docNumber("PL").startsWith("PL-"));
});

console.log(`\n${passed} passed`);
