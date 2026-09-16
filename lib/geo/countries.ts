/**
 * ISO 3166-1 alpha-2 → display name, for the origin countries this product
 * covers. Deliberately a small curated map rather than `Intl.DisplayNames`:
 * the generated export documents must read identically on every device and in
 * every locale, and a customs officer comparing two copies of an invoice should
 * never see two spellings of the same country.
 *
 * Previously lived in lib/public/format.ts alongside the public-map helpers;
 * moved here when that module was removed, since the document generators are
 * its only remaining callers.
 */
const COUNTRY_NAMES: Record<string, string> = {
  LK: "Sri Lanka",
  ID: "Indonesia",
  VN: "Vietnam",
  PH: "Philippines",
  IN: "India",
  KE: "Kenya",
  MY: "Malaysia",
  CI: "Côte d'Ivoire",
  GH: "Ghana",
  CM: "Cameroon",
  CD: "DR Congo",
  BR: "Brazil",
  PE: "Peru",
  CO: "Colombia",
  PG: "Papua New Guinea",
};

export function countryName(code: string): string {
  return COUNTRY_NAMES[code] ?? code;
}
