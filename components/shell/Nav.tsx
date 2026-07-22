"use client";

/**
 * Persistent app navigation. Present on every route (wired in AppShell) so no
 * workflow, including the document generators, which used to strand a farmer
 * mid-print with no way back, can trap a user. Desktop: horizontal links with
 * an active-route indicator. Mobile: a full-height animated drawer.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Leaf, Menu, X, Search, Sprout, FileText, Satellite, MapPin, Bell } from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useCommandPalette } from "./CommandPalette";
import AccountControl from "./AccountControl";
import { t, useLang } from "@/lib/i18n";
import { drawerSlide, backdropFade } from "@/lib/motion/variants";

const LINKS = [
  { href: "/sell", key: "nav_sell", Icon: Sprout },
  { href: "/documents", key: "nav_documents", Icon: FileText },
  { href: "/intake", key: "nav_evidence", Icon: Satellite },
  { href: "/explore", key: "nav_explore", Icon: MapPin },
  { href: "/alerts", key: "nav_alerts", Icon: Bell },
] as const;

export default function Nav() {
  const lang = useLang();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { open: openCmd } = useCommandPalette();

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

  const isActive = (href: string) => pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <header className="glass-nav sticky top-0 z-40 print:hidden">
      <div className="mx-auto flex h-[var(--nav-h)] max-w-6xl items-center gap-4 px-5 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight transition-transform active:scale-95"
        >
          <span
            className="flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
          >
            <Leaf size={17} strokeWidth={2.25} />
          </span>
          <span>PlotProof</span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 md:flex" aria-label="Primary">
          {LINKS.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className="relative inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                style={{ color: active ? "var(--accent)" : "var(--fg-muted)" }}
              >
                <l.Icon size={15} />
                {t(lang, l.key)}
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-x-3 -bottom-[1px] h-0.5 rounded-full"
                    style={{ background: "var(--accent)" }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          <button
            onClick={openCmd}
            aria-label={t(lang, "cmd_open")}
            className="inline-flex items-center gap-2 rounded-lg border py-1.5 pl-2.5 pr-2 text-sm faint transition-colors hover:text-[var(--fg)]"
            style={{ borderColor: "var(--glass-border)", background: "var(--glass)" }}
          >
            <Search size={15} />
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
            onClick={openCmd}
            aria-label={t(lang, "cmd_open")}
            className="btn btn-ghost btn-sm !px-2.5"
          >
            <Search size={18} />
          </button>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? t(lang, "nav_close_menu") : t(lang, "nav_menu")}
            aria-expanded={open}
            className="btn btn-ghost btn-sm !px-2.5"
          >
            {open ? <X size={19} /> : <Menu size={19} />}
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
              variants={backdropFade}
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="glass-card fixed inset-y-0 right-0 z-50 flex w-[82%] max-w-xs flex-col gap-1 p-5 pt-[calc(var(--nav-h)+0.5rem)] md:hidden"
              style={{ borderRadius: 0 }}
              initial="hidden"
              animate="show"
              exit="exit"
              variants={drawerSlide}
            >
              {LINKS.map((l) => {
                const active = isActive(l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 text-base font-medium"
                    style={{
                      color: active ? "var(--accent)" : "var(--fg)",
                      background: active ? "var(--accent-soft)" : "transparent",
                    }}
                  >
                    <l.Icon size={18} />
                    {t(lang, l.key)}
                  </Link>
                );
              })}
              <div className="mt-4 flex flex-col gap-3 border-t pt-4" style={{ borderColor: "var(--glass-hairline)" }}>
                <LanguageSwitcher />
                <AccountControl full />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
