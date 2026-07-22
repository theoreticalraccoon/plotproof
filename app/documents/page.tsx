"use client";

/**
 * Documents hub. Reads the sale intent saved by /sell and shows the full,
 * personalised checklist again, a durable return point, now with per-document
 * status the farmer controls ("Mark as done") and an overall progress bar.
 * Same checklist component the /sell results step uses, so the two never drift.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { DOCUMENT_TYPES, getProduct } from "@/lib/compliance/catalog";
import { resolveRequirements } from "@/lib/compliance/resolver";
import { loadIntent } from "@/lib/compliance/intent";
import { getStatuses, progressSummary, setStatus, type StatusMap } from "@/lib/compliance/status";
import { pushUserState } from "@/lib/supabase/userState";
import { countryName } from "@/lib/public/format";
import { t, useLang } from "@/lib/i18n";
import DocumentChecklist from "@/components/compliance/DocumentChecklist";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import Reveal from "@/components/motion/Reveal";
import { hoverLift } from "@/lib/motion/variants";
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
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-6 text-center">
        <div className="glass-card w-full p-8">
          <div className="mb-4 flex justify-center"><LanguageSwitcher /></div>
          <h1 className="text-lg font-semibold">{t(lang, "documents_title")}</h1>
          <p className="mt-2 text-sm muted">{t(lang, "documents_empty_body")}</p>
          <motion.div {...hoverLift}>
            <Link href="/sell" className="btn btn-primary mt-5">
              {t(lang, "sell_cta")}
            </Link>
          </motion.div>
        </div>
      </main>
    );
  }

  const product = getProduct(intent.productId);
  const requiredIds = result.documents.map((d) => d.documentTypeId);
  const progress = progressSummary(statuses, requiredIds);

  const onSetStatus = (documentTypeId: string, status: DocStatus) => {
    setStatuses(setStatus(intent, documentTypeId, status));
    pushUserState();
  };

  const pct = progress.total ? (progress.ready / progress.total) * 100 : 0;
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-5 py-6 sm:px-8">
      <Reveal>
        <header className="mb-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h1 className="text-xl font-semibold tracking-tight">{t(lang, "documents_title")}</h1>
            <LanguageSwitcher />
          </div>
          <p className="text-sm muted">
            <strong>{product?.name ?? intent.productId}</strong> (HS {product?.hsCode ?? "-"}) ·{" "}
            {countryName(intent.originCountry)} → {intent.destination}.{" "}
            <Link href="/sell" className="underline underline-offset-2" style={{ color: "var(--accent)" }}>
              {t(lang, "start_over")}
            </Link>
          </p>
        </header>
      </Reveal>

      {/* progress */}
      <Reveal delay={0.05}>
        <div className="glass mb-5 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">
              {t(lang, "progress", { ready: progress.ready, total: progress.total })}
            </span>
            <span className="text-xs faint tabular-nums">{Math.round(pct)}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ background: "var(--glass-border-2)" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: "var(--accent)" }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="flex flex-col gap-5">
          <DocumentChecklist documents={result.documents} statuses={statuses} onSetStatus={onSetStatus} />
        </div>
      </Reveal>

      <p className="tag tag-warn mt-5 !block !rounded-xl p-3 text-xs">{t(lang, "disclaimer")}</p>
      {lang !== "en" && (
        <p className="glass mt-2 p-3 text-xs muted">{t(lang, "docs_in_english")}</p>
      )}
    </main>
  );
}
