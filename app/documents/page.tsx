"use client";

/** /documents, just the documents. */
import Link from "next/link";
import { Download, FileText, Loader2, Pencil } from "lucide-react";
import Breadcrumb from "@/components/shell/Breadcrumb";
import DocPreview from "@/components/documents/DocPreview";
import NoSale from "@/components/documents/NoSale";
import { t, useLang } from "@/lib/i18n";
import { docKey, documentSet } from "@/lib/sale/documents";
import { useDocumentDownload } from "@/lib/sale/download";
import { saleTitle } from "@/lib/sale/model";
import { useCurrentSale } from "@/lib/sale/store";

export default function DocumentsPage() {
  const lang = useLang();
  const sale = useCurrentSale();
  const { busy: running, error, download } = useDocumentDownload<"all">();
  const busy = running !== null;

  if (!sale) return <NoSale />;

  const { docs, draft } = documentSet(sale, new Date());
  const complete = !draft;
  const downloadAll = () => download("all", sale);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-5xl px-5 pb-24 pt-6 sm:px-8">
      <Breadcrumb items={[{ label: t(lang, "nav_home"), href: "/" }, { label: t(lang, "nav_documents") }]} />

      <header className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[2rem] leading-[1.06] sm:text-[2.4rem]">{t(lang, "docs_title")}</h1>
          <p className="mt-2.5 text-[1rem] leading-relaxed muted" style={{ maxWidth: "58ch" }}>
            {t(lang, "docs_lede")}
          </p>
          <p className="mt-2 text-[0.85rem] faint">{t(lang, "docs_for_sale", { name: saleTitle(sale) })}</p>
        </div>
        <button
          type="button"
          className="btn btn-primary inline-flex min-h-[48px] items-center gap-2"
          onClick={() => void downloadAll()}
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}
          {t(lang, "sale_docs_download_all")}
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

      <ul className="mt-8 space-y-10">
        {docs.map((doc) => (
          <li key={doc.kind}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2.5 text-[1.15rem] font-semibold">
                <FileText size={18} aria-hidden="true" style={{ color: "var(--accent)" }} />
                {t(lang, `${docKey(doc.kind)}_name`)}
                <span className="font-mono text-[0.75rem] font-normal faint">{doc.number}</span>
              </h2>
              <Link
                href={`/documents/${doc.kind}`}
                className="btn btn-ghost btn-sm inline-flex min-h-[40px] items-center gap-1.5"
              >
                <Pencil size={14} aria-hidden="true" /> {t(lang, "docs_edit_this")}
              </Link>
            </div>
            <div className="mt-3">
              <DocPreview doc={doc} />
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-10 text-[0.85rem] muted">
        {t(lang, "docs_authority_note")}{" "}
        <Link href="/sell#authority" className="underline underline-offset-2">
          {t(lang, "docs_authority_link")}
        </Link>
      </p>
    </main>
  );
}
