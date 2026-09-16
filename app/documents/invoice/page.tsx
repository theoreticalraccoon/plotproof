"use client";

/**
 * Commercial invoice generator, a real customs document the farmer produces
 * here from their sale details, then prints or saves as PDF. Prefilled from the
 * saved sale intent; the farmer adds buyer + price and it's done.
 */
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Printer } from "lucide-react";
import { getProduct } from "@/lib/compliance/catalog";
import { loadIntent } from "@/lib/compliance/intent";
import { markInProgress } from "@/lib/compliance/status";
import { countryName } from "@/lib/geo/countries";
import { docNumber, lineAmount } from "@/lib/compliance/documents";
import NoIntent from "@/components/documents/NoIntent";
import DocBreadcrumb from "@/components/documents/DocBreadcrumb";
import Reveal from "@/components/motion/Reveal";
import CopyButton from "@/components/motion/CopyButton";
import { hoverLift } from "@/lib/motion/variants";
import { printAs } from "@/lib/print";
import type { SaleIntent } from "@/lib/compliance/types";

export default function InvoicePage() {
  const [intent, setIntent] = useState<SaleIntent | null>(null);
  const [sellerName, setSellerName] = useState("");
  const [sellerAddr, setSellerAddr] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerAddr, setBuyerAddr] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [incoterm, setIncoterm] = useState("FOB");
  const invoiceNo = useMemo(() => docNumber("INV"), []);
  const date = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const i = loadIntent();
    setIntent(i);
    if (i) markInProgress(i, "commercial_invoice"); // opened = started
  }, []);

  if (!intent) {
    return <NoIntent />;
  }

  const product = getProduct(intent.productId);
  const qty = intent.quantityKg;
  const price = Number(unitPrice) || 0;
  const total = lineAmount(qty, price);

  return (
    <main className="mx-auto max-w-3xl px-5 py-6 sm:px-6">
      <DocBreadcrumb />
      {/* editor, hidden when printing */}
      <Reveal>
      <div className="glass-card mb-5 grid gap-3 p-5 text-sm print:hidden sm:grid-cols-2">
        <h2 className="col-span-full font-semibold">Fill in the details</h2>
        <Field label="Your name / farm" value={sellerName} onChange={setSellerName} />
        <Field label="Your address" value={sellerAddr} onChange={setSellerAddr} />
        <Field label="Buyer name" value={buyerName} onChange={setBuyerName} />
        <Field label="Buyer address" value={buyerAddr} onChange={setBuyerAddr} />
        <Field label={`Unit price per kg (${currency})`} value={unitPrice} onChange={setUnitPrice} inputMode="decimal" />
        <label>
          <span className="label">Currency</span>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="field">
            {["USD", "EUR", "GBP"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Incoterm</span>
          <select value={incoterm} onChange={(e) => setIncoterm(e.target.value)} className="field">
            {["FOB", "CIF", "CIP", "DAP", "EXW"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <div className="col-span-full">
          <motion.div {...hoverLift} className="inline-block">
            <button onClick={() => printAs(`Commercial Invoice ${invoiceNo}`)} className="btn btn-primary">
              <Printer size={16} /> Download PDF
            </button>
          </motion.div>
        </div>
      </div>
      </Reveal>

      {/* the document */}
      <Reveal delay={0.08}>
      <article className="doc-sheet p-6 sm:p-8 print:border-0 print:p-0 print:shadow-none">
        <div className="flex items-start justify-between border-b border-gray-300 pb-3">
          <div>
            <h1 className="text-xl font-bold">COMMERCIAL INVOICE</h1>
            <p className="flex items-center gap-2 text-sm text-gray-600">
              No. {invoiceNo} · {date}
              <CopyButton text={invoiceNo} toastMsg="Invoice number copied" className="print:hidden" />
            </p>
          </div>
          <div className="text-right text-xs text-gray-500">Incoterm: {incoterm}</div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs uppercase text-gray-400">Exporter (seller)</div>
            <div className="font-medium">{sellerName || "-"}</div>
            <div className="whitespace-pre-line text-gray-600">{sellerAddr}</div>
            <div className="text-gray-600">Country of origin: {countryName(intent.originCountry)}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-gray-400">Importer (buyer)</div>
            <div className="font-medium">{buyerName || "-"}</div>
            <div className="whitespace-pre-line text-gray-600">{buyerAddr}</div>
            <div className="text-gray-600">Destination: {intent.destination}</div>
          </div>
        </div>

        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-gray-300 text-left">
              <th className="py-2">Description</th>
              <th className="py-2">HS code</th>
              <th className="py-2 text-right">Qty (kg)</th>
              <th className="py-2 text-right">Unit ({currency})</th>
              <th className="py-2 text-right">Amount ({currency})</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-200">
              <td className="py-2">
                {product?.name ?? intent.productId}
                {intent.organicClaim ? " (organic)" : ""}
              </td>
              <td className="py-2">{product?.hsCode ?? "-"}</td>
              <td className="py-2 text-right">{qty.toLocaleString()}</td>
              <td className="py-2 text-right">{price.toFixed(2)}</td>
              <td className="py-2 text-right">{total.toFixed(2)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="py-2 text-right font-medium">Total ({incoterm})</td>
              <td className="py-2 text-right font-bold">
                {currency} {total.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>

        <p className="mt-6 text-xs text-gray-400">
          Generated with PlotProof. The exporter certifies the above is true and correct.
          Confirm required fields with your customs broker before submission.
        </p>
      </article>
      </Reveal>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  inputMode?: "text" | "decimal" | "numeric";
}) {
  return (
    <label>
      <span className="label">{label}</span>
      <input
        value={value}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        className="field"
      />
    </label>
  );
}
