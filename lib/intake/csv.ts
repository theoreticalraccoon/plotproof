// CSV / registry import, the highest-priority intake path (PROJECT.md: "import beats capture
// every time").
import Papa from "papaparse";
import type { LngLat } from "./types";

export interface ParsedCsv {
  columns: string[];
  rows: Record<string, string>[];
}

export function parseCsv(text: string): ParsedCsv {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const columns = result.meta.fields ?? [];
  return { columns, rows: result.data };
}

/** Which source column maps to which field. `geometry` is required. */
export interface ColumnMapping {
  fullName: string;
  geometry: string;
  nationalId?: string;
  membershipNo?: string;
  village?: string;
  phone?: string;
  claimedAreaHa?: string;
}

export interface MappedRow {
  raw: Record<string, string>;
  fullName: string;
  nationalId?: string;
  membershipNo?: string;
  village?: string;
  phone?: string;
  claimedAreaHa?: number;
  ring: LngLat[] | null;
  /** Set when this row cannot become a plot (bad/absent geometry). */
  error?: string;
}

export function mapRows(rows: Record<string, string>[], m: ColumnMapping): MappedRow[] {
  return rows.map((raw) => {
    const val = (col?: string) => (col ? (raw[col] ?? "").trim() : "");
    const geomRaw = val(m.geometry);
    let ring: LngLat[] | null = null;
    let error: string | undefined;
    try {
      ring = parseGeometryCell(geomRaw);
      if (!ring || ring.length < 3) error = "No usable boundary geometry.";
    } catch (e) {
      error = e instanceof Error ? e.message : "Unparseable geometry.";
    }
    const claimedRaw = val(m.claimedAreaHa);
    const claimedAreaHa = claimedRaw ? Number(claimedRaw) : undefined;
    return {
      raw,
      fullName: val(m.fullName),
      nationalId: val(m.nationalId) || undefined,
      membershipNo: val(m.membershipNo) || undefined,
      village: val(m.village) || undefined,
      phone: val(m.phone) || undefined,
      claimedAreaHa: Number.isFinite(claimedAreaHa) ? claimedAreaHa : undefined,
      ring,
      error,
    };
  });
}

/** Parse one geometry cell into an outer ring of [lng, lat]. */
export function parseGeometryCell(raw: string): LngLat[] | null {
  const s = raw.trim();
  if (!s) return null;

  if (s.startsWith("{")) return ringFromGeoJson(JSON.parse(s));
  if (/^\s*POLYGON/i.test(s)) return ringFromWkt(s);
  return ringFromCoordList(s);
}

function ringFromGeoJson(obj: unknown): LngLat[] {
  const geom =
    isRecord(obj) && obj.type === "Feature" ? (obj as { geometry: unknown }).geometry : obj;
  if (!isRecord(geom) || geom.type !== "Polygon") {
    throw new Error("GeoJSON is not a Polygon.");
  }
  const coords = (geom as { coordinates?: unknown }).coordinates;
  if (!Array.isArray(coords) || !Array.isArray(coords[0])) {
    throw new Error("Polygon has no coordinates.");
  }
  return (coords[0] as number[][]).map(toLngLat);
}

function ringFromWkt(s: string): LngLat[] {
  const open = s.indexOf("((");
  const close = s.indexOf("))", open);
  if (open === -1 || close === -1) throw new Error("Malformed WKT POLYGON.");
  const inner = s.slice(open + 2, close); // first ring only
  return inner.split(",").map((pair) => {
    const [x, y] = pair.trim().split(/\s+/).map(Number);
    return toLngLat([x, y]);
  });
}

function ringFromCoordList(s: string): LngLat[] {
  return s.split(/[;,]|\s{2,}/).reduce<LngLat[]>((acc, chunk) => {
    const nums = chunk.trim().split(/[\s,]+/).map(Number).filter((n) => !Number.isNaN(n));
    if (nums.length >= 2) acc.push(toLngLat([nums[0], nums[1]]));
    return acc;
  }, []);
}

function toLngLat(pair: number[]): LngLat {
  const [x, y] = pair;
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("Non-numeric coordinate.");
  return [x, y];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
