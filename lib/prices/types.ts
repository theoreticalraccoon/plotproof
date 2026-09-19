// Price intelligence artifact, produced by ml/prices/PlotProof_Price_Intelligence.ipynb from
// the World Bank Pink Sheet and committed to public/models/prices.json.

export interface PricePoint {
  month: string; // "2026-06"
  price: number; // in `unit`
}

export interface ForecastPoint extends PricePoint {
  /** 10th–90th percentile band from real backtest errors. */
  low: number;
  high: number;
}

export interface CommodityPrices {
  label: string;
  unit: string; // e.g. "USD/kg"
  sourceSeries: string; // exact Pink Sheet column name, for audit
  latest: PricePoint;
  history: PricePoint[]; // last 24 months, oldest first
  forecast: ForecastPoint[];
  context: {
    /** Percent of the last 5 years' months at or below the latest price. */
    pctile5y: number;
    yoyChangePct: number | null;
  };
  model: {
    name: string;
    backtestMape1m: number;
    naiveMape1m: number;
    windowMonths: number;
  };
}

export interface PriceIntelligence {
  source: { name: string; url: string; license: string };
  generatedAt: string;
  commodities: Record<string, CommodityPrices>;
  /** app productId -> commodity key; produced by the notebook, no code change to remap. */
  productMap: Record<string, string>;
  caveats: string[];
}

let cached: Promise<PriceIntelligence | null> | null = null;

/** Load the published artifact, or null when none exists (an honest absence). */
export function loadPrices(): Promise<PriceIntelligence | null> {
  if (!cached) {
    cached = fetch("/models/prices.json")
      .then((r) => (r.ok ? (r.json() as Promise<PriceIntelligence>) : null))
      .catch(() => null);
  }
  return cached;
}
