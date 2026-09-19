"use client";

// The documents this app produces for the open sale: download all of them as one file, download
// each alone, or open one to edit.
import { useState } from "react";
import { Download, FileText, Pencil, Loader2 } from "lucide-react";
import PendingLink from "@/components/motion/PendingLink";
import { t, type Lang } from "@/lib/i18n";
import { buildDoc, DOC_KINDS, docFileName, docKey, type DocKind } from "@/lib/sale/documents";
import { isSaleComplete } from "@/lib/sale/model";
import { downloadDocs } from "@/lib/sale/download";
import type { Sale } from "@/lib/sale/types";

const today = () => new Date().toISOString().slice(0, 10);

export default function GeneratedDocs({ sale, lang }: { sale: Sale; lang: Lang }) {
  const complete = isSaleComplete(sale);
  const [busy, setBusy] = useState<DocKind | "all" | null>(null);
  const [error, setError] = useState(false);

  const run = async (which: DocKind | "all") => {
    setBusy(which);
    setError(false);
    try {
      const kinds = which === "all" ? DOC_KINDS : [which];
      const docs = kinds.map((k) => buildDoc(k, sale, today(), !complete));
      const name = which === "all" ? `${sale.numbers.invoice}-export-documents.pdf` : docFileName(docs[0]);
      await downloadDocs(docs, name);
    } catch {
      setError(true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-labelledby="gen-heading" id="documents">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="gen-heading" className="font-display text-[1.55rem] leading-tight">
            {t(lang, "sale_docs_title")}
          </h2>
          <p className="mt-1.5 text-[0.9rem] muted" style={{ maxWidth: "58ch" }}>
            {t(lang, complete ? "sale_docs_ready" : "sale_docs_draft")}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary min-h-[48px] inline-flex items-center gap-2"
          onClick={() => void run("all")}
          disabled={busy !== null}
          aria-busy={busy === "all"}
        >
          {busy === "all" ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <Download size={16} aria-hidden="true" />
          )}
          {t(lang, "sale_docs_download_all")}
        </button>
      </div>

      {error && (
        <p className="mt-3 text-[0.85rem]" role="alert" style={{ color: "var(--danger)" }}>
          {t(lang, "sale_docs_error")}
        </p>
      )}

      <ul className="mt-4 grid gap-3 md:grid-cols-3">
        {DOC_KINDS.map((kind) => (
          <li key={kind} className="glass-card flex flex-col p-4">
            <div className="flex items-start gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
              >
                <FileText size={17} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h3 className="text-[0.95rem] font-semibold leading-snug">{t(lang, `${docKey(kind)}_name`)}</h3>
                <p className="mt-0.5 font-mono text-[0.72rem] faint">{numberFor(sale, kind)}</p>
              </div>
            </div>
            <p className="mt-2.5 flex-1 text-[0.8rem] muted">{t(lang, `${docKey(kind)}_blurb`)}</p>
            <p
              className="mt-2.5 text-[0.72rem] font-semibold uppercase tracking-[0.12em]"
              style={{ color: complete ? "var(--accent)" : "var(--warn)" }}
            >
              {t(lang, complete ? "sale_ready" : "sale_draft")}
            </p>
            <div className="mt-3 flex gap-2">
              <PendingLink
                href={`/documents/${kind}`}
                className="btn btn-ghost btn-sm min-h-[44px] flex-1 inline-flex items-center justify-center gap-1.5"
              >
                <Pencil size={14} aria-hidden="true" /> {t(lang, "sale_docs_open")}
              </PendingLink>
              <button
                type="button"
                className="btn btn-ghost btn-sm min-h-[44px] inline-flex items-center gap-1.5"
                onClick={() => void run(kind)}
                disabled={busy !== null}
                aria-label={t(lang, "sale_docs_download_named", { name: t(lang, `${docKey(kind)}_name`) })}
              >
                {busy === kind ? (
                  <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                ) : (
                  <Download size={14} aria-hidden="true" />
                )}
                PDF
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function numberFor(sale: Sale, kind: DocKind): string {
  if (kind === "invoice") return sale.numbers.invoice;
  if (kind === "packing-list") return sale.numbers.packingList;
  return sale.numbers.certificateOfOrigin;
}
