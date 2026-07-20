/**
 * Requirements resolver + HS classifier + shipping. Run:
 *   node --experimental-strip-types test/compliance.test.ts
 */
import assert from "node:assert/strict";
import { DOCUMENT_TYPES, PRODUCTS, getProduct } from "../lib/compliance/catalog.ts";
import { resolveRequirements } from "../lib/compliance/resolver.ts";
import { classify } from "../lib/compliance/hs.ts";
import { suggestShipping } from "../lib/compliance/shipping.ts";
import type { Market, Product } from "../lib/compliance/types.ts";

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

function reqs(productId: string, destination: Market, organicClaim = false) {
  const product = getProduct(productId)!;
  return resolveRequirements(
    { product, originCountry: "LK", destination, organicClaim },
    DOCUMENT_TYPES,
  );
}
const has = (r: ReturnType<typeof reqs>, id: string) =>
  r.documents.some((d) => d.documentTypeId === id);

// --- resolver: market/commodity rules ---
test("EU + coffee requires EUDR evidence and phytosanitary", () => {
  const r = reqs("coffee_green", "EU");
  assert.ok(has(r, "eudr_dds"));
  assert.ok(has(r, "phytosanitary_certificate"));
  assert.ok(!has(r, "us_food_import"));
});
test("EU + tea does NOT require EUDR (not an Annex I commodity)", () => {
  const r = reqs("black_tea", "EU");
  assert.ok(!has(r, "eudr_dds"));
  assert.ok(!has(r, "phytosanitary_certificate"));
});
test("US + coffee requires FDA prior notice, not EUDR", () => {
  const r = reqs("coffee_green", "US");
  assert.ok(has(r, "us_food_import"));
  assert.ok(!has(r, "eudr_dds"));
});
test("organic claim adds an organic certificate", () => {
  assert.ok(!has(reqs("coffee_green", "EU", false), "organic_certificate"));
  assert.ok(has(reqs("coffee_green", "EU", true), "organic_certificate"));
});
test("invoice + packing list + origin cert always apply", () => {
  const r = reqs("desiccated_coconut", "UK");
  for (const id of ["commercial_invoice", "packing_list", "certificate_of_origin"]) {
    assert.ok(has(r, id), `${id} should always apply`);
  }
});

// --- HS classifier ---
test("free text 'dried arabica coffee beans' → green coffee", () => {
  assert.equal(classify("dried arabica coffee beans", PRODUCTS)[0].productId, "coffee_green");
});
test("free text 'rubber sheets' → natural rubber", () => {
  assert.equal(classify("rubber sheets", PRODUCTS)[0].productId, "natural_rubber");
});
test("nonsense text → no confident candidate", () => {
  assert.equal(classify("zzzz qqqq", PRODUCTS).length, 0);
});

// --- shipping ---
test("perishable goods lead with air freight", () => {
  const flowers: Product = { id: "x", name: "Cut flowers", synonyms: [], category: "flower", hsCode: "0603.11", perishability: "perishable", eudrCovered: false, phytoTypical: true };
  assert.equal(suggestShipping(flowers, 100, "EU")[0].mode, "air");
});
test("durable high volume → full container; low volume → shared", () => {
  const coffee = getProduct("coffee_green")!;
  assert.equal(suggestShipping(coffee, 20000, "EU")[0].mode, "sea_fcl");
  assert.equal(suggestShipping(coffee, 500, "EU")[0].mode, "sea_lcl");
});

console.log(`\n${passed} passed`);
