"use client";

/**
 * ⌘K / Ctrl-K command palette, jump to any page or run a quick action without
 * hunting through nav. The modern-SaaS convenience (Raycast / Linear / Vercel).
 * Wrap the app once in <CommandPaletteProvider> (done in AppShell); the nav's
 * search affordance calls useCommandPalette().open(). Fully keyboard-driven and
 * translated; closes on Esc / backdrop / route change.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Search, CornerDownLeft, Leaf, FileText, Satellite, MapPin, AudioLines, Home, Languages } from "lucide-react";
import { t, useLang, LANGS, setLang } from "@/lib/i18n";
import type { LucideIcon } from "lucide-react";

const Ctx = createContext<{ open: () => void } | null>(null);
export function useCommandPalette() {
  return useContext(Ctx) ?? { open: () => {} };
}

interface Command {
  id: string;
  label: string;
  group: string;
  icon: LucideIcon;
  keywords?: string;
  run: () => void;
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const lang = useLang();
  const reduce = useReducedMotion();
  const [isOpen, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const open = useCallback(() => setOpen(true), []);
  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
  }, []);

  const commands = useMemo<Command[]>(() => {
    const nav: Command[] = [
      { id: "home", label: t(lang, "nav_home"), group: t(lang, "cmd_group_nav"), icon: Home, run: () => router.push("/") },
      { id: "sell", label: t(lang, "nav_sell"), group: t(lang, "cmd_group_nav"), icon: Leaf, run: () => router.push("/sell") },
      { id: "documents", label: t(lang, "nav_documents"), group: t(lang, "cmd_group_nav"), icon: FileText, run: () => router.push("/documents") },
      { id: "intake", label: t(lang, "nav_evidence"), group: t(lang, "cmd_group_nav"), icon: Satellite, run: () => router.push("/intake") },
      { id: "explore", label: t(lang, "nav_explore"), group: t(lang, "cmd_group_nav"), icon: MapPin, run: () => router.push("/explore") },
      { id: "acoustic", label: t(lang, "footer_acoustic"), group: t(lang, "cmd_group_nav"), icon: AudioLines, run: () => router.push("/acoustic") },
    ];
    const actions: Command[] = [
      { id: "start-sale", label: t(lang, "cmd_action_start_sale"), group: t(lang, "cmd_group_actions"), icon: Leaf, run: () => router.push("/sell") },
      ...LANGS.filter((l) => l.code !== lang).map((l) => ({
        id: `lang-${l.code}`,
        label: `${t(lang, "cmd_action_lang")}: ${l.label}`,
        group: t(lang, "cmd_group_actions"),
        icon: Languages,
        keywords: "language lang translate",
        run: () => setLang(l.code),
      })),
    ];
    return [...nav, ...actions];
  }, [lang, router]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => (c.label + " " + (c.keywords ?? "")).toLowerCase().includes(q));
  }, [commands, query]);

  // Global ⌘K / Ctrl-K toggle.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Focus input + lock scroll while open; clamp active index.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      document.body.style.overflow = prev;
      cancelAnimationFrame(id);
    };
  }, [isOpen]);
  useEffect(() => setActive(0), [query]);

  const runAt = (i: number) => {
    const c = filtered[i];
    if (!c) return;
    c.run();
    close();
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runAt(active);
    } else if (e.key === "Escape") {
      close();
    }
  };

  return (
    <Ctx.Provider value={{ open }}>
      {children}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[130] flex items-start justify-center px-4 pt-[14vh] print:hidden">
            <motion.div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={close}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={t(lang, "cmd_placeholder")}
              className="glass-card glass-glow relative w-full max-w-lg overflow-hidden p-0"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.98 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-center gap-2.5 border-b px-4" style={{ borderColor: "var(--glass-hairline)" }}>
                <Search size={17} className="faint shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onInputKey}
                  placeholder={t(lang, "cmd_placeholder")}
                  className="w-full bg-transparent py-3.5 text-[0.95rem] outline-none placeholder:text-[var(--fg-faint)]"
                  aria-label={t(lang, "cmd_placeholder")}
                />
              </div>

              <ul className="max-h-[52vh] overflow-auto p-2" role="listbox" data-lenis-prevent>
                {filtered.length === 0 && (
                  <li className="px-3 py-6 text-center text-sm faint">{t(lang, "cmd_empty")}</li>
                )}
                {filtered.map((c, i) => {
                  const Icon = c.icon;
                  const isActive = i === active;
                  return (
                    <li key={c.id} role="option" aria-selected={isActive}>
                      <button
                        onClick={() => runAt(i)}
                        onMouseMove={() => setActive(i)}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors"
                        style={{ background: isActive ? "var(--accent-soft)" : "transparent", color: isActive ? "var(--fg)" : "var(--fg-muted)" }}
                      >
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                          style={{ background: "var(--glass)", color: isActive ? "var(--accent)" : "var(--fg-muted)" }}
                        >
                          <Icon size={15} />
                        </span>
                        <span className="flex-1 font-medium">{c.label}</span>
                        <span className="text-[0.68rem] uppercase tracking-wide faint">{c.group}</span>
                        {isActive && <CornerDownLeft size={14} className="faint" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Ctx.Provider>
  );
}
