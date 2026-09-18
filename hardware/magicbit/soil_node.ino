/*
 * PlotProof soil node — Magicbit (ESP32)
 *
 * Reads a capacitive soil-moisture probe and, if one is attached, an SHT31
 * temperature/humidity sensor. Emits one JSON line per reading over USB serial
 * at 115200 baud. That is the entire job.
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
 * WIRING (Magicbit / ESP32):
 *
 *   Capacitive probe  VCC  -> 3V3        (NOT 5V: the ADC is not 5V tolerant)
 *                     GND  -> GND
 *                     AOUT -> GPIO 32    (ADC1_CH4; ADC2 is unusable with WiFi)
 *
 *   SHT31 (optional)  VIN  -> 3V3
 *                     GND  -> GND
 *                     SDA  -> GPIO 21
 *                     SCL  -> GPIO 22
 *
 * Without the SHT31 the sketch still runs; the temperature and humidity fields
 * are emitted as null and the browser stores them as null rather than as zero.
 *
 * BUILD: Arduino IDE, board "MagicBit" or any ESP32 Dev Module.
 *        Library needed only for the optional sensor: "Adafruit SHT31".
 *        To build without it, leave USE_SHT31 at 0.
 */

#include <Arduino.h>

#define USE_SHT31 0   // set to 1 once the SHT31 library is installed

#if USE_SHT31
#include <Wire.h>
#include <Adafruit_SHT31.h>
Adafruit_SHT31 sht31 = Adafruit_SHT31();
bool shtReady = false;
#endif

static const int   SOIL_PIN     = 32;
static const int   SAMPLES      = 16;    // per reported reading, averaged
static const int   SAMPLE_GAP_MS = 5;
static const long  INTERVAL_MS  = 1000;  // one line per second

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

#if USE_SHT31
  Wire.begin(21, 22);
  shtReady = sht31.begin(0x44);
  if (!shtReady) Serial.println("# SHT31 not found; temp/rh will be null");
#endif
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

/* Print a float, or a literal null when the sensor is absent or failed. */
void printNumberOrNull(float v, int decimals) {
  if (isnan(v)) Serial.print("null");
  else Serial.print(v, decimals);
}

void loop() {
  static unsigned long last = 0;
  unsigned long now = millis();
  if (now - last < INTERVAL_MS) return;
  last = now;

  int raw = readSoilRaw();

  float soilT = NAN;   // reserved: a soil thermistor is not wired in this build
  float airT  = NAN;
  float rh    = NAN;

#if USE_SHT31
  if (shtReady) {
    airT = sht31.readTemperature();
    rh   = sht31.readHumidity();
  }
#endif

  // One line, one object, newline-terminated. Field names match parseFrame()
  // in lib/sensor/protocol.ts; changing one without the other silently stops
  // every reading from being recorded, so they are named identically.
  Serial.print("{\"raw\":");
  Serial.print(raw);
  Serial.print(",\"soilT\":");
  printNumberOrNull(soilT, 1);
  Serial.print(",\"airT\":");
  printNumberOrNull(airT, 1);
  Serial.print(",\"rh\":");
  printNumberOrNull(rh, 1);
  Serial.print(",\"ms\":");
  Serial.print(now);
  Serial.println("}");
}
