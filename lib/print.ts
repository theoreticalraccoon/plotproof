/** Print / Save-as-PDF with a meaningful filename. */
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
