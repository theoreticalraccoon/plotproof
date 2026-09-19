"use client";

/**
 * The soil-probe surface: connect, calibrate, watch, save.
 *
 * Four things this screen has to get right, in order of how badly each would
 * hurt if it were wrong:
 *
 *  1. A simulated trace must be impossible to mistake for a real one. Every
 *     reading carries its source into storage, the trace is labelled while it
 *     runs, and the label does not disappear when the reading is saved.
 *  2. An uncalibrated probe must not produce a water content. The raw count is
 *     shown because it is the measurement; VWC stays blank, with the reason.
 *  3. A bad calibration must be refused, not averaged away. Anchors captured the
 *     wrong way round, or too close together, are named as the specific mistake
 *     they are.
 *  4. Nothing is written to the plot's trace until the farmer says so. A live
 *     preview that silently persists would make every fumbled calibration
 *     permanent.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Usb, Radio, Trash2, Save, CircleDot } from "lucide-react";
import { t, type Lang } from "@/lib/i18n";
import {
  connectSensor,
  isSerialSupported,
  simulateSensor,
  type SerialConnection,
  type SerialStatus,
} from "@/lib/sensor/serial";
import type { SensorFrame } from "@/lib/sensor/protocol";
import { checkCalibration, medianRaw, rawToVwc, MIN_ANCHOR_SPREAD } from "@/lib/sensor/calibrate";
import { addSensorReadings, getCalibration, saveCalibration, clearCalibration } from "@/lib/grow/store";
import { isPlausibleVwc } from "@/lib/grow/sensorGuard";
import type { ProbeCalibration, SensorReading, SensorSource } from "@/lib/grow/growTypes";

/** How many recent frames a calibration anchor is taken from. */
const ANCHOR_WINDOW = 12;
/** How many frames the live trace keeps on screen. */
const TRACE_WINDOW = 90;

export default function SensorPanel({
  plotId,
  lang,
  onSaved,
}: {
  plotId: string;
  lang: Lang;
  onSaved: () => void;
}) {
  const [status, setStatus] = useState<SerialStatus>("idle");
  const [detail, setDetail] = useState<string | null>(null);
  const [source, setSource] = useState<SensorSource>("magicbit");
  const [frames, setFrames] = useState<SensorFrame[]>([]);
  const [cal, setCal] = useState<ProbeCalibration | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const conn = useRef<SerialConnection | null>(null);
  const supported = useMemo(() => isSerialSupported(), []);

  useEffect(() => {
    setCal(getCalibration(plotId));
  }, [plotId]);

  // Release the port if the component goes away mid-stream, or the port stays
  // claimed until the tab is closed and the next connect fails confusingly.
  useEffect(() => {
    return () => {
      void conn.current?.close();
      conn.current = null;
    };
  }, []);

  const handlers = useMemo(
    () => ({
      onFrame: (f: SensorFrame) => setFrames((prev) => [...prev.slice(-(TRACE_WINDOW - 1)), f]),
      onStatus: (s: SerialStatus, d?: string) => {
        setStatus(s);
        setDetail(d ?? null);
      },
    }),
    [],
  );

  const start = useCallback(
    async (kind: SensorSource) => {
      await conn.current?.close();
      setFrames([]);
      setSavedCount(null);
      setSource(kind);
      conn.current =
        kind === "simulated" ? simulateSensor(handlers) : await connectSensor(handlers);
    },
    [handlers],
  );

  const stop = useCallback(async () => {
    await conn.current?.close();
    conn.current = null;
  }, []);

  const streaming = status === "streaming";
  const latest = frames[frames.length - 1] ?? null;
  const check = checkCalibration(cal);
  const latestVwc = latest ? rawToVwc(latest.raw, cal) : null;

  const captureAnchor = useCallback(
    (which: "dry" | "wet") => {
      const window = frames.slice(-ANCHOR_WINDOW).map((f) => f.raw);
      const median = medianRaw(window);
      if (median === null) return;
      const next: ProbeCalibration = {
        plotId,
        dryRaw: which === "dry" ? median : (cal?.dryRaw ?? 0),
        wetRaw: which === "wet" ? median : (cal?.wetRaw ?? 0),
        capturedAt: new Date().toISOString(),
      };
      saveCalibration(next);
      setCal(next);
    },
    [frames, cal, plotId],
  );

  const save = useCallback(async () => {
    if (frames.length === 0) return;
    setSaving(true);
    try {
      const now = Date.now();
      const rows: SensorReading[] = frames.map((f, i) => ({
        plotId,
        // Space the stored timestamps over the window that was actually
        // observed, so a saved trace reads as a trace rather than a spike.
        at: new Date(now - (frames.length - 1 - i) * 1000).toISOString(),
        raw: f.raw,
        vwc: rawToVwc(f.raw, cal),
        source,
      }));
      await addSensorReadings(rows);
      setSavedCount(rows.length);
      onSaved();
    } finally {
      setSaving(false);
    }
  }, [frames, cal, plotId, source, onSaved]);

  return (
    <div className="space-y-6">
      {/* ---------- connect ---------- */}
      <section className="glass-card p-5" aria-labelledby="sensor-connect-heading">
        <h2 id="sensor-connect-heading" className="text-[1.1rem] font-semibold">
          {t(lang, "sensor_connect_title")}
        </h2>
        <p className="mt-2 text-[0.85rem] muted" style={{ maxWidth: "56ch" }}>
          {t(lang, "sensor_connect_body")}
        </p>

        {!supported && (
          <div
            className="mt-4 rounded-[var(--radius-sm)] px-4 py-3.5 text-[0.88rem]"
            style={{ background: "var(--warn-soft)", borderLeft: "3px solid var(--warn)" }}
          >
            {t(lang, "sensor_unsupported")}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary min-h-[48px] inline-flex items-center gap-2"
            disabled={!supported || streaming || status === "connecting"}
            onClick={() => void start("magicbit")}
          >
            <Usb size={16} aria-hidden="true" />
            {status === "connecting" ? t(lang, "sensor_connecting") : t(lang, "sensor_connect")}
          </button>
          <button
            type="button"
            className="btn btn-ghost min-h-[48px] inline-flex items-center gap-2"
            disabled={streaming || status === "connecting"}
            onClick={() => void start("simulated")}
          >
            <Radio size={15} aria-hidden="true" />
            {t(lang, "sensor_simulate")}
          </button>
          {streaming && (
            <button type="button" className="btn btn-ghost min-h-[48px]" onClick={() => void stop()}>
              {t(lang, "sensor_stop")}
            </button>
          )}
        </div>

        {status === "error" && detail && detail !== "cancelled" && (
          <p className="mt-3 text-[0.82rem]" style={{ color: "var(--danger)" }} lang="en">
            {detail === "unsupported" ? t(lang, "sensor_unsupported") : detail}
          </p>
        )}

        {/* A simulated trace must never be mistakable for hardware. */}
        {streaming && source === "simulated" && (
          <p
            className="mt-4 rounded-[var(--radius-sm)] px-4 py-3 text-[0.85rem] font-medium"
            style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
          >
            {t(lang, "sensor_simulated_warning")}
          </p>
        )}
      </section>

      {/* ---------- live ---------- */}
      {frames.length > 0 && (
        <section className="glass-card p-5" aria-labelledby="sensor-live-heading" aria-live="polite">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="sensor-live-heading" className="min-w-0 text-[1.1rem] font-semibold">
              {t(lang, "sensor_live_title")}
            </h2>
            {streaming && (
              <span className="shrink-0 inline-flex items-center gap-1.5 text-[0.78rem]" style={{ color: "var(--accent)" }}>
                <CircleDot size={12} aria-hidden="true" />
                {t(lang, source === "simulated" ? "sensor_source_simulated" : "sensor_source_magicbit")}
              </span>
            )}
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-sm)]"
              style={{ background: "var(--glass-hairline)" }}>
            <Cell label={t(lang, "sensor_raw")} value={latest ? String(latest.raw) : "—"} />
            <Cell
              label={t(lang, "sensor_vwc")}
              value={latestVwc != null ? latestVwc.toFixed(3) : "—"}
              tone={latestVwc == null ? "faint" : undefined}
            />
          </dl>

          {/* The raw trace, drawn from the counts themselves. No smoothing. */}
          <Sparkline frames={frames} />

          {latestVwc == null && (
            <p className="mt-3 text-[0.82rem]" style={{ color: "var(--warn)" }}>
              {t(lang, `sensor_cal_${check.problem ?? "missing"}`)}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn btn-primary min-h-[44px] inline-flex items-center gap-2"
              disabled={saving || frames.length === 0}
              onClick={() => void save()}
            >
              <Save size={15} aria-hidden="true" />
              {t(lang, "sensor_save", { n: frames.length })}
            </button>
            {savedCount !== null && (
              <span className="text-[0.82rem]" style={{ color: "var(--accent)" }}>
                {t(lang, "sensor_saved", { n: savedCount })}
              </span>
            )}
          </div>
          <p className="mt-2 text-[0.78rem] faint" style={{ maxWidth: "56ch" }}>
            {t(lang, "sensor_save_note")}
          </p>
        </section>
      )}

      {/* ---------- calibration ---------- */}
      <section className="glass-card p-5" aria-labelledby="sensor-cal-heading">
        <h2 id="sensor-cal-heading" className="text-[1.1rem] font-semibold">
          {t(lang, "sensor_cal_title")}
        </h2>
        <p className="mt-2 text-[0.85rem] muted" style={{ maxWidth: "56ch" }}>
          {t(lang, "sensor_cal_body")}
        </p>

        <ol className="mt-4 space-y-2 text-[0.85rem]">
          <li>1. {t(lang, "sensor_cal_step_dry")}</li>
          <li>2. {t(lang, "sensor_cal_step_wet")}</li>
          <li>3. {t(lang, "sensor_cal_step_soil")}</li>
        </ol>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-ghost min-h-[44px]"
            disabled={frames.length < ANCHOR_WINDOW}
            onClick={() => captureAnchor("dry")}
          >
            {t(lang, "sensor_capture_dry")}
          </button>
          <button
            type="button"
            className="btn btn-ghost min-h-[44px]"
            disabled={frames.length < ANCHOR_WINDOW}
            onClick={() => captureAnchor("wet")}
          >
            {t(lang, "sensor_capture_wet")}
          </button>
          {cal && (
            <button
              type="button"
              className="btn btn-ghost min-h-[44px] inline-flex items-center gap-2"
              onClick={() => {
                clearCalibration(plotId);
                setCal(null);
              }}
            >
              <Trash2 size={14} aria-hidden="true" />
              {t(lang, "sensor_cal_clear")}
            </button>
          )}
        </div>

        {frames.length < ANCHOR_WINDOW && (
          <p className="mt-3 text-[0.8rem] faint">
            {t(lang, "sensor_cal_need_stream", { n: ANCHOR_WINDOW })}
          </p>
        )}

        {cal && (
          <dl className="mt-4 grid gap-x-5 gap-y-1.5 text-[0.82rem] sm:grid-cols-[10rem_1fr]">
            <dt className="faint">{t(lang, "sensor_cal_dry")}</dt>
            <dd className="tabular-nums">{cal.dryRaw || "—"}</dd>
            <dt className="faint">{t(lang, "sensor_cal_wet")}</dt>
            <dd className="tabular-nums">{cal.wetRaw || "—"}</dd>
            <dt className="faint">{t(lang, "sensor_cal_spread")}</dt>
            <dd className="tabular-nums">
              {check.spread}{" "}
              <span className="faint">
                {t(lang, "sensor_cal_spread_min", { n: MIN_ANCHOR_SPREAD })}
              </span>
            </dd>
            <dt className="faint">{t(lang, "sensor_cal_status")}</dt>
            <dd style={{ color: check.ok ? "var(--accent)" : "var(--warn)" }}>
              {check.ok ? t(lang, "sensor_cal_ok") : t(lang, `sensor_cal_${check.problem}`)}
            </dd>
          </dl>
        )}

        <p className="mt-4 text-[0.78rem] faint" style={{ maxWidth: "58ch" }}>
          {t(lang, "sensor_cal_caveat")}
        </p>
      </section>
    </div>
  );
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: "faint" }) {
  return (
    <div className="px-3.5 py-3" style={{ background: "var(--bg-0)" }}>
      <dt className="text-[0.7rem] faint">{label}</dt>
      <dd
        className="mt-1 text-[1.05rem] font-semibold tabular-nums"
        style={{ color: tone === "faint" ? "var(--fg-faint)" : undefined }}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * The raw trace as an SVG polyline.
 *
 * Raw counts, not calibrated values: this is the measurement, and it is the
 * thing that reveals a probe that has come loose or a cable that is failing.
 * Auto-scaled to the window, with the range printed, because a sparkline with
 * no scale can make 20 counts of noise look like a drought.
 */
function Sparkline({ frames }: { frames: SensorFrame[] }) {
  const values = frames.map((f) => f.raw);
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * 100},${30 - ((v - min) / span) * 28 - 1}`)
    .join(" ");

  return (
    <div className="mt-4">
      <svg
        viewBox="0 0 100 30"
        preserveAspectRatio="none"
        className="h-16 w-full rounded-[var(--radius-sm)]"
        style={{ background: "var(--bg-1)" }}
        role="img"
        aria-label={`Raw probe trace, ${values.length} samples, range ${min} to ${max}`}
      >
        <polyline
          points={points}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="0.8"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <p className="mt-1 flex justify-between text-[0.7rem] faint tabular-nums">
        <span>{min}</span>
        <span>{values.length} samples</span>
        <span>{max}</span>
      </p>
    </div>
  );
}

/** Re-exported for the page's "is this reading usable" note. */
export { isPlausibleVwc };
