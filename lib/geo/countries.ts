/**
 * Countries a Sri Lankan consignment can be addressed to, and which market's
 * rules each falls under.
 *
 * This used to be a list of ORIGIN countries — Indonesia, Kenya, Brazil and so
 * on — behind a "where do you farm?" question. The product now serves Sri
 * Lankan exporters only, so origin is fixed and that question is gone. What
 * remains useful is the other end: the buyer's country, which decides whether
 * EU, UK or US requirements apply. Asking for the country and deriving the
 * market removes a question the officer could otherwise answer inconsistently
 * (a German buyer with "US" selected as the market).
 *
 * A curated map rather than `Intl.DisplayNames`: the generated documents must
 * read identically on every device and in every locale, and a customs officer
 * comparing two copies of an invoice should never see two spellings of one
 * country.
 */
import type { Market } from "../compliance/types";

export interface Destination {
  code: string;
  name: string;
  market: Market;
}

const EU: [string, string][] = [
  ["AT", "Austria"], ["BE", "Belgium"], ["BG", "Bulgaria"], ["HR", "Croatia"],
  ["CY", "Cyprus"], ["CZ", "Czechia"], ["DK", "Denmark"], ["EE", "Estonia"],
  ["FI", "Finland"], ["FR", "France"], ["DE", "Germany"], ["GR", "Greece"],
  ["HU", "Hungary"], ["IE", "Ireland"], ["IT", "Italy"], ["LV", "Latvia"],
  ["LT", "Lithuania"], ["LU", "Luxembourg"], ["MT", "Malta"], ["NL", "Netherlands"],
  ["PL", "Poland"], ["PT", "Portugal"], ["RO", "Romania"], ["SK", "Slovakia"],
  ["SI", "Slovenia"], ["ES", "Spain"], ["SE", "Sweden"],
];

export const DESTINATIONS: Destination[] = [
  ...EU.map(([code, name]) => ({ code, name, market: "EU" as const })),
  { code: "GB", name: "United Kingdom", market: "UK" as const },
  { code: "US", name: "United States", market: "US" as const },
].sort((a, b) => a.name.localeCompare(b.name));

const BY_CODE = new Map(DESTINATIONS.map((d) => [d.code, d]));

/** Display name for a country code. Sri Lanka is included for the exporter. */
export function countryName(code: string): string {
  if (code === "LK") return "Sri Lanka";
  return BY_CODE.get(code)?.name ?? code;
}

/** The market whose rules apply to a buyer in this country. */
export function marketFor(code: string): Market | null {
  return BY_CODE.get(code)?.market ?? null;
}
