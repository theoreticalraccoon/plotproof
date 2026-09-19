/** The sale: the one record every export document is generated from. */
import type { DocStatus, Market, ShipMode } from "../compliance/types";
import type { ForestStats } from "../eudr/verdict";

export const ORIGIN_COUNTRY = "LK" as const;

export type Currency = "USD" | "EUR" | "GBP";
export const CURRENCIES: Currency[] = ["USD", "EUR", "GBP"];

/** Incoterms 2020 an officer realistically sees on a Sri Lankan agricultural consignment. */
export type Incoterm = "EXW" | "FOB" | "CFR" | "CIF" | "CIP" | "DAP";
export const INCOTERMS: Incoterm[] = ["FOB", "CFR", "CIF", "CIP", "DAP", "EXW"];
export const SEA_ONLY_INCOTERMS: Incoterm[] = ["FOB", "CFR", "CIF"];

/** Sri Lanka's export gateways. Colombo handles the overwhelming majority. */
export const PORTS_OF_LOADING = [
  "Colombo Port, Sri Lanka",
  "Hambantota Port, Sri Lanka",
  "Bandaranaike International Airport (CMB), Sri Lanka",
] as const;

export interface Party {
  name: string;
  address: string;
  /** Phone or email, free text. */
  contact: string;
}

export interface Sale {
  id: string;
  createdAt: string;
  updatedAt: string;

  /** The exporting business the officer is preparing this for. */
  exporter: Party & {
    // EU GSP+ Registered Exporter number. When present, the invoice carries the
    // statement-on-origin block that lets the EU buyer claim reduced duty.
    rexNumber: string;
  };

  /** The grower. Traceability and, for EUDR crops, whose plots are declared. */
  farmer: {
    name: string;
    /** National Identity Card number. Optional; only printed where required. */
    nic: string;
    village: string;
  };

  buyer: Party & { country: string };

  productId: string;
  /** Grade or trade description, e.g. "BOP1 Ceylon black tea, 2026 crop". */
  productDescription: string;
  organic: boolean;
  destination: Market;

  // --- packing --------------------------------------------------------
  packages: number;
  packageType: string;
  netKgPerPackage: number;
  grossKgPerPackage: number;
  /** Shipping marks painted or printed on each package. */
  marks: string;

  // --- commercial -----------------------------------------------------
  unitPricePerKg: number;
  currency: Currency;
  incoterm: Incoterm;
  paymentTerms: string;

  // --- shipment -------------------------------------------------------
  shipMode: ShipMode;
  portOfLoading: string;
  portOfDischarge: string;
  vesselOrFlight: string;
  /** Expected shipment date, YYYY-MM-DD. */
  shipmentDate: string;

  // --- EUDR -----------------------------------------------------------
  /** Attested plots this consignment was grown on. EUDR crops to the EU only. */
  plotIds: string[];
  /** The forest statistics fetched for each plot, keyed by plot id. */
  eudrChecks: Record<string, { stats: ForestStats; at: string }>;

  // --- documents ------------------------------------------------------
  /** Assigned ONCE, when the sale is created, and never regenerated. */
  numbers: {
    invoice: string;
    packingList: string;
    certificateOfOrigin: string;
  };

  /** Progress on documents only an authority can issue, keyed by document id. */
  authorityStatus: Record<string, DocStatus>;
}

/** The fields the officer fills in; everything else is bookkeeping. */
export type SaleInput = Omit<Sale, "id" | "createdAt" | "updatedAt" | "numbers" | "authorityStatus" | "eudrChecks">;
