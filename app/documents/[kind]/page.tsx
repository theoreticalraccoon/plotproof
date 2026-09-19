/** /documents/invoice, /documents/packing-list, /documents/certificate-of-origin. */
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
