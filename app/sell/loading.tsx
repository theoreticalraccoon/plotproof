import { Skeleton } from "@/components/motion/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-5 py-6 sm:px-8">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="mt-2 h-4 w-72" />
      <div className="mt-5 flex gap-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-1.5 flex-1" style={{ borderRadius: 999 }} />
        ))}
      </div>
      <div className="glass-card mt-5 p-5">
        <Skeleton className="h-5 w-40" />
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    </main>
  );
}
