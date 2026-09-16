/**
 * Live end-to-end check of the GROW lane against real weather.
 *
 *   node --experimental-strip-types scripts/live-check.ts [lat] [lng] [label]
 *
 * Unit tests prove the arithmetic; this proves the whole chain against data
 * nobody curated — real Open-Meteo variable names, real units, real Sri Lankan
 * conditions. It has already earned its place twice: it caught a flat-canopy
 * interception constant that drove a saturated up-country plot to "water soon",
 * and it caught the surface-vs-root-zone soil moisture difference (0.45 vs 0.33
 * m³/m³) that made the grid anchor worth building.
 *
 * Defaults to Nuwara Eliya, the heart of up-country Ceylon tea, because it is
 * the condition set the blister-blight model exists for.
 */
import { toDailyWeather, type OpenMeteoResponse } from "../lib/weather/derive.ts";
import { computeIrrigation } from "../lib/grow/irrigation.ts";
import { assessAll } from "../lib/grow/risk.ts";

const lat = Number(process.argv[2] ?? 6.97);
const lng = Number(process.argv[3] ?? 80.79);
const label = process.argv[4] ?? "Nuwara Eliya (up-country tea)";

const HOURLY =
  "temperature_2m,relative_humidity_2m,precipitation,soil_moisture_0_to_7cm," +
  "soil_moisture_7_to_28cm,soil_moisture_28_to_100cm,vapour_pressure_deficit";
const DAILY =
  "temperature_2m_max,temperature_2m_min,precipitation_sum," +
  "et0_fao_evapotranspiration,sunshine_duration";

const url =
  `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
  `&hourly=${HOURLY}&daily=${DAILY}&past_days=30&forecast_days=14&timezone=auto`;

const res = (await (await fetch(url)).json()) as OpenMeteoResponse;
const days = toDailyWeather(res, new Date().toISOString().slice(0, 10));
const observed = days.filter((d) => !d.isForecast);

if (observed.length === 0) {
  console.error("No observed days returned — check the variable names against the API.");
  process.exit(1);
}

const latest = observed[observed.length - 1];
console.log(`\n${label}  (${lat}, ${lng})`);
console.log(`${days.length} days: ${observed.length} observed, ${days.length - observed.length} forecast`);
console.log(`\nLatest observed (${latest.date}):`);
console.log(`  mean temp        ${latest.tMeanC.toFixed(1)} °C`);
console.log(`  mean RH          ${latest.rhMeanPct.toFixed(0)} %`);
console.log(`  rain             ${latest.precipMm} mm`);
console.log(`  ET0              ${latest.et0Mm} mm`);
console.log(`  sunshine         ${latest.sunshineHours.toFixed(1)} h`);
console.log(`  leaf wetness     ${latest.leafWetnessHours} h  (derived)`);
console.log(`  soil 0-7cm       ${latest.soilMoistureM3M3?.toFixed(3) ?? "—"} m³/m³`);
console.log(`  soil root zone   ${latest.soilMoistureRootZone?.toFixed(3) ?? "—"} m³/m³  (depth-blended)`);

const irr = computeIrrigation({ days, crop: "tea", soilTexture: "clay_loam", areaHa: 0.4 });
console.log(`\nIRRIGATION  ${irr.verdict}`);
console.log(`  soil state from  ${irr.anchorSource}`);
console.log(`  TAW ${irr.tawMm} mm · stress at ${irr.rawMm} mm · apply ${irr.recommendedMm} mm (${irr.recommendedLitres.toLocaleString()} L)`);

console.log(`\nDISEASE PRESSURE (tea):`);
for (const r of assessAll(days)) {
  console.log(`  ${r.disease.padEnd(15)} ${r.band.padEnd(9)} ${r.favourableDays}/${r.windowDays} days favourable`);
  for (const d of r.drivers) console.log(`      · ${d.key.replace("risk_driver_", "")} ${JSON.stringify(d.slots)}`);
}
console.log();
