/**
 * Every editable field on a sale, described once.
 *
 * The questionnaire on /sell shows all of them, grouped by section. The editor
 * beside each document on /documents shows only the fields that document
 * actually prints. Both read this list, so a field cannot exist in one place
 * and be missing from the other — which is how the old per-page forms drifted
 * apart.
 */
import type { DocKind } from "./documents";
import type { SaleSection } from "./model";
import type { Sale } from "./types";

export type FieldKind =
  | "text"
  | "textarea"
  | "number"
  | "integer"
  | "date"
  | "select"
  | "country"
  | "product"
  | "toggle";

export interface FieldDef {
  /** Dotted path into the sale, e.g. "buyer.name". */
  path: string;
  section: SaleSection;
  kind: FieldKind;
  labelKey: string;
  /** Short help shown under the field. */
  hintKey?: string;
  placeholder?: string;
  /** For "select": the allowed values. Labels come from `optionKey(value)`. */
  options?: readonly string[];
  optionKeyPrefix?: string;
  /** Which generated documents print this field. */
  docs: DocKind[];
  required?: boolean;
  /** Spans both columns of the form grid. */
  wide?: boolean;
}

const ALL: DocKind[] = ["invoice", "packing-list", "certificate-of-origin"];

export const FIELDS: FieldDef[] = [
  // --- exporter ---------------------------------------------------------
  { path: "exporter.name", section: "exporter", kind: "text", labelKey: "sale_f_exporter_name", docs: ALL, required: true, placeholder: "Uva Highlands Tea Exports (Pvt) Ltd" },
  { path: "exporter.address", section: "exporter", kind: "textarea", labelKey: "sale_f_address", docs: ALL, required: true, wide: true },
  { path: "exporter.contact", section: "exporter", kind: "text", labelKey: "sale_f_contact", docs: ALL },
  { path: "exporter.rexNumber", section: "exporter", kind: "text", labelKey: "sale_f_rex", hintKey: "sale_h_rex", docs: ["invoice"] },
  { path: "farmer.name", section: "exporter", kind: "text", labelKey: "sale_f_farmer_name", hintKey: "sale_h_farmer", docs: ["certificate-of-origin"] },
  { path: "farmer.village", section: "exporter", kind: "text", labelKey: "sale_f_farmer_village", docs: ["certificate-of-origin"] },

  // --- buyer -------------------------------------------------------------
  { path: "buyer.name", section: "buyer", kind: "text", labelKey: "sale_f_buyer_name", docs: ALL, required: true },
  { path: "buyer.country", section: "buyer", kind: "country", labelKey: "sale_f_buyer_country", hintKey: "sale_h_buyer_country", docs: ALL, required: true },
  { path: "buyer.address", section: "buyer", kind: "textarea", labelKey: "sale_f_address", docs: ALL, required: true, wide: true },
  { path: "buyer.contact", section: "buyer", kind: "text", labelKey: "sale_f_contact", docs: ["invoice", "packing-list"] },

  // --- product -------------------------------------------------------------
  { path: "productId", section: "product", kind: "product", labelKey: "sale_f_product", docs: ALL, required: true, wide: true },
  { path: "productDescription", section: "product", kind: "text", labelKey: "sale_f_description", hintKey: "sale_h_description", docs: ALL, wide: true },
  { path: "organic", section: "product", kind: "toggle", labelKey: "sale_f_organic", hintKey: "sale_h_organic", docs: ALL },

  // --- packing -------------------------------------------------------------
  { path: "packages", section: "packing", kind: "integer", labelKey: "sale_f_packages", docs: ALL, required: true },
  { path: "packageType", section: "packing", kind: "text", labelKey: "sale_f_package_type", docs: ["packing-list", "certificate-of-origin"] },
  { path: "netKgPerPackage", section: "packing", kind: "number", labelKey: "sale_f_net_each", docs: ALL, required: true },
  { path: "grossKgPerPackage", section: "packing", kind: "number", labelKey: "sale_f_gross_each", hintKey: "sale_h_gross", docs: ALL, required: true },
  { path: "marks", section: "packing", kind: "text", labelKey: "sale_f_marks", hintKey: "sale_h_marks", docs: ["packing-list", "certificate-of-origin"], wide: true },

  // --- commercial ------------------------------------------------------------
  { path: "unitPricePerKg", section: "commercial", kind: "number", labelKey: "sale_f_price", docs: ["invoice"], required: true },
  { path: "currency", section: "commercial", kind: "select", labelKey: "sale_f_currency", options: ["USD", "EUR", "GBP"], docs: ["invoice"] },
  { path: "incoterm", section: "commercial", kind: "select", labelKey: "sale_f_incoterm", hintKey: "sale_h_incoterm", options: ["FOB", "CFR", "CIF", "CIP", "DAP", "EXW"], optionKeyPrefix: "incoterm_", docs: ["invoice"] },
  { path: "paymentTerms", section: "commercial", kind: "text", labelKey: "sale_f_payment", placeholder: "e.g. 30% advance, 70% against documents", docs: ["invoice"], wide: true },

  // --- shipment ----------------------------------------------------------------
  { path: "shipMode", section: "shipment", kind: "select", labelKey: "sale_f_mode", options: ["sea_fcl", "sea_lcl", "air", "courier"], optionKeyPrefix: "shipmode_", docs: ["invoice"] },
  { path: "portOfLoading", section: "shipment", kind: "select", labelKey: "sale_f_port_loading", options: ["Colombo Port, Sri Lanka", "Hambantota Port, Sri Lanka", "Bandaranaike International Airport (CMB), Sri Lanka"], docs: ALL },
  { path: "portOfDischarge", section: "shipment", kind: "text", labelKey: "sale_f_port_discharge", placeholder: "e.g. Hamburg, Germany", docs: ALL, required: true },
  { path: "vesselOrFlight", section: "shipment", kind: "text", labelKey: "sale_f_vessel", docs: ALL },
  { path: "shipmentDate", section: "shipment", kind: "date", labelKey: "sale_f_ship_date", docs: ["invoice"] },
];

export function fieldsFor(section: SaleSection): FieldDef[] {
  return FIELDS.filter((f) => f.section === section);
}

export function fieldsForDoc(kind: DocKind): FieldDef[] {
  return FIELDS.filter((f) => f.docs.includes(kind));
}

// --- path access --------------------------------------------------------------

export function getPath(sale: Sale, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], sale);
}

/** Immutable set: returns a new sale with one path changed. */
export function setPath(sale: Sale, path: string, value: unknown): Sale {
  const [head, ...rest] = path.split(".");
  if (rest.length === 0) return { ...sale, [head]: value } as Sale;
  const inner = (sale as unknown as Record<string, Record<string, unknown>>)[head] ?? {};
  return { ...sale, [head]: { ...inner, [rest.join(".")]: value } } as Sale;
}

/**
 * Set a field and apply what follows from it.
 *
 * Two fields decide others, and doing it here — rather than in whichever
 * component happened to change them — means the questionnaire and the document
 * editor cannot disagree about the consequences:
 *
 *  - The buyer's country decides the market (a German buyer is an EU sale),
 *    removing a question the officer could otherwise answer inconsistently.
 *  - Switching to air freight invalidates FOB, CFR and CIF, which are sea-only.
 *    The incoterm moves to its multimodal counterpart instead of silently
 *    printing a term a bank would reject.
 */
export function applyField(
  sale: Sale,
  path: string,
  value: unknown,
  deps: {
    marketFor: (code: string) => Sale["destination"] | null;
    incotermsFor: (mode: Sale["shipMode"]) => Sale["incoterm"][];
  },
): Sale {
  let next = setPath(sale, path, value);

  if (path === "buyer.country" && typeof value === "string") {
    const market = deps.marketFor(value);
    if (market) next = { ...next, destination: market };
  }

  if (path === "shipMode") {
    const allowed = deps.incotermsFor(next.shipMode);
    if (!allowed.includes(next.incoterm)) {
      const counterpart: Partial<Record<Sale["incoterm"], Sale["incoterm"]>> = {
        FOB: "EXW",
        CFR: "CIP",
        CIF: "CIP",
      };
      const moved = counterpart[next.incoterm];
      next = { ...next, incoterm: moved && allowed.includes(moved) ? moved : allowed[0] };
    }
  }

  return next;
}
