/**
 * Pure helpers shared by the export-document generators (commercial invoice,
 * packing list, certificate of origin). No React/DOM here so the arithmetic is
 * Node-testable and the *same* numbers appear on every document a shipment uses.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface PackingInput {
  packages: number;
  netKgPerPackage: number;
  grossKgPerPackage: number;
}

export interface PackingTotals {
  packages: number;
  totalNetKg: number;
  totalGrossKg: number;
}

/**
 * Totals for a packing list. Guards the physical invariants a customs officer
 * would check: whole packages, non-negative weights, and gross >= net (gross
 * includes the packaging), so a slip in one field can't produce a gross that is
 * lighter than the net.
 */
export function computePackingTotals(input: PackingInput): PackingTotals {
  const packages = Math.max(0, Math.floor(input.packages || 0));
  const net = Math.max(0, input.netKgPerPackage || 0);
  const gross = Math.max(net, input.grossKgPerPackage || 0);
  return {
    packages,
    totalNetKg: round2(packages * net),
    totalGrossKg: round2(packages * gross),
  };
}

/** Even split of a known total weight across a package count (a sensible default). */
export function suggestNetPerPackage(totalKg: number, packages: number): number {
  if (!packages || packages <= 0) return 0;
  return round2((totalKg || 0) / packages);
}

/** A line amount for the commercial invoice (quantity x unit price). */
export function lineAmount(quantity: number, unitPrice: number): number {
  return round2((quantity || 0) * (unitPrice || 0));
}

/**
 * Human-readable document number, e.g. docNumber("INV") -> "INV-40312345".
 * Deterministic given `at`, so it's testable; defaults to now for real use.
 */
export function docNumber(prefix: string, at: number = Date.now()): string {
  return `${prefix}-${Math.floor(at).toString().slice(-8)}`;
}
