import { Skeleton, SkeletonList } from "@/components/motion/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-5 py-6 sm:px-8">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="mt-2 h-4 w-72" />
      <Skeleton className="mt-5 h-16 w-full" />
      <div className="mt-5">
        <SkeletonList count={4} lines={2} />
      </div>
    </main>
  );
}
