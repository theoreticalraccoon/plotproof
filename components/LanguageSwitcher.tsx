"use client";

/** Language pills (English / සිංහල / தமிழ்). Small, always visible on the
 * farmer-facing pages, a traditional farmer should never hunt for their language. */
import { LANGS, setLang, useLang } from "@/lib/i18n";

export default function LanguageSwitcher() {
  const lang = useLang();
  return (
    <div className="flex gap-1 print:hidden" role="group" aria-label="Language">
      {LANGS.map((l) => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          aria-pressed={lang === l.code}
          className={`chip ${lang === l.code ? "chip-active" : ""}`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
