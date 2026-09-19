/** Route skeleton for the privacy notice. */
import { Skeleton } from "@/components/motion/Skeleton";

function ClauseLines({ paras = [3, 2] }: { paras?: number[] }) {
  return (
    <div className="mt-12">
      <Skeleton className="skeleton-sm h-5 w-56 max-w-full" />
      <div className="mt-4 flex flex-col gap-4" style={{ maxWidth: "68ch" }}>
        {paras.map((lines, p) => (
          <div key={p} className="flex flex-col gap-2">
            {Array.from({ length: lines }).map((_, i) => (
              <Skeleton
                key={i}
                className="skeleton-sm h-3.5"
                style={{ width: i === lines - 1 ? "61%" : `${99 - i * 5}%` }}
              />
            ))}
          </div>
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
      aria-label="Loading the privacy notice"
    >
      <Skeleton className="skeleton-sm h-4 w-36" />

      <div className="mt-8">
        <div style={{ height: 3, width: 44, background: "var(--accent)" }} aria-hidden="true" />
        <Skeleton className="mt-5 h-12 w-full max-w-sm sm:h-16" />
        <Skeleton className="skeleton-sm mt-6 h-4 w-full" style={{ maxWidth: "42ch" }} />
      </div>

      <hr className="hairline mt-10" />

      <div className="grid gap-x-16 lg:grid-cols-[12rem_1fr]">
        <div className="hidden self-start lg:block" style={{ paddingTop: "2.5rem" }}>
          <Skeleton className="skeleton-sm h-2.5 w-20" />
          <div className="mt-5 flex flex-col gap-5">
            {[8, 7, 7.5, 8.5, 7, 9].map((w, i) => (
              <Skeleton key={i} className="skeleton-sm h-3.5" style={{ width: `${w}rem` }} />
            ))}
          </div>
        </div>

        <div className="min-w-0">
          <ClauseLines paras={[1, 4, 3]} />
          <ClauseLines paras={[3, 3, 3]} />
          <ClauseLines paras={[2, 4]} />
          <ClauseLines paras={[3]} />
        </div>
      </div>
    </main>
  );
}
