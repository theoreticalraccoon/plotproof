import { Skeleton } from "@/components/motion/Skeleton";

export default function Loading() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-5 py-6 sm:px-8">
      <Skeleton className="h-4 w-52" />
      <Skeleton className="mt-8 h-10 w-56" />
      <Skeleton className="mt-4 h-14 w-full" />
      <Skeleton className="mt-8 h-44 w-full" />
    </main>
  );
}
