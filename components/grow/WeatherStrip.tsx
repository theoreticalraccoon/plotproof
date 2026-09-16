"use client";

/**
 * The four weather numbers the rest of the page is computed from, shown so the
 * advisory is never a black box — a farmer can sanity-check "it rained more
 * than that" against their own week and know to distrust the rest.
 *
 * Leaf wetness is included even though it is the least intuitive, because it is
 * the strongest driver in the disease model and it is DERIVED rather than
 * observed. Hiding the estimated input while showing the confident output is
 * the shape of a dishonest interface.
 */
import { t, type Lang } from "@/lib/i18n";
import { WEATHER_SOURCE } from "@/lib/weather/openmeteo";
import type { DailyWeather } from "@/lib/grow/types";

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export default function WeatherStrip({
  days,
  lang,
  observedThrough,
  cachedAt,
}: {
  days: DailyWeather[];
  lang: Lang;
  observedThrough: string | null;
  cachedAt: string | null;
}) {
  const observed = days.filter((d) => !d.isForecast);
  const last7 = observed.slice(-7);
  if (last7.length === 0) return null;

  const stats = [
    { label: t(lang, "weather_rain_7d"), value: `${Math.round(last7.reduce((a, d) => a + d.precipMm, 0))} mm` },
    { label: t(lang, "weather_temp_mean"), value: `${mean(last7.map((d) => d.tMeanC)).toFixed(1)}°C` },
    { label: t(lang, "weather_wetness"), value: `${mean(last7.map((d) => d.leafWetnessHours)).toFixed(0)} h/day` },
    { label: t(lang, "weather_sunshine"), value: `${mean(last7.map((d) => d.sunshineHours)).toFixed(1)} h/day` },
  ];

  return (
    <section aria-labelledby="weather-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="weather-heading" className="eyebrow">
          {t(lang, "weather_title")}
        </h2>
        {observedThrough && (
          <p className="text-[0.78rem] faint">
            {t(lang, "weather_observed_through", { date: observedThrough })}
          </p>
        )}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-sm)] sm:grid-cols-4"
          style={{ background: "var(--glass-hairline)" }}>
        {stats.map((s) => (
          <div key={s.label} className="px-3.5 py-3" style={{ background: "var(--bg-0)" }}>
            <dt className="text-[0.72rem] faint">{s.label}</dt>
            <dd className="mt-1 text-[1.05rem] font-semibold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>

      {/* A grid cell is not a weather station on the farm, and saying so costs
          nothing while quietly implying otherwise would cost credibility. */}
      <p className="mt-2.5 text-[0.75rem] faint">
        {t(lang, "weather_grid_note")} · {WEATHER_SOURCE.name} ({WEATHER_SOURCE.license})
      </p>

      {cachedAt && (
        <p className="mt-1.5 text-[0.78rem]" style={{ color: "var(--warn)" }}>
          {t(lang, "weather_cached", { date: new Date(cachedAt).toLocaleDateString() })}
        </p>
      )}
    </section>
  );
}
