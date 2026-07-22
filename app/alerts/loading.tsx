import { Skeleton, SkeletonList } from "@/components/motion/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 py-6 sm:px-8">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-7 w-44" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="mt-5">
        <SkeletonList count={4} lines={2} />
      </div>
    </main>
  );
}
