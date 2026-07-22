/**
 * Print / Save-as-PDF with a meaningful filename. Browsers default the saved
 * PDF's name to `document.title`, so we swap in the document's official name for
 * the duration of the print dialog and restore the page title afterwards. This
 * is why "Download PDF" produces "Commercial Invoice INV-….pdf" rather than
 * "PlotProof, sell your harvest abroad.pdf".
 */
export function printAs(filename: string): void {
  if (typeof window === "undefined") return;
  const previous = document.title;
  document.title = filename;
  const restore = () => {
    document.title = previous;
    window.removeEventListener("afterprint", restore);
  };
  window.addEventListener("afterprint", restore);
  // Fallback restore in case afterprint doesn't fire (some mobile browsers).
  setTimeout(restore, 60000);
  window.print();
}
