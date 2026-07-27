/**
 * Curated, sourced catalog: products (with HS codes), destination markets, and
 * the document/certification registry with applicability predicates. This is the
 * "requirements as data" core, adding a product, market, or document is data,
 * never a code change (the same principle as country profiles).
 *
 * Type-only imports so this module stays Node-loadable for tests.
 */
import type { DocumentType, Market, Product } from "./types";

/**
 * When the requirements data below was last checked against its sources.
 * Rendered on the checklist with a stale warning past 6 months — a legal
 * checklist that silently rots is worse than none.
 */
export const CATALOG_VERIFIED_AT = "2026-07-27";

export const PRODUCTS: Product[] = [
  { id: "coffee_green", name: "Green coffee beans", synonyms: ["coffee", "arabica", "robusta", "green coffee", "coffee beans"], category: "coffee", hsCode: "0901.11", perishability: "durable", eudrCovered: true, phytoTypical: true },
  { id: "black_tea", name: "Black tea", synonyms: ["tea", "ceylon tea", "black tea", "orthodox tea"], category: "tea", hsCode: "0902.30", perishability: "durable", eudrCovered: false, phytoTypical: false },
  { id: "natural_rubber", name: "Natural rubber (sheets)", synonyms: ["rubber", "natural rubber", "latex", "rss", "crepe rubber"], category: "rubber", hsCode: "4001.22", perishability: "durable", eudrCovered: true, phytoTypical: false },
  { id: "cocoa_beans", name: "Cocoa beans", synonyms: ["cocoa", "cacao", "cocoa beans"], category: "cocoa", hsCode: "1801.00", perishability: "durable", eudrCovered: true, phytoTypical: true },
  { id: "cinnamon", name: "Cinnamon", synonyms: ["cinnamon", "ceylon cinnamon", "cassia"], category: "spice", hsCode: "0906.11", perishability: "durable", eudrCovered: false, phytoTypical: true },
  { id: "black_pepper", name: "Black pepper", synonyms: ["pepper", "black pepper", "peppercorn"], category: "spice", hsCode: "0904.11", perishability: "durable", eudrCovered: false, phytoTypical: true },
  { id: "cardamom", name: "Cardamom", synonyms: ["cardamom", "elaichi", "green cardamom"], category: "spice", hsCode: "0908.31", perishability: "durable", eudrCovered: false, phytoTypical: true },
  { id: "desiccated_coconut", name: "Desiccated coconut", synonyms: ["coconut", "desiccated coconut", "coconut flakes"], category: "coconut", hsCode: "0801.11", perishability: "durable", eudrCovered: false, phytoTypical: false },
];

export function getProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}

export interface MarketMeta {
  code: Market;
  name: string;
  authority: string;
  note: string;
}

export const MARKETS: MarketMeta[] = [
  { code: "EU", name: "European Union", authority: "EU customs + national plant/health authorities", note: "EUDR applies to coffee, cocoa, rubber, palm, soy, cattle, wood." },
  { code: "UK", name: "United Kingdom", authority: "HMRC + APHA (plant health)", note: "Post-Brexit UK rules mirror much of the EU but are separate." },
  { code: "US", name: "United States", authority: "US CBP + FDA + USDA APHIS", note: "FDA food rules (prior notice, FSVP) apply to most foods." },
];

/**
 * The document registry. `applies` decides inclusion for a given context.
 * Ordered roughly by the sequence a farmer works through them.
 */
export const DOCUMENT_TYPES: DocumentType[] = [
  {
    id: "hs_classification",
    name: "HS commodity code",
    issuer: "platform",
    what: "The international product code customs uses to identify your goods.",
    why: "Every customs form and duty calculation starts from this code. Getting it wrong causes delays.",
    howToObtain: "We suggest it from your product; confirm with your customs broker.",
    source: "WCO Harmonized System",
    actionHref: "/sell",
    applies: () => true,
  },
  {
    id: "commercial_invoice",
    name: "Commercial invoice",
    issuer: "self",
    what: "The bill to your buyer: what you sold, how much, and the price.",
    why: "Customs in every country uses it to value the shipment. Required everywhere.",
    howToObtain: "Generate it here from your sale details.",
    source: "Standard international trade document",
    actionHref: "/documents/invoice",
    applies: () => true,
  },
  {
    id: "packing_list",
    name: "Packing list",
    issuer: "self",
    what: "A list of what's in each box or bag, weights and counts.",
    why: "Customs and the buyer use it to check the shipment matches the invoice.",
    howToObtain: "Generate it here from your packing details.",
    source: "Standard international trade document",
    actionHref: "/documents/packing-list",
    applies: () => true,
  },
  {
    id: "certificate_of_origin",
    name: "Certificate of origin",
    issuer: "authority",
    what: "An official paper proving your goods were produced in your country.",
    why: "It can lower or remove import duty for the buyer and is often required.",
    howToObtain: "Prepare a draft here, then have your Chamber of Commerce certify it.",
    source: "Chamber of Commerce / national trade authority",
    actionHref: "/documents/certificate-of-origin",
    applies: () => true,
  },
  {
    id: "phytosanitary_certificate",
    name: "Phytosanitary certificate",
    issuer: "authority",
    what: "A plant-health certificate saying your produce is pest- and disease-free.",
    why: "Required for most raw plant products entering the EU, UK, and US.",
    howToObtain: "Apply to your national plant protection organisation before shipping.",
    source: "IPPC / destination plant-health rules",
    applies: (ctx) => ctx.product.phytoTypical,
  },
  {
    id: "eudr_dds",
    name: "EUDR deforestation evidence",
    issuer: "platform",
    what: "Proof, with satellite evidence, that your plot wasn't deforested after 31 Dec 2020.",
    why: "The EU bars coffee, cocoa, rubber and others unless this is provided.",
    howToObtain: "Map your plot in the app; we generate the evidence pack.",
    source: "EU Regulation 2023/1115 (EUDR)",
    actionHref: "/intake",
    applies: (ctx) => ctx.destination === "EU" && ctx.product.eudrCovered,
  },
  {
    id: "us_food_import",
    name: "US FDA prior notice",
    issuer: "authority",
    what: "An advance notice to the US FDA that a food shipment is arriving.",
    why: "US law requires it for imported food; your US buyer also needs an FSVP.",
    howToObtain: "File prior notice via the FDA system before the goods arrive; coordinate with your US buyer.",
    source: "US FDA FSMA (Prior Notice, FSVP)",
    applies: (ctx) => ctx.destination === "US",
  },
  {
    id: "organic_certificate",
    name: "Organic certificate",
    issuer: "authority",
    what: "Proof your produce meets the destination's organic standard.",
    why: "Needed only if you sell and label the goods as organic, it commands a higher price.",
    howToObtain: "Get certified by an accredited body recognised by the destination market.",
    source: "EU/UK/US organic equivalence rules",
    applies: (ctx) => ctx.organicClaim,
  },
];
