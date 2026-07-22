"use client";

/**
 * Explicit "back to documents" breadcrumb for the generator pages. The
 * persistent top nav already prevents anyone getting stranded mid-flow, but
 * this makes the escape route visible right next to the print button too -
 * belt and braces on the exact complaint that used to trap farmers here.
 */
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { t, useLang } from "@/lib/i18n";

export default function DocBreadcrumb() {
  const lang = useLang();
  return (
    <Link
      href="/documents"
      className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium muted hover:underline underline-offset-2 print:hidden"
    >
      <ArrowLeft size={15} />
      {t(lang, "nav_documents")}
    </Link>
  );
}
