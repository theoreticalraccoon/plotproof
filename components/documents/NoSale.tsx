"use client";

/** What /documents shows when there is no sale to make documents from. */
import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import Breadcrumb from "@/components/shell/Breadcrumb";
import { t, useLang } from "@/lib/i18n";

export default function NoSale() {
  const lang = useLang();
  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-5 pb-24 pt-6 sm:px-8">
      <Breadcrumb items={[{ label: t(lang, "nav_home"), href: "/" }, { label: t(lang, "nav_documents") }]} />
      <div className="glass-card mt-10 flex flex-col items-center p-10 text-center">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          <FilePlus2 size={22} aria-hidden="true" />
        </span>
        <h1 className="mt-4 font-display text-[1.4rem]">{t(lang, "docs_empty_title")}</h1>
        <p className="mt-2 text-[0.9rem] muted" style={{ maxWidth: "44ch" }}>
          {t(lang, "docs_empty_body")}
        </p>
        <Link href="/sell" className="btn btn-primary mt-5 min-h-[48px]">
          {t(lang, "docs_empty_cta")}
        </Link>
      </div>
    </main>
  );
}
