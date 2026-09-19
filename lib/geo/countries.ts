// Countries a Sri Lankan consignment can be addressed to, and which market's rules each falls
// under.
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
