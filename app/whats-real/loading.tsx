/**
 * Route skeleton for the honesty page. Mirrors the real column structure —
 * contents rail, numbered parts, term/description pairs — including the one
 * elevated block, so the long page settles into place instead of reflowing
 * under the reader.
 */
import { Skeleton } from "@/components/motion/Skeleton";

function EntryLines({ lines = 3 }: { lines?: number }) {
  return (
    <div>
      <Skeleton className="skeleton-sm h-4 w-56 max-w-full" />
      <div className="mt-2.5 flex flex-col gap-2" style={{ maxWidth: "68ch" }}>
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            className="skeleton-sm h-3.5"
            style={{ width: i === lines - 1 ? "54%" : `${100 - i * 4}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <main
      className="mx-auto min-h-dvh w-full max-w-5xl px-5 pb-20 pt-6 sm:px-8"
      role="status"
      aria-busy="true"
      aria-label="Loading the inventory of what is real"
    >
      <Skeleton className="skeleton-sm h-4 w-44" />

      <div className="mt-8">
        <div style={{ height: 3, width: 44, background: "var(--accent)" }} aria-hidden="true" />
        <Skeleton className="mt-5 h-12 w-full max-w-md sm:h-16" />
        <div className="mt-6 flex flex-col gap-2" style={{ maxWidth: "58ch" }}>
          <Skeleton className="skeleton-sm h-4 w-full" />
          <Skeleton className="skeleton-sm h-4 w-4/5" />
        </div>
      </div>

      <hr className="hairline mt-10" />

      <div className="grid gap-x-16 lg:grid-cols-[12rem_1fr]">
        <div className="hidden self-start lg:block" style={{ paddingTop: "2.5rem" }}>
          <Skeleton className="skeleton-sm h-2.5 w-20" />
          <div className="mt-5 flex flex-col gap-5">
            {[36, 28, 40].map((w, i) => (
              <Skeleton key={i} className="skeleton-sm h-3.5" style={{ width: `${w * 0.25}rem` }} />
            ))}
          </div>
        </div>

        <div className="min-w-0">
          <div className="mt-10">
            <Skeleton className="skeleton-sm h-5 w-52" />
            <div className="mt-6 flex flex-col gap-7">
              <EntryLines lines={3} />
              <EntryLines lines={3} />
              <EntryLines lines={4} />
            </div>
          </div>

          <div
            className="mt-14 px-5 py-7 sm:px-7 sm:py-8"
            style={{
              background: "var(--warn-soft)",
              borderLeft: "3px solid var(--warn)",
              borderRadius: "0 var(--radius) var(--radius) 0",
            }}
          >
            <Skeleton className="skeleton-sm h-5 w-64 max-w-full" />
            <div className="mt-6 flex flex-col gap-7">
              <EntryLines lines={4} />
              <EntryLines lines={3} />
            </div>
          </div>

          <div className="mt-14">
            <Skeleton className="skeleton-sm h-5 w-60 max-w-full" />
            <div className="mt-6 flex flex-col gap-7">
              <EntryLines lines={3} />
              <EntryLines lines={4} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
