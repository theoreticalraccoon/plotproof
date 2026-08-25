/**
 * Route skeleton for the public verification page. It mirrors the document's
 * real shape — masthead stroke, headline, record rows, three ladder rungs —
 * so the page does not jump when the lot arrives. The accent stroke and the
 * hairlines are drawn for real rather than as placeholders: they are chrome,
 * not data, and pretending we do not know them yet would be theatre.
 */
import { Skeleton } from "@/components/motion/Skeleton";

export default function Loading() {
  return (
    <main
      className="mx-auto min-h-dvh w-full max-w-[46rem] px-5 pb-16 pt-8 sm:px-8 sm:pt-12"
      role="status"
      aria-busy="true"
      aria-label="Loading lot verification"
    >
      <div style={{ height: 3, width: 44, background: "var(--accent)" }} aria-hidden="true" />
      <Skeleton className="skeleton-sm mt-3 h-3 w-52" />

      <Skeleton className="mt-7 h-11 w-64 sm:h-14 sm:w-80" />
      <Skeleton className="mt-4 h-7 w-40" />
      <Skeleton className="skeleton-sm mt-7 h-2.5 w-20" />
      <Skeleton className="skeleton-sm mt-2 h-3.5 w-full max-w-sm" />

      <hr className="hairline mt-9" />

      <Skeleton className="skeleton-sm mt-8 h-3 w-40" />
      <div className="mt-2">
        {[14, 11, 13, 12, 15].map((w, i) => (
          <div
            key={i}
            className="grid grid-cols-1 gap-x-6 gap-y-1.5 py-3.5 sm:grid-cols-[14rem_1fr]"
            style={{ borderBottom: "1px solid var(--glass-hairline)" }}
          >
            <Skeleton className="skeleton-sm h-3.5" style={{ width: `${w * 0.7}rem`, maxWidth: "100%" }} />
            <Skeleton className="skeleton-sm h-4" style={{ width: `${8 + (i % 3) * 3}rem`, maxWidth: "100%" }} />
          </div>
        ))}
      </div>

      <hr className="hairline mt-9" />

      <Skeleton className="skeleton-sm mt-8 h-3 w-44" />
      <div
        className="mt-4 px-4 py-4 sm:px-5"
        style={{ border: "1px solid var(--glass-hairline)", borderRadius: "var(--radius-sm)" }}
      >
        <Skeleton className="skeleton-sm h-2.5 w-36" />
        <Skeleton className="skeleton-sm mt-3.5 h-3.5 w-full" />
        <Skeleton className="skeleton-sm mt-2 h-3.5 w-3/4" />
      </div>

      <hr className="hairline mt-9" />

      <Skeleton className="skeleton-sm mt-8 h-3 w-56" />
      <div className="mt-5 flex flex-col gap-3">
        {[
          { border: "3px solid var(--accent)", bg: "var(--accent-soft)", lines: 3 },
          { border: "3px solid var(--glass-hairline)", bg: "transparent", lines: 2 },
          { border: "3px dashed var(--fg-faint)", bg: "transparent", lines: 2 },
        ].map((rung, i) => (
          <div
            key={i}
            className="py-2 pl-4 sm:pl-5"
            style={{
              borderLeft: rung.border,
              background: rung.bg,
              borderRadius: i === 0 ? "0 var(--radius-sm) var(--radius-sm) 0" : undefined,
            }}
          >
            <Skeleton className="skeleton-sm h-2.5 w-24" />
            {Array.from({ length: rung.lines }).map((_, l) => (
              <Skeleton
                key={l}
                className="skeleton-sm mt-2 h-3.5"
                style={{ width: l === rung.lines - 1 ? "58%" : "96%" }}
              />
            ))}
          </div>
        ))}
      </div>

      <Skeleton className="mt-4 h-[60px] w-full" />
    </main>
  );
}
