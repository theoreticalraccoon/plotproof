"use client";

// Shimmering skeleton placeholder (see .skeleton in globals.css). Reserves layout so async
// content swaps in without shift (CLS), and the shimmer stops under prefers-reduced-motion.

export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

/** A glass card of stacked skeleton lines, the generic "loading a list row" unit. */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="glass-card p-4" aria-hidden="true">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-16" style={{ borderRadius: 999 }} />
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-3.5" style={{ width: `${90 - i * 12}%` }} />
        ))}
      </div>
    </div>
  );
}

/** N skeleton cards, for list loading states. */
export function SkeletonList({ count = 3, lines = 3 }: { count?: number; lines?: number }) {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={lines} />
      ))}
    </div>
  );
}

// Stacked text lines with varied widths, so a paragraph placeholder reads as prose rather than
// a stack of identical bars.
export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  // Widths cycle rather than shrink monotonically: real paragraphs are ragged, and only the LAST
  // line is reliably short.
  const widths = ["100%", "92%", "97%", "88%"];
  return (
    <div className={`flex flex-col gap-2 ${className}`} role="status" aria-label="Loading text" aria-busy="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="skeleton-sm h-3.5"
          style={{ width: i === lines - 1 ? "62%" : widths[i % widths.length] }}
        />
      ))}
    </div>
  );
}

/** A single sized block: size it with height/width classes or an inline style. */
export function SkeletonBlock({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <Skeleton className={className} style={style} />;
}

/** Big number + label pair, matching the metric tiles used across the app. */
export function SkeletonStat() {
  return (
    <div role="status" aria-label="Loading statistic" aria-busy="true">
      <Skeleton className="skeleton-sm h-8 w-24" />
      <Skeleton className="skeleton-sm mt-2 h-3 w-16" />
    </div>
  );
}

// Header row + body rows inside the real .data-wrap shell, so the table does not resize when
// the data arrives.
export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="data-wrap" role="status" aria-label="Loading table" aria-busy="true">
      <div className="flex gap-3 px-3 py-2.5" style={{ background: "var(--bg-1)" }}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="skeleton-sm h-3.5 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3 px-3 py-3" style={{ borderTop: "1px solid var(--glass-hairline)" }}>
          {Array.from({ length: cols }).map((_, c) => (
            // First column reads as the row's label, so it stays full width.
            <Skeleton key={c} className="skeleton-sm h-3.5 flex-1" style={{ opacity: c === 0 ? 1 : 0.82 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

// Map-shaped placeholder. The centered hint matters: a blank rectangle where a map belongs is
// indistinguishable from a map that failed to load.
export function SkeletonMap({ className = "", label = "Loading map" }: { className?: string; label?: string }) {
  return (
    <div
      className={`skeleton skeleton-lg relative min-h-48 w-full ${className}`}
      role="status"
      aria-label={label}
      aria-busy="true"
    >
      <span className="absolute inset-0 z-10 flex items-center justify-center gap-2 text-xs" style={{ color: "var(--fg-faint)" }}>
        <span className="spinner" aria-hidden="true" />
        {label}
      </span>
    </div>
  );
}
