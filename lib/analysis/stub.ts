import type { AnalysisClient } from "./client";
import type {
  AnalysisRequest,
  AnalysisResult,
  ForestFractionPoint,
  JobHandle,
  JobPoll,
  Sensor,
  Verdict,
} from "./types";

/**
 * Fake analysis client. Returns plausible, DETERMINISTIC verdicts so every
 * downstream feature (job UI, PDF, alerts) can be built and demoed before the
 * real service exists.
 *
 * Design notes:
 * - Stateless. The job handle encodes the plot id, the submit time, and a
 *   seed, so `poll` needs no shared store. This survives serverless (Vercel),
 *   where an in-memory job map would not persist between invocations.
 * - Deterministic. The same plot always yields the same verdict, driven by a
 *   hash of the request. Stable demos, stable tests.
 * - A short simulated delay makes the queued lifecycle observable: a job reads
 *   as `running` for STUB_DELAY_MS, then `succeeded`.
 *
 * Nothing here touches real imagery or CRS math. Area is a rough planar
 * estimate only — the authoritative equal-area hectare figure is computed in
 * PostGIS / the real service (see DECISIONS.md D-007 and SCHEMA.md).
 */

const STUB_DELAY_MS = 1500;
const STUB_MODEL_VERSION = "stub-0.0.0";

const JOB_PREFIX = "stub";
const JOB_SEP = "~"; // not present in UUIDs, safe as a delimiter

export class StubAnalysisClient implements AnalysisClient {
  async submit(req: AnalysisRequest): Promise<JobHandle> {
    const seed = hashString(
      `${req.plotId}|${req.countryCode}|${req.commodity}|${req.cutoffDate}`,
    );
    // jobId carries everything poll() needs — no server state.
    const jobId = [JOB_PREFIX, req.plotId, Date.now(), seed].join(JOB_SEP);
    return { jobId, plotId: req.plotId, status: "queued" };
  }

  async poll(jobId: string): Promise<JobPoll> {
    const parsed = parseJobId(jobId);
    if (!parsed) {
      return { status: "failed", jobId, plotId: "", error: "unrecognised job id" };
    }
    const { plotId, submittedAt, seed } = parsed;

    if (Date.now() - submittedAt < STUB_DELAY_MS) {
      return { status: "running", jobId, plotId };
    }
    return {
      status: "succeeded",
      jobId,
      plotId,
      result: fakeResult(jobId, plotId, seed),
    };
  }
}

// --- deterministic fake result -------------------------------------------

function fakeResult(jobId: string, plotId: string, seed: number): AnalysisResult {
  const rand = mulberry32(seed);

  // Verdict distribution: mostly clear, some flagged, a few insufficient_data.
  const roll = rand();
  const verdict: Verdict =
    roll < 0.65 ? "clear" : roll < 0.9 ? "flagged" : "insufficient_data";

  const series = fakeSeries(rand, verdict);
  const dataAccessedAt = new Date().toISOString();

  const base: AnalysisResult = {
    plotId,
    jobId,
    verdict,
    confidence:
      verdict === "insufficient_data"
        ? round2(0.2 + rand() * 0.2) // low confidence by construction
        : round2(0.72 + rand() * 0.27),
    forestFractionSeries: series,
    imagery:
      verdict === "insufficient_data"
        ? [] // nothing renderable when we can't determine
        : [
            fakeTile("before", series[0]),
            fakeTile("after", series[series.length - 1]),
          ],
    modelVersion: STUB_MODEL_VERSION,
    dataAccessedAt,
  };

  if (verdict === "flagged") {
    // Clearing window: between the last forested and first cleared observation.
    const dropIndex = series.findIndex((p, i) => i > 0 && p.forestFraction < 0.4);
    const earliest = series[Math.max(0, dropIndex - 1)]?.date ?? series[0].date;
    const latest = series[dropIndex]?.date ?? series[series.length - 1].date;
    base.clearingDateRange = { earliest, latest };
    base.clearedHectares = round2(0.3 + rand() * 4); // rough fake magnitude
  }

  return base;
}

function fakeSeries(
  rand: () => number,
  verdict: Verdict,
): ForestFractionPoint[] {
  const points: ForestFractionPoint[] = [];
  const start = new Date("2019-01-15T00:00:00Z");
  const count = 12;
  // For a flagged plot, forest fraction drops partway through the series.
  const dropAt = 4 + Math.floor(rand() * 5);

  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setUTCMonth(d.getUTCMonth() + i * 7); // ~7-month spacing across ~7 years
    const cleared = verdict === "flagged" && i >= dropAt;
    const forestFraction = cleared
      ? round2(0.05 + rand() * 0.2)
      : round2(0.7 + rand() * 0.25);
    const sensor: Sensor = rand() < 0.3 ? "S1" : rand() < 0.6 ? "S2+S1" : "S2";
    points.push({
      date: d.toISOString().slice(0, 10),
      forestFraction,
      sensor,
      cloudCover: sensor === "S1" ? 0 : round2(rand() * 0.4),
    });
  }
  return points;
}

function fakeTile(role: "before" | "after", p: ForestFractionPoint) {
  return {
    role,
    // Placeholder path; the real service returns rendered PNG URLs.
    url: `/stub/tiles/${role}-${p.date}.png`,
    acquisitionDate: p.date,
    sensor: p.sensor,
    cloudCover: p.cloudCover,
  };
}

// --- helpers --------------------------------------------------------------

function parseJobId(
  jobId: string,
): { plotId: string; submittedAt: number; seed: number } | null {
  const parts = jobId.split(JOB_SEP);
  if (parts.length !== 4 || parts[0] !== JOB_PREFIX) return null;
  const submittedAt = Number(parts[2]);
  const seed = Number(parts[3]);
  if (!Number.isFinite(submittedAt) || !Number.isFinite(seed)) return null;
  return { plotId: parts[1], submittedAt, seed };
}

/** FNV-1a-ish string hash → 32-bit unsigned int. Stable across runs. */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Small seeded PRNG. Deterministic given the seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
