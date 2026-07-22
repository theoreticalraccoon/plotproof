import { Skeleton, SkeletonList } from "@/components/motion/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto min-h-dvh max-w-3xl px-5 py-6 sm:px-8">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="mt-2 h-4 w-80" />
      <Skeleton className="mt-4 h-12 w-full" />
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-10 w-52" />
        <Skeleton className="h-10 w-44" />
      </div>
      <Skeleton className="mt-4 h-64 w-full" />
      <div className="mt-6">
        <SkeletonList count={3} lines={1} />
      </div>
    </main>
  );
}
