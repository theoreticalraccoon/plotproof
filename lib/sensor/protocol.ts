/**
 * The wire format between the Magicbit and the browser, as a pure parser.
 *
 * Split from `serial.ts` for the same reason `preprocess.ts` is split from
 * `infer.ts` in the tea lane: everything that can be tested under plain Node
 * should be, and a serial read loop cannot be. This file is the half that can.
 *
 * The board emits one JSON object per line, newline-terminated:
 *
 *     {"raw":2431,"soilT":24.8,"airT":29.1,"rh":71.2,"ms":184023}
 *
 * Only `raw` is required. Everything else is optional because the sketch runs
 * with or without an SHT31 attached, and a missing sensor must produce `null`
 * rather than a zero — a zero would be read as 0 °C, which is a temperature.
 *
 * The parser is deliberately strict and total: it never throws, and it returns
 * `null` for anything it cannot vouch for. A serial line is untrusted input —
 * it can be a boot message, a partial frame from plugging the cable in
 * mid-transmission, or noise — and the one thing that must never happen is a
 * garbled frame becoming a confident soil reading.
 */

/** Raw ADC range of an ESP32 on a 12-bit read. Anything outside is not a reading. */
export const ADC_MIN = 0;
export const ADC_MAX = 4095;

/** One decoded frame, before calibration. `raw` is the only measured quantity. */
export interface SensorFrame {
  raw: number;
  soilTempC: number | null;
  airTempC: number | null;
  rhPct: number | null;
  /** Board uptime in ms, if reported. Used only to spot a board that reset. */
  uptimeMs: number | null;
}

function finiteOrNull(v: unknown, lo: number, hi: number): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : null;
}

/**
 * Parse one line. Returns null for anything that is not a complete, plausible
 * frame — including the sketch's own boot banner, which is plain text.
 */
export function parseFrame(line: string): SensorFrame | null {
  const trimmed = line.trim();
  // Cheap reject before attempting JSON: the overwhelming majority of junk
  // lines (boot messages, ESP32 ROM output) do not start with a brace.
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
    // Physically generous bounds: these reject a broken sensor reporting -127
    // (the classic disconnected-1-Wire value) without second-guessing weather.
    soilTempC: finiteOrNull(o.soilT, -20, 80),
    airTempC: finiteOrNull(o.airT, -20, 80),
    rhPct: finiteOrNull(o.rh, 0, 100),
    uptimeMs: finiteOrNull(o.ms, 0, Number.MAX_SAFE_INTEGER),
  };
}

/**
 * Accumulate bytes into whole lines.
 *
 * Serial delivers arbitrary chunks, not lines: one `read()` can carry half a
 * frame, three frames, or a frame split across two reads. Without buffering,
 * every chunk boundary that falls mid-JSON silently drops a reading. Returns
 * the complete lines found and keeps the remainder for next time.
 */
export class LineBuffer {
  private buf = "";
  /** Guard against a board that never sends a newline filling memory. */
  private static readonly MAX = 64 * 1024;

  push(chunk: string): string[] {
    this.buf += chunk;
    if (this.buf.length > LineBuffer.MAX) {
      // Something is wrong with the stream. Drop what we have rather than grow
      // without bound; the next newline resynchronises us.
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
