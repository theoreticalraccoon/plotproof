"use client";

/**
 * ⌘K / Ctrl-K command palette, jump to any page or run a quick action without
 * hunting through nav. The modern-SaaS convenience (Raycast / Linear / Vercel).
 * Wrap the app once in <CommandPaletteProvider> (done in AppShell); the nav's
 * search affordance calls useCommandPalette().open(). Fully keyboard-driven and
 * translated; closes on Esc / backdrop / route change.
 *
 * Commands are split by what they actually cost. A "navigate" command hands off
 * to the router and may take a beat, so the row it was fired from holds a
 * spinner and the palette stays up until the route lands. An "action" command
 * is a synchronous store write and is finished the instant it is invoked, so it
 * closes immediately: putting a spinner on it would invent a wait.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Search, CornerDownLeft, Leaf, FileText, Satellite, MapPin, AudioLines, Home, Languages } from "lucide-react";
import { t, useLang, LANGS, setLang } from "@/lib/i18n";
import { EASE_OUT_2 } from "@/lib/motion/variants";
import type { LucideIcon } from "lucide-react";

const Ctx = createContext<{ open: () => void } | null>(null);
export function useCommandPalette() {
  return useContext(Ctx) ?? { open: () => {} };
}

interface CommandBase {
  id: string;
  label: string;
  group: string;
  icon: LucideIcon;
  keywords?: string;
}
type Command =
  | (CommandBase & { kind: "navigate"; href: string })
  | (CommandBase & { kind: "action"; run: () => void });

// A navigation that never lands (blocked by a guard, cancelled) must not leave
// a row spinning forever. Mirrors the NavProgress failsafe.
const NAV_FAILSAFE_MS = 8000;

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const lang = useLang();
  const reduce = useReducedMotion();
  const [isOpen, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // Whatever had focus before the palette took it, so Esc puts the user back
  // where they were rather than at the top of the document.
  const restoreRef = useRef<HTMLElement | null>(null);
  const openRef = useRef(false);
  useEffect(() => {
    openRef.current = isOpen;
  }, [isOpen]);

  const open = useCallback(() => {
    restoreRef.current = (document.activeElement as HTMLElement | null) ?? null;
    setOpen(true);
  }, []);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    setQuery("");
    setActive(0);
    setPendingId(null);
    const el = restoreRef.current;
    restoreRef.current = null;
    // After the dialog unmounts: React parks focus on <body> as the focused
    // node goes away, which would undo an immediate restore.
    if (restoreFocus && el) requestAnimationFrame(() => el.focus());
  }, []);

  const commands = useMemo<Command[]>(() => {
    const navGroup = t(lang, "cmd_group_nav");
    const actionGroup = t(lang, "cmd_group_actions");
    const nav: Command[] = [
      { id: "home", label: t(lang, "nav_home"), group: navGroup, icon: Home, kind: "navigate", href: "/" },
      { id: "sell", label: t(lang, "nav_sell"), group: navGroup, icon: Leaf, kind: "navigate", href: "/sell" },
      { id: "documents", label: t(lang, "nav_documents"), group: navGroup, icon: FileText, kind: "navigate", href: "/documents" },
      { id: "intake", label: t(lang, "nav_evidence"), group: navGroup, icon: Satellite, kind: "navigate", href: "/intake" },
      { id: "explore", label: t(lang, "nav_explore"), group: navGroup, icon: MapPin, kind: "navigate", href: "/explore" },
      { id: "acoustic", label: t(lang, "footer_acoustic"), group: navGroup, icon: AudioLines, kind: "navigate", href: "/acoustic" },
    ];
    const actions: Command[] = [
      { id: "start-sale", label: t(lang, "cmd_action_start_sale"), group: actionGroup, icon: Leaf, kind: "navigate", href: "/sell" },
      ...LANGS.filter((l) => l.code !== lang).map<Command>((l) => ({
        id: `lang-${l.code}`,
        label: `${t(lang, "cmd_action_lang")}: ${l.label}`,
        group: actionGroup,
        icon: Languages,
        keywords: "language lang translate",
        kind: "action",
        run: () => setLang(l.code),
      })),
    ];
    return [...nav, ...actions];
  }, [lang]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => (c.label + " " + (c.keywords ?? "")).toLowerCase().includes(q));
  }, [commands, query]);

  // Consecutive runs of the same group, keeping each command's index in the
  // flat `filtered` list so the keyboard model stays one-dimensional.
  const groups = useMemo(() => {
    const out: { name: string; items: { cmd: Command; index: number }[] }[] = [];
    filtered.forEach((cmd, index) => {
      const tail = out[out.length - 1];
      if (tail && tail.name === cmd.group) tail.items.push({ cmd, index });
      else out.push({ name: cmd.group, items: [{ cmd, index }] });
    });
    return out;
  }, [filtered]);

  // Global ⌘K / Ctrl-K toggle.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (openRef.current) close();
        else open();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Focus input + lock scroll while open.
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

  // Keep the highlighted row on screen when it is being moved by the keyboard
  // rather than the pointer, otherwise ArrowDown walks the selection out of
  // view and the list looks frozen.
  useEffect(() => {
    if (!isOpen) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, isOpen]);

  // The route landed (or the user navigated some other way): the palette has
  // done its job.
  useEffect(() => {
    close(false);
    // Intentionally keyed on pathname alone, this observes the landing only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!pendingId) return;
    const id = setTimeout(() => close(false), NAV_FAILSAFE_MS);
    return () => clearTimeout(id);
  }, [pendingId, close]);

  const runAt = (i: number) => {
    const c = filtered[i];
    if (!c) return;
    if (c.kind === "action") {
      c.run();
      close();
      return;
    }
    // Already on that route: nothing will navigate, so there is nothing to
    // wait for and claiming otherwise would be a lie.
    if (c.href === pathname) {
      close();
      return;
    }
    setPendingId(c.id);
    router.push(c.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const n = filtered.length;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => (i + 1) % Math.max(n, 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => (i - 1 + Math.max(n, 1)) % Math.max(n, 1));
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(Math.max(n - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        runAt(active);
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
      case "Tab":
        // The input is the only tab stop inside the dialog; swallowing Tab is
        // the whole focus trap, and it also keeps the browser from walking
        // into the page still rendered behind the backdrop.
        e.preventDefault();
        inputRef.current?.focus();
        break;
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
              transition={{ duration: 0.12 }}
              onClick={() => close()}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={t(lang, "cmd_placeholder")}
              onKeyDown={onKeyDown}
              className="glass-card glass-glow relative w-full max-w-lg overflow-hidden p-0"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.985 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.985 }}
              // A palette is a keyboard tool: anything slow enough to watch is
              // slow enough to get in the way of the next keystroke.
              transition={{ duration: 0.14, ease: EASE_OUT_2 }}
            >
              <div className="flex items-center gap-2.5 border-b px-4" style={{ borderColor: "var(--glass-hairline)" }}>
                <Search size={17} className="faint shrink-0" aria-hidden="true" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t(lang, "cmd_placeholder")}
                  className="w-full bg-transparent py-3.5 text-[0.95rem] outline-none placeholder:text-[var(--fg-faint)]"
                  aria-label={t(lang, "cmd_placeholder")}
                  role="combobox"
                  aria-expanded
                  aria-controls="cmd-list"
                  aria-autocomplete="list"
                  aria-activedescendant={filtered[active] ? `cmd-opt-${active}` : undefined}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              <ul
                id="cmd-list"
                ref={listRef}
                className="max-h-[52vh] overflow-auto p-2"
                role="listbox"
                aria-label={t(lang, "cmd_placeholder")}
                data-lenis-prevent
              >
                {filtered.length === 0 && (
                  <li role="presentation" className="px-3 py-8 text-center text-sm faint">
                    {t(lang, "cmd_empty")}
                  </li>
                )}
                {groups.map((g, gi) => (
                  <li key={g.name} role="presentation" className={gi === 0 ? "" : "mt-1"}>
                    <div
                      className="px-3 pb-1.5 pt-2 text-[0.64rem] font-semibold uppercase tracking-[0.14em]"
                      style={{ color: "var(--fg-faint)" }}
                    >
                      {g.name}
                    </div>
                    <ul role="presentation" className="flex flex-col gap-0.5">
                      {g.items.map(({ cmd, index }) => {
                        const Icon = cmd.icon;
                        const isActive = index === active;
                        const isPending = pendingId === cmd.id;
                        return (
                          <li key={cmd.id} id={`cmd-opt-${index}`} role="option" aria-selected={isActive} data-index={index}>
                            <button
                              type="button"
                              tabIndex={-1}
                              onClick={() => runAt(index)}
                              onMouseMove={() => setActive(index)}
                              aria-busy={isPending || undefined}
                              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-[background-color,color,box-shadow] duration-150"
                              style={{
                                background: isActive ? "var(--accent-soft)" : "transparent",
                                color: isActive ? "var(--fg)" : "var(--fg-muted)",
                                // A tinted row alone is easy to lose against
                                // glass; the accent edge makes "this is the one
                                // Enter fires" unambiguous.
                                boxShadow: isActive ? "inset 0 0 0 1px var(--accent-ring)" : "none",
                              }}
                            >
                              <span
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                                style={{ background: "var(--glass)", color: isActive ? "var(--accent)" : "var(--fg-muted)" }}
                              >
                                {isPending ? <span className="spinner" aria-hidden="true" /> : <Icon size={15} aria-hidden="true" />}
                              </span>
                              <span className="flex-1 font-medium">{cmd.label}</span>
                              {isActive && !isPending && <CornerDownLeft size={14} className="faint" aria-hidden="true" />}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ul>

              {/* Spoken only, so the wait is not something you have to see the
                  spinner to know about. */}
              <span role="status" aria-live="polite" className="sr-only">
                {pendingId ? t(lang, "opening") : ""}
              </span>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Ctx.Provider>
  );
}
