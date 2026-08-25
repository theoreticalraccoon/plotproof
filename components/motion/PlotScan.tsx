"use client";

/**
 * Cinematic hero graphic: a satellite scanning and tracing a farm plot, the
 * product's signature move (map a boundary, run analysis, produce the EUDR
 * evidence). Entirely self-contained (animated SVG + framer-motion, no external
 * or stock assets), and deliberately a *stylised illustration*, not real
 * imagery of a real plot, so it never implies fabricated data. Layered, looping,
 * physics-timed motion in the Skiper/animaster spirit; degrades to a clean
 * static frame under prefers-reduced-motion.
 */
import { motion, useReducedMotion } from "framer-motion";
import { Satellite, ShieldCheck } from "lucide-react";
import { t, useLang } from "@/lib/i18n";

// An irregular, field-like boundary in a 0..360 viewBox.
const VERTS: [number, number][] = [
  [66, 128],
  [206, 84],
  [316, 150],
  [292, 276],
  [150, 312],
  [58, 224],
];
const PATH = VERTS.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ") + " Z";
const EASE = [0.16, 1, 0.3, 1] as const;

export default function PlotScan() {
  const lang = useLang();
  const reduce = useReducedMotion();

  return (
    <div className="glass-card glass-glow relative aspect-square w-full overflow-hidden">
      {/* Caption overline. The satellite glyph is the label's own mark, not
          decoration, so it is the only icon left inside the frame. */}
      <div
        className="absolute left-5 top-5 z-20 flex items-center gap-2 text-[0.68rem] font-semibold"
        style={{ color: "var(--fg-faint)", textTransform: lang === "en" ? "uppercase" : "none", letterSpacing: lang === "en" ? "0.14em" : "0.01em" }}
      >
        <Satellite size={13} aria-hidden="true" style={{ color: "var(--accent)" }} />
        {t(lang, "hero_scan_caption")}
      </div>

      <svg viewBox="0 0 360 360" className="absolute inset-0 h-full w-full" role="img" aria-label={t(lang, "hero_scan_caption")}>
        <defs>
          <radialGradient id="ps-fill" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
          </radialGradient>
        </defs>

        {/* topographic grid */}
        <g stroke="var(--glass-hairline)" strokeWidth="1">
          {Array.from({ length: 9 }).map((_, i) => (
            <line key={`v${i}`} x1={i * 45} y1="0" x2={i * 45} y2="360" />
          ))}
          {Array.from({ length: 9 }).map((_, i) => (
            <line key={`h${i}`} x1="0" y1={i * 45} x2="360" y2={i * 45} />
          ))}
        </g>

        {/* plot fill, fades in after the outline draws */}
        <motion.path
          d={PATH}
          fill="url(#ps-fill)"
          stroke="none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: reduce ? 0 : 1.4, ease: "easeOut" }}
        />

        {/* boundary trace draws on */}
        <motion.path
          d={PATH}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: reduce ? 0 : 1.6, ease: EASE }}
        />

        {/* a signal pulse travelling around the perimeter (skip if reduced) */}
        {!reduce && (
          <motion.path
            d={PATH}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="3"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="0.12 0.88"
            initial={{ strokeDashoffset: 0, opacity: 0 }}
            animate={{ strokeDashoffset: [0, -1], opacity: [0, 1, 1, 0.6] }}
            transition={{ strokeDashoffset: { duration: 3.4, repeat: Infinity, ease: "linear", delay: 1.8 }, opacity: { duration: 0.6, delay: 1.8 } }}
          />
        )}

        {/* vertex nodes + pulsing rings */}
        {VERTS.map(([x, y], i) => (
          <g key={i}>
            {!reduce && (
              <motion.circle
                cx={x}
                cy={y}
                r={4}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="1.5"
                initial={{ r: 4, opacity: 0 }}
                animate={{ r: [4, 13], opacity: [0.6, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut", delay: 1.6 + i * 0.28 }}
              />
            )}
            <motion.circle
              cx={x}
              cy={y}
              r={3.4}
              fill="var(--accent)"
              initial={reduce ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, delay: reduce ? 0 : 0.3 + i * 0.22, ease: EASE }}
              style={{ transformOrigin: `${x}px ${y}px` }}
            />
          </g>
        ))}
      </svg>

      {/* The floating satellite chip that used to sit top-right was a third
          overlay competing with the caption and the badge, and it was an icon
          in a box carrying no information the caption did not already give.
          The sweeping beam is the scan; it does not need a source drawn in. */}

      {/* scanning beam sweeping top -> bottom (transform-only, GPU friendly) */}
      {!reduce && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, transparent 3%, var(--accent-ring) 8%, var(--accent-soft) 10%, transparent 15%)",
          }}
          initial={{ y: "-15%" }}
          animate={{ y: "115%" }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 1.6 }}
        />
      )}

      {/* verified badge, resolves after the scan */}
      <motion.div
        className="glass absolute bottom-5 left-5 z-20 flex items-center gap-2 px-3 py-1.5 text-xs font-semibold"
        style={{ color: "var(--accent)" }}
        initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: reduce ? 0 : 2.4, ease: EASE }}
      >
        <ShieldCheck size={14} />
        {t(lang, "hero_scan_badge")}
      </motion.div>
    </div>
  );
}
