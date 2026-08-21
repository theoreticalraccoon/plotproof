import { Skeleton } from "@/components/motion/Skeleton";

/** Drawn at the real card's dimensions so the form does not jump into place. */
export default function SignupLoading() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[27rem] flex-col justify-center px-6 py-12">
      <div className="mb-7 flex items-center justify-between gap-3">
        <Skeleton className="skeleton-sm h-8 w-32" />
        <Skeleton className="skeleton-sm h-8 w-20" />
      </div>
      <div className="glass-card p-7 sm:p-8" role="status" aria-label="Loading" aria-busy="true">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="skeleton-sm mt-3 h-4 w-full" />
        <div className="mt-7 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="skeleton-sm h-3 w-14" />
            <Skeleton className="h-11 w-full" />
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="skeleton-sm h-3 w-20" />
            <Skeleton className="h-11 w-full" />
          </div>
          <Skeleton className="mt-1 h-13 w-full" style={{ height: 52 }} />
        </div>
      </div>
    </main>
  );
}
