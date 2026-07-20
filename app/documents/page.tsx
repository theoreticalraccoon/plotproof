"use client";

/**
 * Documents hub. Reads the sale intent saved by /sell and shows the full,
 * personalised checklist again — a durable return point, now with per-document
 * status the farmer controls ("Mark as done") and an overall progress bar.
 * Same checklist component the /sell results step uses, so the two never drift.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { DOCUMENT_TYPES, getProduct } from "@/lib/compliance/catalog";
import { resolveRequirements } from "@/lib/compliance/resolver";
import { loadIntent } from "@/lib/compliance/intent";
import { getStatuses, progressSummary, setStatus, type StatusMap } from "@/lib/compliance/status";
import { countryName } from "@/lib/public/format";
import { t, useLang } from "@/lib/i18n";
import DocumentChecklist from "@/components/compliance/DocumentChecklist";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import type { DocStatus, RequirementResult, SaleIntent } from "@/lib/compliance/types";

export default function DocumentsPage() {
  const lang = useLang();
  const [intent, setIntent] = useState<SaleIntent | null>(null);
  const [result, setResult] = useState<RequirementResult | null>(null);
  const [statuses, setStatuses] = useState<StatusMap>({});

  useEffect(() => {
    const i = loadIntent();
    setIntent(i);
    if (!i) return;
    const product = getProduct(i.productId);
    if (!product) return;
    setResult(
      resolveRequirements(
        {
          product,
          originCountry: i.originCountry,
          destination: i.destination,
          organicClaim: i.organicClaim,
        },
        DOCUMENT_TYPES,
      ),
    );
    setStatuses(getStatuses(i));
  }, []);

  if (!intent || !result) {
    return (
      <main className="mx-auto max-w-lg p-8 text-center">
        <div className="mb-4 flex justify-center"><LanguageSwitcher /></div>
        <h1 className="text-lg font-semibold">Your export documents</h1>
        <p className="mt-2 text-sm text-gray-600">
          Tell us what you&apos;re selling and we&apos;ll list the exact papers you need.
        </p>
        <Link
          href="/sell"
          className="mt-4 inline-block rounded bg-green-600 px-4 py-2 text-sm text-white"
        >
          {t(lang, "sell_cta")}
        </Link>
      </main>
    );
  }

  const product = getProduct(intent.productId);
  const requiredIds = result.documents.map((d) => d.documentTypeId);
  const progress = progressSummary(statuses, requiredIds);

  const onSetStatus = (documentTypeId: string, status: DocStatus) => {
    setStatuses(setStatus(intent, documentTypeId, status));
  };

  return (
    <main className="mx-auto max-w-2xl p-4">
      <header className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Your export documents</h1>
          <LanguageSwitcher />
        </div>
        <p className="text-sm text-gray-500">
          <strong>{product?.name ?? intent.productId}</strong> (HS {product?.hsCode ?? "—"}) ·{" "}
          {countryName(intent.originCountry)} → {intent.destination}.{" "}
          <Link href="/sell" className="underline">
            {t(lang, "start_over")}
          </Link>
        </p>
      </header>

      {/* progress */}
      <div className="mb-4 rounded-lg border border-gray-200 p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            {t(lang, "progress", { ready: progress.ready, total: progress.total })}
          </span>
          <span className="text-xs text-gray-500">
            {progress.total ? Math.round((progress.ready / progress.total) * 100) : 0}%
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded bg-gray-100">
          <div
            className="h-full rounded bg-green-600 transition-all"
            style={{ width: `${progress.total ? (progress.ready / progress.total) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <DocumentChecklist documents={result.documents} statuses={statuses} onSetStatus={onSetStatus} />
      </div>

      <p className="mt-4 rounded bg-amber-50 p-2 text-xs text-amber-900">{t(lang, "disclaimer")}</p>
      {lang !== "en" && (
        <p className="mt-2 rounded bg-gray-50 p-2 text-xs text-gray-600">{t(lang, "docs_in_english")}</p>
      )}
    </main>
  );
}
