"use client";

/** Turn document models into a PDF file and hand it to the browser. */
import { createElement, useCallback, useState } from "react";
import { documentSet, type DocKind, type ExportDoc } from "./documents";
import type { Sale } from "./types";

export async function downloadDocs(docs: ExportDoc[], fileName: string): Promise<void> {
  const [{ pdf }, { default: ExportPdf }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("@/components/sale/pdf/ExportPdf"),
  ]);
  const title = fileName.replace(/\.pdf$/i, "");
  // `pdf()` wants a <Document> element; ExportPdf renders one.
  const blob = await pdf(createElement(ExportPdf, { docs, title }) as never).toBlob();
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Give the browser a beat to start the download before releasing the URL.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

/** Download state for a screen: which download is running, and whether the last one failed. */
export function useDocumentDownload<Key extends string>() {
  const [busy, setBusy] = useState<Key | null>(null);
  const [error, setError] = useState(false);
  const download = useCallback(async (key: Key, sale: Sale, kinds?: readonly DocKind[]) => {
    setBusy(key);
    setError(false);
    try {
      const set = documentSet(sale, new Date(), kinds);
      await downloadDocs(set.docs, set.fileName);
    } catch {
      setError(true);
    } finally {
      setBusy(null);
    }
  }, []);
  return { busy, error, download };
}
