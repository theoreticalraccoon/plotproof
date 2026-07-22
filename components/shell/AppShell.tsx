"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import Nav from "./Nav";
import Footer from "./Footer";
import PageTransition from "./PageTransition";
import AmbientBackground from "./AmbientBackground";
import { ToastProvider } from "./Toast";
import { CommandPaletteProvider } from "./CommandPalette";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import AuthGate from "./AuthGate";
import SmoothScroll from "./SmoothScroll";
import ScrollProgress from "@/components/motion/ScrollProgress";
import { t, useLang } from "@/lib/i18n";

// /explore is a full-height, self-contained map app (its own internal scroll
// regions), a marketing footer pushed below it would just add a dead scroll
// area, so it's the one route that opts out.
const NO_FOOTER = new Set(["/explore"]);

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const lang = useLang();
  const showFooter = !NO_FOOTER.has(pathname);

  return (
    <AuthProvider>
    <ToastProvider>
      <CommandPaletteProvider>
        <div className="flex min-h-dvh flex-col">
          <a href="#main" className="skip-link">
            {t(lang, "skip_to_content")}
          </a>
          <GlassFilter />
          <SmoothScroll />
          <ScrollProgress />
          <AmbientBackground />
          <Nav />
          <main id="main" className="flex flex-1 flex-col">
            <PageTransition>
              <AuthGate>{children}</AuthGate>
            </PageTransition>
          </main>
          {showFooter && <Footer />}
        </div>
      </CommandPaletteProvider>
    </ToastProvider>
    </AuthProvider>
  );
}

/**
 * The authentic Apple-style liquid-glass refraction filter (from 21st.dev's
 * "Liquid Glass Card" by designali-in / ui.dalim.in): fractal-noise turbulence,
 * blurred, drives a displacement map so whatever sits behind a `.lg` surface
 * bends like real glass. Injected once here and referenced via
 * `backdrop-filter: url(#lg-filter)`. Reserved for signature surfaces, the
 * everyday .glass rim-lighting doesn't need it.
 */
function GlassFilter() {
  return (
    <svg aria-hidden="true" className="pointer-events-none fixed h-0 w-0">
      <defs>
        <filter id="lg-filter" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.012" numOctaves={2} seed={7} result="noise" />
          <feGaussianBlur in="noise" stdDeviation={2} result="blurred" />
          <feDisplacementMap in="SourceGraphic" in2="blurred" scale={70} xChannelSelector="R" yChannelSelector="B" />
        </filter>
      </defs>
    </svg>
  );
}
