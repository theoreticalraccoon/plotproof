/** The wire format between the ESP32 soil node and the browser, as a pure parser. */

/** Raw ADC range of an ESP32 on a 12-bit read. Anything outside is not a reading. */
export const ADC_MIN = 0;
export const ADC_MAX = 4095;

/** One decoded frame, before calibration. `raw` is the only measured quantity. */
export interface SensorFrame {
  raw: number;
  /** Board uptime in ms, if reported. Used only to spot a board that reset. */
  uptimeMs: number | null;
}

function finiteOrNull(v: unknown, lo: number, hi: number): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : null;
}

// Parse one line. Returns null for anything that is not a complete, plausible frame, including
// the sketch's own boot banner, which is plain text.
export function parseFrame(line: string): SensorFrame | null {
  const trimmed = line.trim();
  // Cheap reject before attempting JSON: the overwhelming majority of junk lines (boot messages,
  // ESP32 ROM output) do not start with a brace.
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;

  let obj: unknown;
  try {
    obj = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;

  // `raw` is the measurement. Without a plausible one there is no frame at all.
  const raw = finiteOrNull(o.raw, ADC_MIN, ADC_MAX);
  if (raw === null) return null;

  return {
    raw,
    uptimeMs: finiteOrNull(o.ms, 0, Number.MAX_SAFE_INTEGER),
  };
}

/** Accumulate bytes into whole lines. */
export class LineBuffer {
  private buf = "";
  /** Guard against a board that never sends a newline filling memory. */
  private static readonly MAX = 64 * 1024;

  push(chunk: string): string[] {
    this.buf += chunk;
    if (this.buf.length > LineBuffer.MAX) {
      // Something is wrong with the stream. Drop what we have rather than grow without bound;
      // the next newline resynchronises us.
      this.buf = this.buf.slice(-1024);
    }
    const parts = this.buf.split(/\r?\n/);
    this.buf = parts.pop() ?? "";
    return parts.filter((p) => p.length > 0);
  }

  /** Anything held back, e.g. on disconnect. */
  flush(): string {
    const rest = this.buf;
    this.buf = "";
    return rest;
  }
}
