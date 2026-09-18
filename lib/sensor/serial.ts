"use client";

/**
 * Web Serial: the browser talks to the Magicbit over USB directly.
 *
 * No bridge process, no MQTT broker, no gateway, no backend. The board is
 * plugged into the laptop the page is open on, `navigator.serial` opens the
 * port, and readings land in IndexedDB. That is the whole architecture, and it
 * is the same reasoning as the rest of the project: the fewer moving parts
 * between a measurement and the screen, the fewer places a number can be
 * invented.
 *
 * This is the only file in the sensor lane that touches the DOM or the hardware.
 * The wire format lives in `protocol.ts` and the arithmetic in `calibrate.ts`,
 * both pure and both tested, so what is untestable here is kept as thin as it
 * can be: open, loop, hand each line to a parser, close.
 *
 * Web Serial is Chromium-only and requires a secure context. Firefox and Safari
 * have not implemented it and are unlikely to soon. `isSerialSupported()` exists
 * so the UI can say that plainly rather than offering a button that cannot work.
 */
import { LineBuffer, parseFrame, type SensorFrame } from "./protocol";

/**
 * Minimal structural types for the Web Serial API.
 *
 * Declared locally rather than pulled from `@types/w3c-web-serial`: it is one
 * dependency for four shapes, and the shapes are stable. Everything is narrowed
 * through `isSerialSupported()` before use.
 */
interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readonly readable: ReadableStream<Uint8Array> | null;
  getInfo?(): { usbVendorId?: number; usbProductId?: number };
}
interface SerialLike {
  requestPort(options?: { filters?: { usbVendorId: number }[] }): Promise<SerialPortLike>;
  getPorts(): Promise<SerialPortLike[]>;
}

/** The sketch's baud rate. Must match `Serial.begin()` in soil_node.ino. */
export const BAUD_RATE = 115_200;

export function isSerialSupported(): boolean {
  return typeof navigator !== "undefined" && "serial" in navigator;
}

function serial(): SerialLike | null {
  if (!isSerialSupported()) return null;
  return (navigator as unknown as { serial: SerialLike }).serial;
}

export type SerialStatus = "idle" | "connecting" | "streaming" | "error";

export interface SerialConnection {
  /** Stop reading and release the port. Safe to call more than once. */
  close(): Promise<void>;
}

export interface SerialHandlers {
  onFrame(frame: SensorFrame): void;
  onStatus(status: SerialStatus, detail?: string): void;
}

/**
 * Ask the user to pick a port, then stream frames until closed.
 *
 * MUST be called from a user gesture: `requestPort()` opens a browser-chrome
 * picker and is blocked otherwise. That constraint is a feature — a page cannot
 * silently reach the serial bus.
 *
 * Every failure path resolves into `onStatus("error", …)`. Nothing here throws
 * into React, and no failure produces a reading.
 */
export async function connectSensor(handlers: SerialHandlers): Promise<SerialConnection | null> {
  const s = serial();
  if (!s) {
    handlers.onStatus("error", "unsupported");
    return null;
  }

  handlers.onStatus("connecting");

  let port: SerialPortLike;
  try {
    port = await s.requestPort();
    await port.open({ baudRate: BAUD_RATE });
  } catch (e) {
    // Includes the user dismissing the picker, which is not an error worth
    // shouting about — the UI treats "cancelled" as a return to idle.
    const msg = e instanceof Error ? e.message : String(e);
    handlers.onStatus("error", /No port selected|cancel/i.test(msg) ? "cancelled" : msg);
    return null;
  }

  let closed = false;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  const close = async () => {
    if (closed) return;
    closed = true;
    try {
      await reader?.cancel();
    } catch {
      /* the stream may already be gone; closing is best-effort */
    }
    try {
      await port.close();
    } catch {
      /* same */
    }
    handlers.onStatus("idle");
  };

  // The read loop runs detached. It is not awaited, because the caller needs the
  // connection handle back immediately to be able to close it.
  void (async () => {
    const decoder = new TextDecoder();
    const lines = new LineBuffer();
    try {
      if (!port.readable) throw new Error("Port is not readable");
      reader = port.readable.getReader();
      handlers.onStatus("streaming");

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;
        for (const line of lines.push(decoder.decode(value, { stream: true }))) {
          const frame = parseFrame(line);
          // A line that does not parse is dropped in silence. The board's boot
          // banner is plain text and would otherwise be reported as a fault on
          // every single connect.
          if (frame) handlers.onFrame(frame);
        }
      }
      await close();
    } catch (e) {
      if (closed) return; // cancel() during close throws; that is not a failure
      handlers.onStatus("error", e instanceof Error ? e.message : String(e));
      await close();
    }
  })();

  return { close };
}

/**
 * A deterministic stand-in for the board, clearly labelled everywhere it is used.
 *
 * Web Serial does not exist on Firefox, Safari or any phone, and the app is
 * demonstrated on machines that do not have a probe plugged in. The choice is
 * between a dead button and a simulator — and a simulator is only acceptable if
 * it is impossible to mistake for hardware. So every reading it produces is
 * stored with `source: "simulated"`, the UI labels the trace, and the readings
 * are written to a separate plot-scoped trace the farmer can clear.
 *
 * The signal is a slow drying curve with realistic jitter, seeded so a
 * demonstration is reproducible. It is not a model of anything.
 */
export function simulateSensor(
  handlers: Pick<SerialHandlers, "onFrame" | "onStatus">,
  opts: { dryRaw?: number; wetRaw?: number; intervalMs?: number } = {},
): SerialConnection {
  const dry = opts.dryRaw ?? 2950;
  const wet = opts.wetRaw ?? 1180;
  const interval = opts.intervalMs ?? 1000;

  let t = 0;
  let seed = 1337;
  const rand = () => {
    // Mulberry32: tiny, deterministic, good enough for jitter.
    seed = (seed + 0x6d2b79f5) | 0;
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4_294_967_296;
  };

  handlers.onStatus("streaming");
  const id = setInterval(() => {
    t += 1;
    // Start near field capacity and dry out slowly, so the irrigation verdict
    // visibly changes over a few minutes of a demonstration.
    const saturation = Math.max(0.12, 0.42 - t * 0.0015);
    const raw = Math.round(dry - saturation * (dry - wet) + (rand() - 0.5) * 24);
    handlers.onFrame({
      raw,
      soilTempC: Math.round((26 + (rand() - 0.5) * 1.5) * 10) / 10,
      airTempC: Math.round((29 + (rand() - 0.5) * 3) * 10) / 10,
      rhPct: Math.round((72 + (rand() - 0.5) * 8) * 10) / 10,
      uptimeMs: t * interval,
    });
  }, interval);

  return {
    close: async () => {
      clearInterval(id);
      handlers.onStatus("idle");
    },
  };
}
