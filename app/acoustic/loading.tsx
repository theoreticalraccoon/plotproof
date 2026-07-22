import { Skeleton } from "@/components/motion/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 py-6 sm:px-8">
      <div className="flex items-start gap-3">
        <Skeleton className="h-9 w-9" style={{ borderRadius: 12 }} />
        <div className="flex-1">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="mt-2 h-4 w-full max-w-md" />
        </div>
      </div>
      <div className="mt-6 glass-card p-4">
        <div className="flex flex-wrap gap-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20" />
          ))}
        </div>
        <Skeleton className="mt-3 h-44 w-full" />
      </div>
      <Skeleton className="mt-6 h-32 w-full" />
    </main>
  );
}
