/** Pure rules over a sale: defaults, derived totals, validation, and which requirements apply. */
import { DOCUMENT_TYPES, getProduct } from "../compliance/catalog.ts";
import { computePackingTotals, docNumber, lineAmount } from "../compliance/documents.ts";
import { resolveRequirements } from "../compliance/resolver.ts";
import type { Product, RequirementResult, ShipMode } from "../compliance/types";
import {
  ORIGIN_COUNTRY,
  PORTS_OF_LOADING,
  SEA_ONLY_INCOTERMS,
  INCOTERMS,
  type Incoterm,
  type Sale,
} from "./types.ts";

// --- creation ------------------------------------------------------------

/** A blank sale with every document number already assigned. */
export function newSale(now: Date, id: string): Sale {
  const at = now.getTime();
  const iso = now.toISOString();
  return {
    id,
    createdAt: iso,
    updatedAt: iso,
    exporter: { name: "", address: "", contact: "", rexNumber: "" },
    farmer: { name: "", nic: "", village: "" },
    buyer: { name: "", address: "", contact: "", country: "" },
    productId: "",
    productDescription: "",
    organic: false,
    destination: "EU",
    packages: 0,
    packageType: "Multiwall paper sacks",
    netKgPerPackage: 0,
    grossKgPerPackage: 0,
    marks: "",
    unitPricePerKg: 0,
    currency: "USD",
    incoterm: "FOB",
    paymentTerms: "",
    shipMode: "sea_fcl",
    portOfLoading: PORTS_OF_LOADING[0],
    portOfDischarge: "",
    vesselOrFlight: "",
    shipmentDate: "",
    plotIds: [],
    eudrChecks: {},
    numbers: {
      invoice: docNumber("INV", at),
      packingList: docNumber("PL", at),
      certificateOfOrigin: docNumber("COO", at),
    },
    authorityStatus: {},
  };
}

/** Fill in any field a stored sale is missing. */
export function normalizeSale(raw: Sale): Sale {
  const base = newSale(new Date(raw.createdAt || Date.now()), raw.id);
  return {
    ...base,
    ...raw,
    exporter: { ...base.exporter, ...raw.exporter },
    farmer: { ...base.farmer, ...raw.farmer },
    buyer: { ...base.buyer, ...raw.buyer },
    numbers: { ...base.numbers, ...raw.numbers },
    plotIds: Array.isArray(raw.plotIds) ? raw.plotIds : [],
    eudrChecks: raw.eudrChecks && typeof raw.eudrChecks === "object" ? raw.eudrChecks : {},
    authorityStatus: raw.authorityStatus && typeof raw.authorityStatus === "object" ? raw.authorityStatus : {},
  };
}

/** Start the next sale for the same exporter. */
export function nextSaleFrom(prev: Sale, now: Date, id: string): Sale {
  const fresh = newSale(now, id);
  return {
    ...fresh,
    exporter: { ...prev.exporter },
    farmer: { ...prev.farmer },
    productId: prev.productId,
    productDescription: prev.productDescription,
    organic: prev.organic,
    packageType: prev.packageType,
    portOfLoading: prev.portOfLoading,
    plotIds: [...prev.plotIds],
  };
}

// --- derived values --------------------------------------------------------

export interface SaleTotals {
  packages: number;
  netKg: number;
  grossKg: number;
  amount: number;
}

/** The quantities and value every document prints. */
export function saleTotals(sale: Sale): SaleTotals {
  const p = computePackingTotals({
    packages: sale.packages,
    netKgPerPackage: sale.netKgPerPackage,
    grossKgPerPackage: sale.grossKgPerPackage,
  });
  return {
    packages: p.packages,
    netKg: p.totalNetKg,
    grossKg: p.totalGrossKg,
    amount: lineAmount(p.totalNetKg, sale.unitPricePerKg),
  };
}

export function saleProduct(sale: Sale): Product | undefined {
  return sale.productId ? getProduct(sale.productId) : undefined;
}

/** A short name for the sale list: "Black tea → Hamburg Tea GmbH". */
export function saleTitle(sale: Sale): string {
  const product = saleProduct(sale)?.name ?? "New sale";
  const buyer = sale.buyer.name.trim();
  return buyer ? `${product} → ${buyer}` : product;
}

/** Incoterms valid for a mode. */
export function incotermsFor(mode: ShipMode): Incoterm[] {
  const sea = mode === "sea_fcl" || mode === "sea_lcl";
  return sea ? INCOTERMS : INCOTERMS.filter((i) => !SEA_ONLY_INCOTERMS.includes(i));
}

/** EUDR applies to Annex I commodities placed on the EU market. */
export function needsEudr(sale: Sale): boolean {
  return sale.destination === "EU" && !!saleProduct(sale)?.eudrCovered;
}

export function saleRequirements(sale: Sale): RequirementResult | null {
  const product = saleProduct(sale);
  if (!product) return null;
  return resolveRequirements(
    {
      product,
      originCountry: ORIGIN_COUNTRY,
      destination: sale.destination,
      organicClaim: sale.organic,
    },
    DOCUMENT_TYPES,
  );
}

// --- validation --------------------------------------------------------------

export type SaleSection = "exporter" | "buyer" | "product" | "packing" | "commercial" | "shipment" | "eudr";

export const SECTIONS: SaleSection[] = [
  "exporter",
  "buyer",
  "product",
  "packing",
  "commercial",
  "shipment",
  "eudr",
];

export interface SaleIssue {
  section: SaleSection;
  /** Dotted path to the field, for focusing it. */
  field: string;
  /** i18n key describing what is wrong. */
  messageKey: string;
}

const blank = (s: string | undefined) => !s || s.trim().length === 0;

/** What still stops the documents from being issued. */
export function saleIssues(sale: Sale): SaleIssue[] {
  const out: SaleIssue[] = [];
  const add = (section: SaleSection, field: string, messageKey: string) =>
    out.push({ section, field, messageKey });

  if (blank(sale.exporter.name)) add("exporter", "exporter.name", "sale_err_required");
  if (blank(sale.exporter.address)) add("exporter", "exporter.address", "sale_err_required");

  if (blank(sale.buyer.name)) add("buyer", "buyer.name", "sale_err_required");
  if (blank(sale.buyer.address)) add("buyer", "buyer.address", "sale_err_required");
  if (blank(sale.buyer.country)) add("buyer", "buyer.country", "sale_err_required");

  if (!saleProduct(sale)) add("product", "productId", "sale_err_product");

  if (!(sale.packages >= 1) || !Number.isInteger(sale.packages)) {
    add("packing", "packages", "sale_err_packages");
  }
  if (!(sale.netKgPerPackage > 0)) add("packing", "netKgPerPackage", "sale_err_positive");
  // Gross includes the packaging, so it can never be lighter than the net.
  // `computePackingTotals` would silently raise it; the form says so instead.
  if (!(sale.grossKgPerPackage >= sale.netKgPerPackage) || !(sale.grossKgPerPackage > 0)) {
    add("packing", "grossKgPerPackage", "sale_err_gross_below_net");
  }

  if (!(sale.unitPricePerKg > 0)) add("commercial", "unitPricePerKg", "sale_err_positive");
  if (!incotermsFor(sale.shipMode).includes(sale.incoterm)) {
    add("commercial", "incoterm", "sale_err_incoterm_mode");
  }

  if (blank(sale.portOfDischarge)) add("shipment", "portOfDischarge", "sale_err_required");

  if (needsEudr(sale) && sale.plotIds.length === 0) add("eudr", "plotIds", "sale_err_eudr_plots");

  return out;
}

export function issuesBySection(issues: SaleIssue[]): Record<SaleSection, SaleIssue[]> {
  const out = Object.fromEntries(SECTIONS.map((s) => [s, [] as SaleIssue[]])) as Record<
    SaleSection,
    SaleIssue[]
  >;
  for (const i of issues) out[i.section].push(i);
  return out;
}

/** Ready to issue: every required field is present and consistent. */
export function isSaleComplete(sale: Sale): boolean {
  return saleIssues(sale).length === 0;
}
