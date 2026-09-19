import { Skeleton, SkeletonList } from "@/components/motion/Skeleton";

// Root route-transition fallback, shown by Next while a route's code/data loads. A calm
// skeleton, not a spinner, so navigation feels instant + premium.
export default function Loading() {
  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 py-6 sm:px-8">
      <Skeleton className="h-7 w-52" />
      <Skeleton className="mt-2 h-4 w-72" />
      <div className="mt-6">
        <SkeletonList count={3} lines={2} />
      </div>
    </main>
  );
}
