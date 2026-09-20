/** A Global Forest Watch map link centred on a plot, for an independent look at the same area. */
import { plotCentre } from "../intake/geometry";
import type { LngLat } from "./gfw";

export function gfwMapUrl(ring: LngLat[]): string {
  const c = plotCentre(ring);
  if (!c) return "https://www.globalforestwatch.org/map/";
  return `https://www.globalforestwatch.org/map/?map=${encodeURIComponent(
    JSON.stringify({ center: { lat: c.lat, lng: c.lng }, zoom: 14 }),
  )}`;
}
