"use client";

/** Global route-change progress bar, pinned under the nav. */
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { t, useLang } from "@/lib/i18n";

export default function NavProgress() {
  const pathname = usePathname();
  const lang = useLang();
  const [active, setActive] = useState(false);
  const startedAt = useRef(0);

  // Capture phase, so a handler that stops propagation upstream cannot hide the navigation from
  // us.
  useEffect(() => {
    const onClick = (e: globalThis.MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      // Read the attribute rather than a.href so mailto:/tel: and SVG anchors fall out here
      // instead of throwing.
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      // A hash or query change on the same path is not a route change, and an external host
      // leaves the app entirely: neither is ours to report.
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      startedAt.current = Date.now();
      setActive(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Route landed. Hold briefly so an instant client-side navigation reads as a completed pass
  // rather than a flicker.
  useEffect(() => {
    if (!active) return;
    const id = setTimeout(() => setActive(false), Math.max(0, 260 - (Date.now() - startedAt.current)));
    return () => clearTimeout(id);
    // Intentionally keyed on pathname alone: arming happens in the click
    // handler, this effect exists only to observe the landing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Failsafe: a navigation that never lands (cancelled, blocked by a guard) must not leave a bar
  // on screen claiming work that stopped happening.
  useEffect(() => {
    if (!active) return;
    const id = setTimeout(() => setActive(false), 8000);
    return () => clearTimeout(id);
  }, [active]);

  if (!active) return null;
  return (
    <>
      <div className="nav-progress print:hidden" aria-hidden="true">
        <div className="nav-progress-bar" />
      </div>
      <span role="status" aria-live="polite" className="sr-only">
        {t(lang, "loading")}
      </span>
    </>
  );
}
