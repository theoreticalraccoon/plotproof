/**
 * Shipping suggester. From the product's perishability, the volume, and the
 * destination, propose sensible modes + an Incoterm, in plain language. Pure.
 *
 * These are guidance defaults, not quotes, the farmer confirms with a freight
 * forwarder. Kept honest, like every other output.
 */
import type { Market, Product, ShippingOption } from "./types";

const FCL_THRESHOLD_KG = 10_000; // roughly a full 20ft container of dry goods

export function suggestShipping(
  product: Product,
  quantityKg: number,
  destination: Market,
): ShippingOption[] {
  const options: ShippingOption[] = [];
  const perishable = product.perishability === "perishable";

  if (perishable) {
    options.push({
      mode: "air",
      label: "Air freight",
      rationale: "Your product is perishable, speed protects quality.",
      incoterm: "CIP (you arrange carriage + insurance to the airport of arrival)",
      transit: "2–5 days",
      notes: "Confirm cold-chain handling. Higher cost per kg, but far less spoilage risk.",
    });
    options.push({
      mode: "courier",
      label: "Express courier",
      rationale: "For small, high-value perishable lots.",
      incoterm: "DAP (delivered to the buyer's address)",
      transit: "3–7 days",
      notes: "Simplest paperwork; only economical at small volumes.",
    });
    return options;
  }

  // Durable / semi-perishable → sea is usually most economical.
  if (quantityKg >= FCL_THRESHOLD_KG) {
    options.push({
      mode: "sea_fcl",
      label: "Sea freight, full container (FCL)",
      rationale: `${Math.round(quantityKg).toLocaleString()} kg fills a container, the cheapest per kg.`,
      incoterm: "FOB (you deliver to the departure port; buyer takes it from there)",
      transit: destination === "US" ? "20–35 days" : "22–40 days",
      notes: "Best value at volume. FOB keeps your responsibility simple for a first export.",
    });
  } else {
    options.push({
      mode: "sea_lcl",
      label: "Sea freight, shared container (LCL)",
      rationale: "Your volume is below a full container, so you share space.",
      incoterm: "FOB (you deliver to the departure port)",
      transit: destination === "US" ? "25–40 days" : "28–45 days",
      notes: "Economical without needing a full container. Pack sturdily, shared handling.",
    });
  }
  options.push({
    mode: "air",
    label: "Air freight (faster option)",
    rationale: "When the buyer needs it quickly or for a first trial shipment.",
    incoterm: "CIP (carriage + insurance to arrival airport)",
    transit: "2–5 days",
    notes: "Several times the cost of sea; useful for samples and urgent orders.",
  });
  return options;
}
