"use client";

/** Turn document models into a PDF file and hand it to the browser. */
import { createElement } from "react";
import type { ExportDoc } from "./documents";

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
