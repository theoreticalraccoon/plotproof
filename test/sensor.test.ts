/**
 * The soil-probe lane. Run:
 *   node --experimental-strip-types test/sensor.test.ts
 *
 * Covers the two halves that can be tested without hardware: the wire-format
 * parser and the calibration arithmetic. The serial read loop itself cannot be
 * exercised here, which is exactly why those two were split out of it.
 *
 * The parser tests are mostly adversarial. A serial line is untrusted input —
 * boot banners, half-frames from plugging the cable in mid-transmission, a
 * sensor reporting its disconnected sentinel value — and the failure that
 * matters is not a crash, it is a garbled frame quietly becoming a confident
 * soil reading that outranks a working weather model.
 */
import assert from "node:assert/strict";
import { LineBuffer, parseFrame, ADC_MAX } from "../lib/sensor/protocol.ts";
import {
  checkCalibration,
  gridDisagreement,
  medianRaw,
  rawToVwc,
  MIN_ANCHOR_SPREAD,
} from "../lib/sensor/calibrate.ts";
import { guardVwc, VWC_MAX } from "../lib/grow/sensorGuard.ts";
import type { ProbeCalibration } from "../lib/grow/growTypes.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FAIL  ${name}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

const cal = (dryRaw: number, wetRaw: number): ProbeCalibration => ({
  plotId: "p1",
  dryRaw,
  wetRaw,
  capturedAt: "2026-09-18T00:00:00.000Z",
});

// ===================== the wire format ===================================

test("a well-formed frame parses", () => {
  const f = parseFrame('{"raw":2431,"soilT":24.8,"airT":29.1,"rh":71.2,"ms":184023}');
  assert.ok(f);
  assert.equal(f.raw, 2431);
  assert.equal(f.soilTempC, 24.8);
  assert.equal(f.airTempC, 29.1);
  assert.equal(f.rhPct, 71.2);
  assert.equal(f.uptimeMs, 184023);
});

test("a missing optional sensor yields null, never zero", () => {
  // The distinction matters: 0 is a temperature, null is the absence of one.
  // Storing 0 would put a freezing reading into the record every time someone
  // runs the sketch without an SHT31 attached.
  const f = parseFrame('{"raw":2000,"soilT":null,"airT":null,"rh":null,"ms":1}');
  assert.ok(f);
  assert.equal(f.soilTempC, null);
  assert.equal(f.airTempC, null);
  assert.equal(f.rhPct, null);
  const bare = parseFrame('{"raw":2000}');
  assert.ok(bare);
  assert.equal(bare.airTempC, null);
});

test("junk never becomes a reading", () => {
  const junk = [
    "",
    "   ",
    "# PlotProof soil node ready", // the sketch's own banner
    "ets Jun  8 2016 00:22:57",    // ESP32 ROM boot output
    '{"raw":2431',                  // truncated frame, cable plugged mid-send
    'raw":2431}',                   // the other half of it
    "{}",
    '{"raw":"2431"}',              // string, not number
    '{"raw":null}',
    '{"soilT":24.8}',              // no measurement at all
    "[1,2,3]",
    "null",
  ];
  for (const line of junk) {
    assert.equal(parseFrame(line), null, `should reject: ${JSON.stringify(line)}`);
  }
});

test("an out-of-range ADC count is not a reading", () => {
  assert.equal(parseFrame('{"raw":-1}'), null);
  assert.equal(parseFrame(`{"raw":${ADC_MAX + 1}}`), null);
  assert.ok(parseFrame('{"raw":0}'), "0 is a legitimate count");
  assert.ok(parseFrame(`{"raw":${ADC_MAX}}`));
});

test("a disconnected temperature sensor is dropped, not recorded", () => {
  // -127 is the classic disconnected-1-Wire value and would otherwise be stored
  // as a real, very cold soil.
  const f = parseFrame('{"raw":2000,"soilT":-127,"rh":150}');
  assert.ok(f);
  assert.equal(f.soilTempC, null);
  assert.equal(f.rhPct, null);
});

test("frames split across chunk boundaries are not lost", () => {
  // Serial delivers arbitrary chunks. Without buffering, every boundary that
  // falls mid-JSON silently drops a reading — and silently is the problem.
  const buf = new LineBuffer();
  assert.deepEqual(buf.push('{"raw":100}\n{"raw'), ['{"raw":100}']);
  assert.deepEqual(buf.push('":200}\n'), ['{"raw":200}']);
  const three = buf.push('{"raw":300}\r\n{"raw":400}\n{"raw":5');
  assert.deepEqual(three, ['{"raw":300}', '{"raw":400}']);
  assert.equal(buf.flush(), '{"raw":5');
});

test("a stream with no newline cannot grow without bound", () => {
  const buf = new LineBuffer();
  for (let i = 0; i < 200; i++) assert.deepEqual(buf.push("x".repeat(1000)), []);
  assert.ok(buf.flush().length <= 64 * 1024, "buffer must be bounded");
});

// ===================== calibration ======================================

test("a good calibration converts raw counts to water content", () => {
  const c = cal(2950, 1180);
  assert.equal(rawToVwc(2950, c), 0, "the dry anchor is 0 by definition");
  assert.equal(rawToVwc(1180, c), 1, "the wet anchor is 1 by definition");
  const mid = rawToVwc(2065, c)!;
  assert.ok(Math.abs(mid - 0.5) < 0.001, `midpoint should be ~0.5, got ${mid}`);
  // A realistic soil reading lands in the band the guard accepts.
  const soil = rawToVwc(2400, c)!;
  assert.ok(soil > 0.2 && soil < 0.45, `expected a plausible soil value, got ${soil}`);
  assert.equal(guardVwc(soil), soil);
});

test("no calibration means no water content, not a guess", () => {
  assert.equal(rawToVwc(2400, null), null);
  assert.equal(checkCalibration(null).problem, "missing");
});

test("swapped anchors are named as swapped, not averaged away", () => {
  // A capacitive probe reads HIGHER in air than in water. wet > dry means the
  // two captures went in the wrong order — a specific mistake with a specific
  // fix, which is worth saying rather than reporting a generic failure.
  const c = checkCalibration(cal(1180, 2950));
  assert.equal(c.ok, false);
  assert.equal(c.problem, "inverted");
  assert.equal(rawToVwc(2000, cal(1180, 2950)), null);
});

test("anchors too close together are refused", () => {
  // With a 10-count spread, one count of probe jitter moves the answer by 10%
  // water content. The output looks entirely normal, which is what makes it
  // dangerous.
  const tight = cal(2000, 2000 - (MIN_ANCHOR_SPREAD - 1));
  const c = checkCalibration(tight);
  assert.equal(c.ok, false);
  assert.equal(c.problem, "too_close");
  assert.equal(rawToVwc(1990, tight), null);

  const justEnough = cal(2000, 2000 - MIN_ANCHOR_SPREAD);
  assert.equal(checkCalibration(justEnough).ok, true);
});

test("out-of-range anchors are refused", () => {
  assert.equal(checkCalibration(cal(5000, 1180)).problem, "out_of_range");
  assert.equal(checkCalibration(cal(2950, -5)).problem, "out_of_range");
  assert.equal(checkCalibration(cal(NaN, 1180)).problem, "out_of_range");
});

test("readings beyond the anchors clamp rather than extrapolate", () => {
  // Drier than the dry anchor means the anchor was captured on a damp probe.
  // Extrapolating would report a NEGATIVE water content, which is not a dry
  // soil — it is a broken calibration wearing the costume of a measurement.
  const c = cal(2950, 1180);
  assert.equal(rawToVwc(3200, c), 0);
  assert.equal(rawToVwc(900, c), 1);
  for (const raw of [0, 500, 3000, 4095]) {
    const v = rawToVwc(raw, c)!;
    assert.ok(v >= 0 && v <= 1, `${raw} produced ${v}`);
  }
});

test("a clamped extreme still has to clear the plausibility guard", () => {
  // rawToVwc can legitimately return 1.0 (probe in free water). That is not a
  // soil, and the ladder must not anchor on it.
  const c = cal(2950, 1180);
  const submerged = rawToVwc(1180, c)!;
  assert.equal(submerged, 1);
  assert.equal(guardVwc(submerged), null, `1.0 exceeds VWC_MAX ${VWC_MAX} and must demote`);
});

test("an anchor is the median of a window, so one spike cannot poison it", () => {
  // An anchor is captured once and lived with. A mean would bake a single
  // spike permanently into every reading that follows it.
  assert.equal(medianRaw([2940, 2950, 2945, 4095, 2948]), 2948);
  assert.equal(medianRaw([100, 200]), 150);
  assert.equal(medianRaw([]), null);
  assert.equal(medianRaw([NaN, 2950, NaN]), 2950);
});

// ===================== the gap the probe reveals =========================

test("probe and grid disagreement is reported with a direction", () => {
  const wetter = gridDisagreement(0.31, 0.24)!;
  assert.equal(wetter.probeIsWetter, true);
  assert.ok(Math.abs(wetter.deltaVwc - 0.07) < 1e-9);

  const drier = gridDisagreement(0.18, 0.26)!;
  assert.equal(drier.probeIsWetter, false);
  assert.ok(Math.abs(drier.deltaVwc - 0.08) < 1e-9);

  // Missing either side is not a disagreement of zero — it is no comparison.
  assert.equal(gridDisagreement(null, 0.24), null);
  assert.equal(gridDisagreement(0.31, null), null);
  assert.equal(gridDisagreement(NaN, 0.24), null);
});

console.log(`\n${passed} passed`);
