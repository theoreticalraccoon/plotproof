import { Skeleton } from "@/components/motion/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-6 sm:px-6">
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="glass-card p-6 sm:p-8">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="mt-2 h-4 w-40" />
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-4" style={{ width: `${70 + (i % 3) * 10}%` }} />
          ))}
        </div>
        <Skeleton className="mt-6 h-28 w-full" />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="aspect-square w-full" />
        </div>
      </div>
    </main>
  );
}
