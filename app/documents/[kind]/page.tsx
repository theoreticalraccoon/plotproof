/**
 * /documents/invoice, /documents/packing-list, /documents/certificate-of-origin.
 *
 * One route for all three: the documents differ in what they print, not in how
 * they are edited, and three near-identical pages is exactly how the old forms
 * drifted out of agreement with each other.
 */
import { notFound } from "next/navigation";
import DocEditor from "@/components/documents/DocEditor";
import { DOC_KINDS, type DocKind } from "@/lib/sale/documents";

export function generateStaticParams() {
  return DOC_KINDS.map((kind) => ({ kind }));
}

export default async function DocumentPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!DOC_KINDS.includes(kind as DocKind)) notFound();
  return <DocEditor kind={kind as DocKind} />;
}
