"use client";

/** One document, with only the fields that document prints beside it. */
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import Breadcrumb from "@/components/shell/Breadcrumb";
import DocPreview from "@/components/documents/DocPreview";
import SaleField from "@/components/sale/SaleField";
import { t, useLang } from "@/lib/i18n";
import { buildDoc, docFileName, docKey, type DocKind } from "@/lib/sale/documents";
import { downloadDocs } from "@/lib/sale/download";
import { fieldsForDoc } from "@/lib/sale/fields";
import { isSaleComplete, saleIssues } from "@/lib/sale/model";
import { useCurrentSale } from "@/lib/sale/store";
import NoSale from "./NoSale";

export default function DocEditor({ kind }: { kind: DocKind }) {
  const lang = useLang();
  const sale = useCurrentSale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  if (!sale) return <NoSale />;

  const complete = isSaleComplete(sale);
  const doc = buildDoc(kind, sale, new Date().toISOString().slice(0, 10), !complete);
  const issues = saleIssues(sale);
  const errorFor = (path: string) => issues.find((x) => x.field === path)?.messageKey;

  const download = async () => {
    setBusy(true);
    setError(false);
    try {
      await downloadDocs([doc], docFileName(doc));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto min-h-dvh w-full max-w-6xl px-5 pb-24 pt-6 sm:px-8">
      <Breadcrumb
        items={[
          { label: t(lang, "nav_home"), href: "/" },
          { label: t(lang, "nav_documents"), href: "/documents" },
          { label: t(lang, `${docKey(kind)}_name`) },
        ]}
      />

      <header className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[2rem] leading-[1.06] sm:text-[2.3rem]">
            {t(lang, `${docKey(kind)}_name`)}
          </h1>
          <p className="mt-2 font-mono text-[0.8rem] faint">{doc.number}</p>
          <p className="mt-2 text-[0.92rem] muted" style={{ maxWidth: "58ch" }}>
            {t(lang, `${docKey(kind)}_blurb`)}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary inline-flex min-h-[48px] items-center gap-2"
          onClick={() => void download()}
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <Download size={16} aria-hidden="true" />
          )}
          {t(lang, "sale_docs_download_named", { name: t(lang, `${docKey(kind)}_name`) })}
        </button>
      </header>

      {!complete && (
        <p className="mt-4 rounded-[var(--radius-sm)] px-4 py-3 text-[0.85rem]" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>
          {t(lang, "doc_draft_note")}
        </p>
      )}
      {error && (
        <p className="mt-4 text-[0.85rem]" role="alert" style={{ color: "var(--danger)" }}>
          {t(lang, "sale_docs_error")}
        </p>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[380px_minmax(0,1fr)]">
        <section aria-labelledby="edit-heading" className="min-w-0 lg:sticky lg:top-[calc(var(--nav-h)+1.5rem)] lg:max-h-[calc(100dvh-var(--nav-h)-3rem)] lg:self-start lg:overflow-y-auto">
          <h2 id="edit-heading" className="text-[1.05rem] font-semibold">
            {t(lang, "doc_edit_title")}
          </h2>
          <p className="mt-1 text-[0.82rem] faint" style={{ maxWidth: "44ch" }}>
            {t(lang, "doc_edit_lede")}
          </p>
          {/* A column, not a grid: `wide` fields carry `sm:col-span-2`, and in a
              one-column grid that spills them into an implicit second column,
              leaving every other field half-width. */}
          <div className="glass-card mt-4 flex flex-col gap-4 p-5">
            {fieldsForDoc(kind).map((def) => (
              <SaleField key={def.path} def={def} sale={sale} lang={lang} errorKey={errorFor(def.path)} />
            ))}
          </div>
          <Link href="/sell" className="mt-4 inline-flex items-center gap-1.5 text-[0.85rem] font-medium muted hover:underline">
            <ArrowLeft size={14} aria-hidden="true" /> {t(lang, "doc_back_to_sale")}
          </Link>
        </section>

        <section aria-label={t(lang, "doc_preview_label")} className="min-w-0">
          <DocPreview doc={doc} />
        </section>
      </div>
    </main>
  );
}
