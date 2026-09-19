"use client";

/** Route-change transition. */
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export default function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-in flex flex-1 flex-col">
      {children}
    </div>
  );
}
