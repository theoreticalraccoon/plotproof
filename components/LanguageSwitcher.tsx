"use client";

/** Language pills (English / සිංහල / தமிழ்). Small, always visible on the
 * farmer-facing pages — a traditional farmer should never hunt for their language. */
import { LANGS, setLang, useLang } from "@/lib/i18n";

export default function LanguageSwitcher() {
  const lang = useLang();
  return (
    <div className="flex gap-1 print:hidden" role="group" aria-label="Language">
      {LANGS.map((l) => (
        <button
          key={l.code}
          onClick={() => setLang(l.code)}
          className={`rounded-full border px-3 py-1 text-xs ${
            lang === l.code
              ? "border-green-600 bg-green-600 text-white"
              : "border-gray-300 text-gray-600 hover:border-gray-500"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
