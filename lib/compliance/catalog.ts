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
export const CATALOG_VERIFIED_AT = "2026-09-18";

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
    what: "Official proof that the goods were produced in Sri Lanka.",
    why: "Customs at the destination may require it, and preferential origin can reduce or remove the buyer's import duty.",
    howToObtain:
      "Prepare the draft here. Non-preferential certificates are issued by the Department of Commerce and by recognised chambers such as the National Chamber of Exporters. For EU GSP+ duty preference, an exporter registered in the EU REX system instead makes out a statement on origin on the commercial documents for each consignment — enter the REX number in the sale and the invoice carries it. Confirm which applies with the Department of Commerce.",
    source: "Department of Commerce, Sri Lanka — doc.gov.lk (Certificates of Origin; REX system)",
    actionHref: "/documents/certificate-of-origin",
    applies: () => true,
  },
  {
    id: "phytosanitary_certificate",
    name: "Phytosanitary certificate",
    issuer: "authority",
    what: "A plant-health certificate stating the consignment meets the importing country's pest requirements.",
    why: "Required for most raw plant products entering the EU, UK and US.",
    howToObtain:
      "Issued by the National Plant Quarantine Service (NPQS), Department of Agriculture — Sri Lanka's national plant protection organisation. The exporter registers with NPQS first, then requests a certificate for each consignment before the shipping date.",
    source: "National Plant Quarantine Service, Department of Agriculture — doa.gov.lk (NPQS export services); IPPC",
    applies: (ctx) => ctx.product.phytoTypical,
  },
  {
    id: "eudr_dds",
    name: "EUDR deforestation evidence",
    issuer: "platform",
    what: "Proof, with satellite evidence, that your plot wasn't deforested after 31 Dec 2020.",
    why: "The EU bars coffee, cocoa, rubber and others unless this is provided.",
    howToObtain:
      "Attach the plots this consignment was grown on in the sale's EUDR section. Each plot is checked against the JRC Global Forest Cover 2020 map and Hansen tree-cover loss after 2020. The EU operator then files the due-diligence statement.",
    source: "EU Regulation 2023/1115 (EUDR)",
    actionHref: "/sell#eudr",
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
  {
    id: "lk_cusdec",
    name: "Customs declaration (CusDec)",
    issuer: "authority",
    what: "The export declaration lodged with Sri Lanka Customs for every consignment.",
    why: "No goods leave Sri Lanka without it.",
    howToObtain:
      "Lodged in Sri Lanka Customs' ASYCUDA system by the exporter or a licensed customs house agent, after any required approvals such as the phytosanitary certificate. Export must take place within 30 days of the CusDec's registration date.",
    source: "Sri Lanka Customs — customs.gov.lk (Exporting goods)",
    applies: () => true,
  },
  {
    id: "lk_tea_board",
    name: "Sri Lanka Tea Board exporter registration",
    issuer: "authority",
    what: "Registration with the Sri Lanka Tea Board as a tea exporter.",
    why: "Tea may only be exported by a registered exporter. Registration lasts one year and must be renewed.",
    howToObtain:
      "Apply to the Tea Export Division of the Sri Lanka Tea Board. The Board's published criteria include a business registration, a registered warehouse, a qualified tea taster with a tasting facility, and minimum paid-up capital — check the current year's application guideline.",
    source: "Sri Lanka Tea Board — srilankateaboard.lk (Tea Export Division; exporter registration)",
    applies: (ctx) => ctx.product.category === "tea",
  },
];
