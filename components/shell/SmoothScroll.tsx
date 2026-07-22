"use client";

/**
 * Momentum / eased smooth scrolling via Lenis, the buttery inertia scroll that
 * makes premium sites feel fluid, instead of the OS's stepped wheel scroll. Runs
 * a single rAF loop, re-inits per route, and stays out of the way where it would
 * hurt: disabled under prefers-reduced-motion and on the full-screen /explore
 * map (which owns its own scroll). Inner scrollers opt out with
 * `data-lenis-prevent`.
 */
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";

export default function SmoothScroll() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (pathname.startsWith("/explore")) return;

    const lenis = new Lenis({
      lerp: 0.09, // lower = smoother glide
      wheelMultiplier: 1,
      smoothWheel: true,
      touchMultiplier: 1.6,
      anchors: true, // in-page #hash links glide smoothly too
    });

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, [pathname]);

  return null;
}
