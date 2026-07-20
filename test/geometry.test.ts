/**
 * Node test for the plot save-gate rules. Run:
 *   node --experimental-strip-types test/geometry.test.ts
 * No test framework — keeps the toolchain boring.
 */
import assert from "node:assert/strict";
import {
  validatePlot,
  findOverlaps,
  computeAreaHa,
} from "../lib/intake/geometry.ts";
import type { LngLat } from "../lib/intake/types.ts";

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

// ~110 m square near central Sri Lanka (lng, lat). ~1.22 ha.
const squareA: LngLat[] = [
  [80.0, 7.0],
  [80.001, 7.0],
  [80.001, 7.001],
  [80.0, 7.001],
];
// Same 4 corners, scrambled order (as a farmer might tap them).
const scrambled: LngLat[] = [
  [80.0, 7.0],
  [80.001, 7.001],
  [80.001, 7.0],
  [80.0, 7.001],
];

test("computes a plausible equal-area figure for a ~110 m square", () => {
  const ha = computeAreaHa(squareA);
  assert.ok(ha > 1.0 && ha < 1.45, `area ${ha} ha out of expected range`);
});

test("valid square in tap order can save", () => {
  const v = validatePlot(squareA, { method: "traced" });
  assert.equal(v.canSave, true);
  assert.equal(v.errors.length, 0);
});

test("auto-orders scrambled corners for corner-capture", () => {
  const v = validatePlot(scrambled, { method: "corners" });
  assert.equal(v.canSave, true, "auto-ordered corners should form a simple polygon");
});

test("rejects the same scrambled points when traced (self-intersecting)", () => {
  const v = validatePlot(scrambled, { method: "traced" });
  assert.equal(v.canSave, false);
  assert.ok(v.errors.some((e) => e.code === "self_intersecting"));
});

test("warns when drawn area diverges from claimed", () => {
  const v = validatePlot(squareA, { method: "traced", claimedAreaHa: 5 });
  assert.ok(v.warnings.some((w) => w.code === "area_mismatch"));
});

test("no area warning when claim is close", () => {
  const v = validatePlot(squareA, { method: "traced", claimedAreaHa: 1.2 });
  assert.ok(!v.warnings.some((w) => w.code === "area_mismatch"));
});

test("detects an overlapping plot but not a merely-adjacent one", () => {
  const overlapping: LngLat[] = [
    [80.0005, 7.0005],
    [80.0015, 7.0005],
    [80.0015, 7.0015],
    [80.0005, 7.0015],
  ];
  const adjacent: LngLat[] = [
    [80.001, 7.0], // shares the eastern edge of squareA
    [80.002, 7.0],
    [80.002, 7.001],
    [80.001, 7.001],
  ];
  assert.deepEqual(findOverlaps(squareA, [{ id: "over", ring: overlapping }]), ["over"]);
  assert.deepEqual(findOverlaps(squareA, [{ id: "adj", ring: adjacent }]), []);
});

console.log(`\n${passed} passed`);
