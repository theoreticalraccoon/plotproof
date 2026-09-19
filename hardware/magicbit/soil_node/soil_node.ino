// PlotProof soil node: sends the probe's raw reading over USB as {"raw":..,"ms":..}, once a second.
// Wiring: probe GND -> GND, VCC -> 3V3 (not 5V), AOUT -> D32. Board: "ESP32 Dev Module", no libraries.

#include <Arduino.h>

static const int  SOIL_PIN      = 32;
static const int  SAMPLES       = 16;    // ADC reads averaged into one reading
static const int  SAMPLE_GAP_MS = 5;
static const long INTERVAL_MS   = 1000;  // one line per second

// One a second because the browser's calibration takes the median of the last 12 lines: a 12 s
// window.

void setup() {
  Serial.begin(115200);
  // The browser drops any line that is not a complete JSON object, so this banner is safe to
  // print: it is informative on a serial monitor and invisible to the app.
  delay(200);
  Serial.println("# PlotProof soil node ready");

  // 12-bit resolution over the full 0-3.3V range.
  analogReadResolution(12);
  analogSetPinAttenuation(SOIL_PIN, ADC_11db);
}

/* Mean of SAMPLES consecutive reads. */
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

  // One line, one object, newline-terminated.
  Serial.print("{\"raw\":");
  Serial.print(raw);
  Serial.print(",\"ms\":");
  Serial.print(now);
  Serial.println("}");
}
