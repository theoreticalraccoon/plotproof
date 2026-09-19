/*
 * PlotProof soil node — ESP32 (bare DevKit or Magicbit)
 *
 * Reads one capacitive soil-moisture probe and emits one JSON line per second
 * over USB serial at 115200 baud:
 *
 *     {"raw":2431,"ms":184023}
 *
 * `raw` is the probe's ADC count; `ms` is board uptime, which the browser uses
 * only to notice that the board has reset. That is the entire job.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO:
 *
 *   - It does not calibrate. The board has no idea what soil it is in, and a
 *     calibration stored on the board cannot be inspected or corrected by the
 *     person using it. The raw ADC count is the only thing actually measured,
 *     so the raw ADC count is what it sends. Calibration happens in the browser
 *     (lib/sensor/calibrate.ts), where it is visible, editable and stored next
 *     to the readings it explains.
 *
 *   - It does not average over minutes, smooth, or reject outliers. A firmware
 *     that quietly discards readings is a firmware whose output nobody can
 *     reason about. It reports what it read; the browser takes the median of a
 *     window when capturing a calibration anchor, and that window is visible.
 *
 *   - It does not connect to WiFi. USB serial is the whole transport. No broker,
 *     no cloud, no credentials on the device, nothing to leak or expire.
 *
 *   - It does not read air temperature or humidity. The app takes weather from
 *     a model grid for the plot; the probe is here to measure the one thing the
 *     grid cannot, which is how wet this soil actually is.
 *
 * WIRING (ESP32 DevKit, no breadboard needed):
 *
 *   Capacitive probe v1.2   GND  (black)  -> GND
 *                           VCC  (red)    -> 3V3   (NOT VIN/5V: the ADC is not 5V tolerant)
 *                           AOUT (yellow) -> D32
 *     Check the wire colours against the GND/VCC/AOUT print on the probe itself.
 *
 *   SOIL_PIN below must be an analogue pin. 32-39 always work; the ADC2 pins
 *   (4, 13, 14, 25-27) also work here only because this sketch never turns WiFi
 *   on. Avoid 2, 5, 12 and 15: they are boot-strapping pins, and a sensor
 *   holding one at the wrong level can stop the board booting or taking uploads.
 *
 * BUILD: Arduino IDE with the Espressif "esp32" boards package, board
 *        "ESP32 Dev Module". No libraries needed.
 *        Upload, then open Serial Monitor at 115200 to see one line a second.
 *        CLOSE the Serial Monitor before connecting from the browser: only one
 *        program can hold the port.
 */

#include <Arduino.h>

static const int  SOIL_PIN      = 32;
static const int  SAMPLES       = 16;    // ADC reads averaged into one reading
static const int  SAMPLE_GAP_MS = 5;
static const long INTERVAL_MS   = 1000;  // one line per second

// One a second because the browser's calibration takes the median of the last
// 12 lines: a 12 s window, short enough that a reading captured just after
// dipping the probe is not diluted by readings from before.

void setup() {
  Serial.begin(115200);
  // The browser drops any line that is not a complete JSON object, so this
  // banner is safe to print: it is informative on a serial monitor and
  // invisible to the app.
  delay(200);
  Serial.println("# PlotProof soil node ready");

  // 12-bit resolution over the full 0-3.3V range. ADC_11db is the widest
  // attenuation the ESP32 offers; without it the probe's upper range clips
  // and the dry anchor lands at the rail for every probe, which destroys the
  // calibration spread.
  analogReadResolution(12);
  analogSetPinAttenuation(SOIL_PIN, ADC_11db);
}

/*
 * Mean of SAMPLES consecutive reads.
 *
 * This is not smoothing over time — it is one reading, taken properly. The
 * ESP32's SAR ADC is noisy enough that a single read moves by tens of counts
 * between calls, and a few milliseconds of averaging removes that without
 * hiding any real change in the soil, which moves over hours.
 */
int readSoilRaw() {
  long total = 0;
  for (int i = 0; i < SAMPLES; i++) {
    total += analogRead(SOIL_PIN);
    delay(SAMPLE_GAP_MS);
  }
  return (int)(total / SAMPLES);
}

void loop() {
  static unsigned long last = 0;
  unsigned long now = millis();
  if (last != 0 && now - last < (unsigned long)INTERVAL_MS) return;
  last = now == 0 ? 1 : now;

  int raw = readSoilRaw();

  // One line, one object, newline-terminated. Field names match parseFrame()
  // in lib/sensor/protocol.ts; changing one without the other silently stops
  // every reading from being recorded, so they are named identically.
  Serial.print("{\"raw\":");
  Serial.print(raw);
  Serial.print(",\"ms\":");
  Serial.print(now);
  Serial.println("}");
}
