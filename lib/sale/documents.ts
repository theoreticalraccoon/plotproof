/**
 * The three documents this app issues, each as plain data built from a sale.
 *
 * WHY DATA AND NOT JSX. Each document is rendered twice: as an on-screen
 * preview the officer edits against, and as the PDF that is actually sent. If
 * those two renderers computed their own values they would eventually disagree,
 * and the version the officer checked would not be the version the buyer
 * received. Both renderers therefore consume these models and nothing else.
 *
 * Only the three documents an exporter may lawfully produce themselves are
 * here. The rest of a consignment's paperwork is issued by an authority
 * (phytosanitary certificate, customs declaration, …) and appears in the
 * checklist, never as a generated look-alike.
 */
import { countryName } from "../geo/countries.ts";
import { saleProduct, saleTotals } from "./model.ts";
import type { Sale } from "./types";

export type DocKind = "invoice" | "packing-list" | "certificate-of-origin";

export const DOC_KINDS: DocKind[] = ["invoice", "packing-list", "certificate-of-origin"];

export interface DocHeader {
  kind: DocKind;
  /** i18n key for the document's title. */
  titleKey: string;
  number: string;
  date: string;
  /** True while the sale still has open issues; printed as a DRAFT watermark. */
  draft: boolean;
}

export interface PartyBlock {
  name: string;
  lines: string[];
}

export interface InvoiceDoc extends DocHeader {
  kind: "invoice";
  exporter: PartyBlock;
  buyer: PartyBlock;
  line: {
    description: string;
    hsCode: string;
    quantityKg: number;
    unitPrice: number;
    amount: number;
  };
  currency: string;
  incoterm: string;
  incotermPlace: string;
  paymentTerms: string;
  route: { from: string; to: string; mode: string; vessel: string; date: string };
  packages: number;
  netKg: number;
  grossKg: number;
  origin: string;
  /** Present only for a REX-registered exporter shipping to the EU. */
  rexNumber: string | null;
}

export interface PackingListDoc extends DocHeader {
  kind: "packing-list";
  exporter: PartyBlock;
  buyer: PartyBlock;
  invoiceNumber: string;
  description: string;
  hsCode: string;
  packageType: string;
  marks: string;
  packages: number;
  netKgPerPackage: number;
  grossKgPerPackage: number;
  totalNetKg: number;
  totalGrossKg: number;
  route: { from: string; to: string; vessel: string };
}

export interface OriginDoc extends DocHeader {
  kind: "certificate-of-origin";
  exporter: PartyBlock;
  consignee: PartyBlock;
  producer: string;
  description: string;
  hsCode: string;
  packages: number;
  packageType: string;
  marks: string;
  grossKg: number;
  invoiceNumber: string;
  invoiceDate: string;
  origin: string;
  destinationCountry: string;
  route: { from: string; to: string; vessel: string };
}

export type ExportDoc = InvoiceDoc | PackingListDoc | OriginDoc;

// --- builders ---------------------------------------------------------------

const lines = (...xs: (string | undefined)[]) =>
  xs.map((x) => (x ?? "").trim()).filter((x) => x.length > 0);

function exporterBlock(sale: Sale): PartyBlock {
  return {
    name: sale.exporter.name,
    lines: lines(...sale.exporter.address.split("\n"), "Sri Lanka", sale.exporter.contact),
  };
}

function buyerBlock(sale: Sale): PartyBlock {
  const country = sale.buyer.country ? countryName(sale.buyer.country) : "";
  return {
    name: sale.buyer.name,
    lines: lines(...sale.buyer.address.split("\n"), country, sale.buyer.contact),
  };
}

function description(sale: Sale): string {
  const product = saleProduct(sale);
  const base = sale.productDescription.trim() || product?.name || "";
  return sale.organic && base ? `${base} (organic)` : base;
}

const MODE_LABEL: Record<Sale["shipMode"], string> = {
  sea_fcl: "Sea freight (FCL)",
  sea_lcl: "Sea freight (LCL)",
  air: "Air freight",
  courier: "Courier",
};

export function buildInvoice(sale: Sale, today: string, draft: boolean): InvoiceDoc {
  const t = saleTotals(sale);
  const product = saleProduct(sale);
  return {
    kind: "invoice",
    titleKey: "doc_invoice_title",
    number: sale.numbers.invoice,
    date: today,
    draft,
    exporter: exporterBlock(sale),
    buyer: buyerBlock(sale),
    line: {
      description: description(sale),
      hsCode: product?.hsCode ?? "",
      quantityKg: t.netKg,
      unitPrice: sale.unitPricePerKg,
      amount: t.amount,
    },
    currency: sale.currency,
    incoterm: sale.incoterm,
    // Incoterms name a place: FOB names the port of loading, CIF/CFR/CIP/DAP
    // the destination. An incoterm with no place is incomplete.
    incotermPlace:
      sale.incoterm === "FOB" || sale.incoterm === "EXW" ? sale.portOfLoading : sale.portOfDischarge,
    paymentTerms: sale.paymentTerms,
    route: {
      from: sale.portOfLoading,
      to: sale.portOfDischarge,
      mode: MODE_LABEL[sale.shipMode],
      vessel: sale.vesselOrFlight,
      date: sale.shipmentDate,
    },
    packages: t.packages,
    netKg: t.netKg,
    grossKg: t.grossKg,
    origin: "Sri Lanka",
    rexNumber: sale.destination === "EU" && sale.exporter.rexNumber.trim() ? sale.exporter.rexNumber.trim() : null,
  };
}

export function buildPackingList(sale: Sale, today: string, draft: boolean): PackingListDoc {
  const t = saleTotals(sale);
  return {
    kind: "packing-list",
    titleKey: "doc_packing_title",
    number: sale.numbers.packingList,
    date: today,
    draft,
    exporter: exporterBlock(sale),
    buyer: buyerBlock(sale),
    invoiceNumber: sale.numbers.invoice,
    description: description(sale),
    hsCode: saleProduct(sale)?.hsCode ?? "",
    packageType: sale.packageType,
    marks: sale.marks,
    packages: t.packages,
    netKgPerPackage: sale.netKgPerPackage,
    // Mirror computePackingTotals: gross is never reported below net.
    grossKgPerPackage: Math.max(sale.netKgPerPackage, sale.grossKgPerPackage),
    totalNetKg: t.netKg,
    totalGrossKg: t.grossKg,
    route: { from: sale.portOfLoading, to: sale.portOfDischarge, vessel: sale.vesselOrFlight },
  };
}

export function buildOrigin(sale: Sale, today: string, draft: boolean): OriginDoc {
  const t = saleTotals(sale);
  return {
    kind: "certificate-of-origin",
    titleKey: "doc_origin_title",
    number: sale.numbers.certificateOfOrigin,
    date: today,
    draft,
    exporter: exporterBlock(sale),
    consignee: buyerBlock(sale),
    producer: lines(sale.farmer.name, sale.farmer.village).join(", "),
    description: description(sale),
    hsCode: saleProduct(sale)?.hsCode ?? "",
    packages: t.packages,
    packageType: sale.packageType,
    marks: sale.marks,
    grossKg: t.grossKg,
    invoiceNumber: sale.numbers.invoice,
    invoiceDate: today,
    origin: "Sri Lanka",
    destinationCountry: sale.buyer.country ? countryName(sale.buyer.country) : "",
    route: { from: sale.portOfLoading, to: sale.portOfDischarge, vessel: sale.vesselOrFlight },
  };
}

export function buildDoc(kind: DocKind, sale: Sale, today: string, draft: boolean): ExportDoc {
  if (kind === "invoice") return buildInvoice(sale, today, draft);
  if (kind === "packing-list") return buildPackingList(sale, today, draft);
  return buildOrigin(sale, today, draft);
}

/** File name for a download: "INV-40312345-invoice.pdf". */
export function docFileName(doc: ExportDoc): string {
  return `${doc.number}-${doc.kind}.pdf`;
}
