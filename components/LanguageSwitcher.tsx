"use client";

/** Language pills (English / සිංහල / தமிழ්). Small, always visible on the
 * farmer-facing pages, a traditional farmer should never hunt for their language.
 *
 * Switching is a synchronous store write, so it must never show a spinner: the
 * acknowledgement is the selection itself moving under the finger. The accent
 * pill is a single shared element that slides between options rather than three
 * backgrounds cross-fading, which is what makes the choice read as "moved
 * here", not "something changed somewhere". */
import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { LANGS, setLang, useLang } from "@/lib/i18n";
import { EASE_OUT_2, durations } from "@/lib/motion/variants";

export default function LanguageSwitcher({ full = false }: { full?: boolean }) {
  const lang = useLang();
  const reduce = useReducedMotion();
  // Several switchers can be mounted at once (nav + drawer + in-page), and a
  // shared layoutId across them would make the pill teleport between headers.
  const pillId = `lang-pill-${useId()}`;
  const activeLabel = LANGS.find((l) => l.code === lang)?.label ?? "";

  return (
    <div
      role="group"
      aria-label="Language"
      className={`relative inline-flex items-center gap-0.5 rounded-full p-[3px] print:hidden ${full ? "w-full" : ""}`}
      style={{
        background: "var(--glass)",
        border: "1px solid var(--glass-border)",
        boxShadow: "var(--glass-shadow)",
      }}
    >
      {LANGS.map((l) => {
        const active = lang === l.code;
        return (
          <button
            key={l.code}
            type="button"
            lang={l.code}
            onClick={() => setLang(l.code)}
            aria-pressed={active}
            className={`relative inline-flex items-center justify-center rounded-full px-3 text-[0.78rem] font-semibold leading-none transition-[color,transform] duration-150 active:scale-[0.96] ${
              full ? "flex-1 min-h-[44px]" : "min-h-[34px]"
            }`}
            style={{ color: active ? "var(--accent-fg)" : "var(--fg-muted)" }}
          >
            {active && (
              <motion.span
                layoutId={reduce ? undefined : pillId}
                aria-hidden="true"
                className="absolute inset-0 rounded-full"
                style={{ background: "var(--accent)" }}
                transition={{ duration: durations.base, ease: EASE_OUT_2 }}
              />
            )}
            {/* Above the pill, and isolated so the sliding background cannot
                drag the glyphs with it mid-transition. */}
            <span className="relative z-[1]">{l.label}</span>
          </button>
        );
      })}
      {/* The pill is colour-only for a screen reader, so the change is spoken. */}
      <span role="status" aria-live="polite" className="sr-only">
        {activeLabel}
      </span>
    </div>
  );
}
