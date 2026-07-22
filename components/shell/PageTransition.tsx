"use client";

/**
 * Route-change transition. Deliberately CSS-only and NON-blocking: the old
 * `mode="wait"` AnimatePresence made every navigation wait ~250ms for the old
 * page to animate out before the new one rendered, which read as sluggish. Now
 * the new page mounts instantly (keyed by pathname) and just fades up via a
 * cheap CSS animation (`.page-in` in globals.css), no framer-motion on the
 * always-mounted navigation path, and it collapses to instant under
 * prefers-reduced-motion via the global reduced-motion rule.
 */
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
