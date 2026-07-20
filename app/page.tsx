"use client";

/**
 * Farmer-first front door. The first screen a farmer sees, so the language
 * switcher lives at the top and the pitch + primary action follow the selected
 * language immediately.
 */
import Link from "next/link";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { t, useLang } from "@/lib/i18n";

export default function Home() {
  const lang = useLang();
  const supporting = [
    { href: "/intake", title: "EUDR forest evidence", desc: "Map your plot; we generate the EU deforestation proof — one of the documents." },
    { href: "/documents", title: "Documents", desc: "Generate export papers — invoice, packing list, certificate of origin." },
    { href: "/explore", title: "Open deforestation map", desc: "Public map of flagged clearing (public-good layer)." },
  ];
  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">PlotProof</h1>
        <LanguageSwitcher />
      </div>
      <p className="mt-2 text-gray-600 dark:text-gray-400">{t(lang, "app_tagline")}</p>

      <Link
        href="/sell"
        className="mt-6 block rounded-lg bg-green-600 p-5 text-white hover:bg-green-700"
      >
        <div className="text-lg font-semibold">{t(lang, "sell_cta")}</div>
        <div className="text-sm text-green-50">{t(lang, "sell_cta_sub")}</div>
      </Link>

      <h2 className="mt-8 text-sm font-semibold text-gray-500">{t(lang, "also_here")}</h2>
      <nav className="mt-2 flex flex-col gap-3">
        {supporting.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-lg border border-gray-200 p-4 hover:border-gray-400"
          >
            <div className="font-medium">{l.title}</div>
            <div className="text-sm text-gray-500">{l.desc}</div>
          </Link>
        ))}
      </nav>
    </main>
  );
}
