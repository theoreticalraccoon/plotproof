/**
 * Haversine distance for acoustic exhibit placement. Run:
 *   node --experimental-strip-types test/acoustic.test.ts
 * (buildExhibit is verified end-to-end via the /api/acoustic/exhibit endpoint.)
 */
import assert from "node:assert/strict";
import { haversineKm } from "../lib/acoustic/geo.ts";

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

function approx(actual: number, expected: number, tol: number) {
  assert.ok(Math.abs(actual - expected) <= tol, `${actual} not within ${tol} of ${expected}`);
}

test("zero distance", () => {
  assert.equal(haversineKm({ lng: 80.3, lat: 6.75 }, { lng: 80.3, lat: 6.75 }), 0);
});
test("one degree of latitude ≈ 111.2 km", () => {
  approx(haversineKm({ lng: 0, lat: 0 }, { lng: 0, lat: 1 }), 111.19, 0.5);
});
test("one degree of longitude at equator ≈ 111.3 km", () => {
  approx(haversineKm({ lng: 0, lat: 0 }, { lng: 1, lat: 0 }), 111.32, 0.5);
});
test("symmetric", () => {
  const a = { lng: 80.3, lat: 6.75 };
  const b = { lng: 101.4, lat: -0.5 };
  approx(haversineKm(a, b), haversineKm(b, a), 1e-9);
});
test("a ~150 m hop is well under 1 km", () => {
  approx(haversineKm({ lng: 80.3, lat: 6.75 }, { lng: 80.3013, lat: 6.7513 }), 0.2, 0.1);
});

console.log(`\n${passed} passed`);
