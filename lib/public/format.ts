/**
 * Human-readable labels + formatting for the public UI. Kept apart from types so
 * both client and server can import without pulling in the store.
 */
import type { DisputeReason, LandCover, ReporterType } from "./types";

/** Plain-language confidence band — the public never sees a raw 0.87. */
export function confidenceBand(n: number): "High" | "Medium" | "Low" {
  if (n >= 0.8) return "High";
  if (n >= 0.6) return "Medium";
  return "Low";
}

export const REASON_LABELS: Record<DisputeReason, string> = {
  not_forest_loss: "This was never forest",
  legal_harvest: "Legal harvest or rotation (not deforestation)",
  plantation_not_natural: "It's a plantation, not natural forest",
  regrowth_or_pre_cutoff: "Cleared before 2020, or has regrown",
  wrong_location: "The marked area is in the wrong place",
  cloud_or_artifact: "Looks like a cloud or image glitch",
  other: "Other (explain below)",
};

export const LANDCOVER_LABELS: Record<LandCover, string> = {
  natural_forest: "Natural forest",
  mature_plantation: "Mature plantation (rubber, oil palm…)",
  young_plantation: "Young / newly planted",
  cropland: "Cropland",
  grassland: "Grassland / scrub",
  settlement: "Buildings / settlement",
  bare_soil: "Bare soil",
  water: "Water",
  other: "Other",
};

export const REPORTER_LABELS: Record<ReporterType, string> = {
  anonymous: "Prefer not to say",
  journalist: "Journalist",
  ngo: "NGO / civil society",
  researcher: "Researcher",
  official: "Government / official",
};

const COUNTRY_NAMES: Record<string, string> = {
  LK: "Sri Lanka",
  ID: "Indonesia",
  VN: "Vietnam",
  PH: "Philippines",
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
