/**
 * Contract with the Python analysis service (see ML.md).
 *
 * The web app is built ONLY against this interface. Per PROJECT.md, do not
 * assume the service is fast, present, or correct. Analysis is a QUEUED job:
 * `submit` returns a job handle immediately; results are fetched later via
 * `poll`. This mirrors the real service, which writes results when done.
 *
 * All dates/datetimes are ISO 8601. Satellite acquisition times are UTC
 * (see PROJECT.md "Time zones") — the caller is responsible for rendering
 * them in local time and labelling the zone in the PDF.
 */

export type Verdict = "clear" | "flagged" | "insufficient_data";

/** Which sensor(s) produced an observation. Recorded because it goes in the PDF. */
export type Sensor = "S2" | "S1" | "S2+S1";

/** GeoJSON Polygon in WGS84 (EPSG:4326), coordinates as [lon, lat]. */
export interface Wgs84Polygon {
  type: "Polygon";
  /** [ring][vertex][lon, lat]; ring[0] is the outer boundary. */
  coordinates: number[][][];
}

/** ---- Request: what we send for one plot ---- */
export interface AnalysisRequest {
  /** Our plot UUID. Echoed back on the result so we can match it up. */
  plotId: string;
  /** Plot boundary in WGS84. */
  geometry: Wgs84Polygon;
  /** ISO-3166 alpha-2. Selects the forest definition server-side. */
  countryCode: string;
  /** e.g. "rubber", "coffee", "cocoa". */
  commodity: string;
  /** Assessment cutoff, ISO date (YYYY-MM-DD). Usually 2020-12-31 (see DECISIONS.md D-001). */
  cutoffDate: string;
}

/** One observation in the per-plot forest-fraction time series. */
export interface ForestFractionPoint {
  /** ISO date of the satellite acquisition (UTC). */
  date: string;
  /** 0..1 fraction of the plot classified as forest on this date. */
  forestFraction: number;
  sensor: Sensor;
  /** 0..1 fraction of the plot obscured by cloud (0 for radar-only). */
  cloudCover: number;
}

/** A rendered before/after tile. Goes straight into the PDF, so it is a file. */
export interface ImageryTile {
  role: "before" | "after";
  /** URL/path to the rendered PNG (true colour, polygon overlaid, date burned in). */
  url: string;
  /** ISO date of the scene (UTC). */
  acquisitionDate: string;
  sensor: Sensor;
  cloudCover: number;
}

/** ---- Result: what the service writes when a job completes ---- */
export interface AnalysisResult {
  plotId: string;
  jobId: string;
  verdict: Verdict;
  /** 0..1. */
  confidence: number;
  forestFractionSeries: ForestFractionPoint[];
  /** Present only when verdict === "flagged". ISO dates (UTC). */
  clearingDateRange?: { earliest: string; latest: string };
  /** Present only when verdict === "flagged". Hectares. */
  clearedHectares?: number;
  /** The before/after pair (may be empty for insufficient_data). */
  imagery: ImageryTile[];
  /** e.g. "unet-fused-v0.3.1". Recorded in the PDF methodology section. */
  modelVersion: string;
  /** ISO datetime (UTC) the underlying satellite sources were queried. */
  dataAccessedAt: string;
}

/** ---- Job lifecycle ---- */
export type JobStatus = "queued" | "running" | "succeeded" | "failed";

/** Returned by `submit`: enough to poll later. */
export interface JobHandle {
  jobId: string;
  plotId: string;
  status: JobStatus;
}

/** Returned by `poll`: pending, done-with-result, or failed. */
export type JobPoll =
  | { status: "queued" | "running"; jobId: string; plotId: string }
  | { status: "succeeded"; jobId: string; plotId: string; result: AnalysisResult }
  | { status: "failed"; jobId: string; plotId: string; error: string };
