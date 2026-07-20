/**
 * Direct-export compliance domain. The pivot: the farmer is the user, and the
 * product is "get my harvest legally into EU/UK/US markets so I can sell direct
 * and keep the margin." This models the documents/certifications a B2B export
 * needs, resolved from simple farmer inputs.
 *
 * Design rule (like the EUDR caveats): the app NEVER invents law. Requirements
 * come from a curated, sourced catalog; every item cites its basis and says to
 * verify with the issuing authority. AI classifies/explains/translates — it does
 * not decide legal requirements.
 */

export type Market = "EU" | "UK" | "US";

export type Perishability = "perishable" | "semi_perishable" | "durable";

export interface Product {
  id: string;
  name: string;
  synonyms: string[]; // for the HS-code classifier
  category: string; // coffee, tea, rubber, cocoa, spice, coconut…
  hsCode: string; // 6-digit HS heading
  perishability: Perishability;
  /** Covered by EU Deforestation Regulation Annex I? (drives the EUDR doc.) */
  eudrCovered: boolean;
  /** Does a phytosanitary certificate typically apply? (verify per consignment) */
  phytoTypical: boolean;
}

/** Who produces a document. */
export type IssuerType = "self" | "authority" | "platform";

export type DocStatus = "not_started" | "in_progress" | "ready";

/** The inputs a requirement decision is made from. */
export interface DocContext {
  product: Product;
  originCountry: string; // ISO-3166 alpha-2
  destination: Market;
  organicClaim: boolean;
}

export interface DocumentType {
  id: string;
  name: string;
  issuer: IssuerType;
  /** Plain-language, for a first-time / low-literacy farmer. */
  what: string;
  why: string;
  howToObtain: string;
  source: string; // legal/authority citation
  /** Where in the app the farmer produces or starts it, if self/platform. */
  actionHref?: string;
  /** Predicate: does this document apply to the given context? */
  applies: (ctx: DocContext) => boolean;
}

export interface RequiredDocument {
  documentTypeId: string;
  name: string;
  issuer: IssuerType;
  what: string;
  why: string;
  howToObtain: string;
  source: string;
  actionHref?: string;
  status: DocStatus;
}

export interface RequirementResult {
  context: {
    productId: string;
    originCountry: string;
    destination: Market;
    organicClaim: boolean;
  };
  documents: RequiredDocument[];
  summary: { total: number; selfServe: number; authority: number };
}

export interface HsCandidate {
  hsCode: string;
  productId: string;
  name: string;
  score: number; // 0..1 match confidence
}

export type ShipMode = "sea_fcl" | "sea_lcl" | "air" | "courier";

export interface ShippingOption {
  mode: ShipMode;
  label: string;
  rationale: string;
  incoterm: string; // suggested Incoterm + plain note
  transit: string; // estimate
  notes: string;
}

export interface SaleIntent {
  productId: string;
  originCountry: string;
  destination: Market;
  quantityKg: number;
  organicClaim: boolean;
  createdAt: string;
}
