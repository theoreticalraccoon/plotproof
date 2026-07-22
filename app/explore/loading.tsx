import { Skeleton } from "@/components/motion/Skeleton";

export default function Loading() {
  return (
    <div className="flex h-[calc(100dvh-var(--nav-h))] flex-col">
      <div className="glass-nav flex items-center gap-3 px-4 py-3">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="ml-auto h-9 w-36" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <Skeleton className="min-h-0 flex-1" style={{ borderRadius: 0 }} />
        <div className="w-full space-y-3 p-4 md:w-96">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </div>
  );
}
