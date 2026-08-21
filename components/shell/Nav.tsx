"use client";

/**
 * Persistent app navigation. Present on every route (wired in AppShell) so no
 * workflow, including the document generators, which used to strand a farmer
 * mid-print with no way back, can trap a user. Desktop: horizontal links with
 * an active-route indicator. Mobile: a full-height animated drawer.
 *
 * Every link here is a PendingLink: this is the one component every route
 * change in the app passes through, so a tap that is waiting on a route bundle
 * has to say so inline rather than leaving the user to tap again.
 */
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { Leaf, Menu, X, Search, Sprout, FileText, Satellite, MapPin } from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import PendingLink from "@/components/motion/PendingLink";
import { useCommandPalette } from "./CommandPalette";
import AccountControl from "./AccountControl";
import { t, useLang } from "@/lib/i18n";
import { EASE_IN_OUT, EASE_OUT_2 } from "@/lib/motion/variants";
import type { Variants } from "framer-motion";

const LINKS = [
  { href: "/sell", key: "nav_sell", Icon: Sprout },
  { href: "/documents", key: "nav_documents", Icon: FileText },
  { href: "/intake", key: "nav_evidence", Icon: Satellite },
  { href: "/explore", key: "nav_explore", Icon: MapPin },
] as const;

/**
 * Local, deliberately faster than the shared `drawerSlide` (450ms in): a menu
 * is a direct answer to a tap, so any travel long enough to notice reads as the
 * tap having missed. 200ms in / 150ms out is under the threshold where a panel
 * stops feeling attached to the finger. Kept here rather than edited in
 * lib/motion/variants.ts because the slower curve is right for content panels.
 */
const drawerSlideFast: Variants = {
  hidden: { x: "100%" },
  show: { x: 0, transition: { duration: 0.2, ease: EASE_OUT_2 } },
  exit: { x: "100%", transition: { duration: 0.15, ease: EASE_IN_OUT } },
};
const drawerFade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.12 } },
};
const backdropFast: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.12 } },
};

const FOCUSABLE = 'a[href],button:not(:disabled),[tabindex]:not([tabindex="-1"])';

export default function Nav() {
  const lang = useLang();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const { open: openCmd } = useCommandPalette();
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  // Close the drawer automatically on route change.
  useEffect(() => setOpen(false), [pathname]);
  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Dismissal that a person chose (Esc, backdrop) hands focus back to the
  // trigger. A route change does NOT: focus belongs to the page that just
  // loaded, not to a menu button the user has already left behind.
  const dismiss = useCallback(() => {
    setOpen(false);
    menuBtnRef.current?.focus();
  }, []);

  // Focus moves into the drawer and stays there: an off-canvas panel that
  // leaves Tab wandering through the page behind it is invisible to a keyboard
  // user and unreachable to a screen reader.
  useEffect(() => {
    if (!open) return;
    const node = drawerRef.current;
    node?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        dismiss();
        return;
      }
      if (e.key !== "Tab" || !node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

  const isActive = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <header className="glass-nav sticky top-0 z-40 print:hidden">
      <div className="mx-auto flex h-[var(--nav-h)] max-w-6xl items-center gap-4 px-5 sm:px-8">
        {/* No `gap` on the anchor: PendingLink wraps its children in a single
            flex span, so the badge carries its own spacing. */}
        <PendingLink
          href="/"
          className="flex items-center font-semibold tracking-tight transition-transform active:scale-95"
        >
          <span
            className="mr-2 flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
          >
            <Leaf size={17} strokeWidth={2.25} />
          </span>
          <span>PlotProof</span>
        </PendingLink>

        <nav className="ml-1 hidden items-center gap-0.5 md:flex" aria-label="Primary">
          {LINKS.map((l) => {
            const active = isActive(l.href);
            return (
              <PendingLink
                key={l.href}
                href={l.href}
                className="relative inline-flex items-center rounded-lg px-2.5 py-2 text-sm font-medium transition-colors hover:text-[var(--fg)]"
                style={{ color: active ? "var(--accent)" : "var(--fg-muted)" }}
              >
                <span className="flex items-center gap-1.5" aria-current={active ? "page" : undefined}>
                  <l.Icon size={15} aria-hidden="true" />
                  {t(lang, l.key)}
                </span>
                {active && (
                  <motion.span
                    layoutId={reduce ? undefined : "nav-active"}
                    aria-hidden="true"
                    // right-8 = the link's own px-2.5 plus the 1.5rem spinner
                    // slot PendingLink always reserves, so the rule tracks the
                    // label rather than the label plus dead space.
                    className="absolute bottom-[-1px] left-2.5 right-8 h-0.5 rounded-full"
                    style={{ background: "var(--accent)" }}
                    transition={{ duration: 0.25, ease: EASE_OUT_2 }}
                  />
                )}
              </PendingLink>
            );
          })}
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          <button
            type="button"
            onClick={openCmd}
            aria-label={t(lang, "cmd_open")}
            className="inline-flex min-h-[38px] items-center gap-2 rounded-lg border py-1.5 pl-2.5 pr-2 text-sm faint transition-[color,border-color,transform] duration-150 hover:text-[var(--fg)] hover:border-[var(--accent-ring)] active:scale-[0.97]"
            style={{ borderColor: "var(--glass-border)", background: "var(--glass)" }}
          >
            <Search size={15} aria-hidden="true" />
            <span>{t(lang, "cmd_open")}</span>
            <kbd
              className="rounded px-1.5 py-0.5 text-[0.68rem] font-semibold"
              style={{ background: "var(--glass-hairline)", color: "var(--fg-faint)" }}
            >
              ⌘K
            </kbd>
          </button>
          <LanguageSwitcher />
          <AccountControl />
        </div>

        <div className="ml-auto flex items-center gap-1 md:hidden">
          <button
            type="button"
            onClick={openCmd}
            aria-label={t(lang, "cmd_open")}
            className="btn btn-ghost btn-sm !px-2.5"
          >
            <Search size={18} aria-hidden="true" />
          </button>
          <button
            ref={menuBtnRef}
            type="button"
            onClick={() => (open ? dismiss() : setOpen(true))}
            aria-label={open ? t(lang, "nav_close_menu") : t(lang, "nav_menu")}
            aria-expanded={open}
            aria-controls="nav-drawer"
            className="btn btn-ghost btn-sm !px-2.5"
          >
            {open ? <X size={19} aria-hidden="true" /> : <Menu size={19} aria-hidden="true" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden"
              initial="hidden"
              animate="show"
              exit="exit"
              variants={backdropFast}
              onClick={dismiss}
            />
            <motion.div
              id="nav-drawer"
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label={t(lang, "nav_menu")}
              className="glass-card fixed inset-y-0 right-0 z-50 flex w-[82%] max-w-xs flex-col gap-1 p-5 pt-[calc(var(--nav-h)+0.5rem)] md:hidden"
              style={{ borderRadius: 0 }}
              initial="hidden"
              animate="show"
              exit="exit"
              // Reduced motion loses the slide, not the panel: the drawer still
              // has to arrive, it just stops travelling to get there.
              variants={reduce ? drawerFade : drawerSlideFast}
            >
              {LINKS.map((l) => {
                const active = isActive(l.href);
                return (
                  <PendingLink
                    key={l.href}
                    href={l.href}
                    className="relative flex min-h-[52px] items-center rounded-xl px-4 py-3 text-base font-medium transition-transform duration-150 active:scale-[0.985]"
                    style={{
                      color: active ? "var(--accent)" : "var(--fg)",
                      background: active ? "var(--accent-soft)" : "transparent",
                    }}
                  >
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-2.5 left-0 w-0.5 rounded-full"
                        style={{ background: "var(--accent)" }}
                      />
                    )}
                    <span className="flex items-center gap-3" aria-current={active ? "page" : undefined}>
                      <l.Icon size={18} aria-hidden="true" />
                      {t(lang, l.key)}
                    </span>
                  </PendingLink>
                );
              })}
              <div className="mt-5 flex flex-col gap-3 border-t pt-5" style={{ borderColor: "var(--glass-hairline)" }}>
                <LanguageSwitcher full />
                <AccountControl full />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
