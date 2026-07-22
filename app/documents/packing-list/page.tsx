"use client";

/**
 * Packing list generator, the companion to the commercial invoice. Says what is
 * in each package and its net/gross weight; customs and the buyer check it
 * against the invoice. Prefilled from the saved sale intent, then printed or
 * saved as PDF. Weights come from the shared pure helper so they match the
 * invoice's quantity exactly.
 */
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Printer } from "lucide-react";
import { getProduct } from "@/lib/compliance/catalog";
import { loadIntent } from "@/lib/compliance/intent";
import { markInProgress } from "@/lib/compliance/status";
import { countryName } from "@/lib/public/format";
import {
  computePackingTotals,
  docNumber,
  suggestNetPerPackage,
} from "@/lib/compliance/documents";
import NoIntent from "@/components/documents/NoIntent";
import DocBreadcrumb from "@/components/documents/DocBreadcrumb";
import Reveal from "@/components/motion/Reveal";
import CopyButton from "@/components/motion/CopyButton";
import { hoverLift } from "@/lib/motion/variants";
import { printAs } from "@/lib/print";
import type { SaleIntent } from "@/lib/compliance/types";

const PACKAGE_TYPES = ["Jute bags", "PP woven bags", "Cartons", "Vacuum packs", "Drums"];

export default function PackingListPage() {
  const [intent, setIntent] = useState<SaleIntent | null>(null);
  const [sellerName, setSellerName] = useState("");
  const [sellerAddr, setSellerAddr] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerAddr, setBuyerAddr] = useState("");
  const [packages, setPackages] = useState("");
  const [packageType, setPackageType] = useState(PACKAGE_TYPES[0]);
  const [netPer, setNetPer] = useState("");
  const [grossPer, setGrossPer] = useState("");
  const [marks, setMarks] = useState("");

  const listNo = useMemo(() => docNumber("PL"), []);
  const date = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const i = loadIntent();
    setIntent(i);
    if (i) markInProgress(i, "packing_list"); // opened = started
  }, []);

  if (!intent) {
    return <NoIntent />;
  }

  const product = getProduct(intent.productId);
  const pkgCount = Number(packages) || 0;
  const suggestedNet = suggestNetPerPackage(intent.quantityKg, pkgCount);
  const effNet = Number(netPer) || suggestedNet;
  const effGross = Number(grossPer) || Math.round(effNet * 1.04 * 100) / 100; // ~4% packaging
  const totals = computePackingTotals({
    packages: pkgCount,
    netKgPerPackage: effNet,
    grossKgPerPackage: effGross,
  });

  return (
    <main className="mx-auto max-w-3xl px-5 py-6 sm:px-6">
      <DocBreadcrumb />
      {/* editor, hidden when printing */}
      <Reveal>
      <div className="glass-card mb-5 grid gap-3 p-5 text-sm print:hidden sm:grid-cols-2">
        <h2 className="col-span-full font-semibold">Fill in the packing details</h2>
        <Field label="Your name / farm" value={sellerName} onChange={setSellerName} />
        <Field label="Your address" value={sellerAddr} onChange={setSellerAddr} />
        <Field label="Buyer name" value={buyerName} onChange={setBuyerName} />
        <Field label="Buyer address" value={buyerAddr} onChange={setBuyerAddr} />
        <Field label="Number of packages" value={packages} onChange={setPackages} inputMode="numeric" />
        <label>
          <span className="label">Package type</span>
          <select
            value={packageType}
            onChange={(e) => setPackageType(e.target.value)}
            className="field"
          >
            {PACKAGE_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <Field
          label={`Net kg per package${suggestedNet ? ` (suggested ${suggestedNet})` : ""}`}
          value={netPer}
          onChange={setNetPer}
          inputMode="decimal"
          placeholder={suggestedNet ? String(suggestedNet) : ""}
        />
        <Field
          label="Gross kg per package (with packaging)"
          value={grossPer}
          onChange={setGrossPer}
          inputMode="decimal"
          placeholder={effNet ? String(Math.round(effNet * 1.04 * 100) / 100) : ""}
        />
        <label className="col-span-full">
          <span className="label">Shipping marks &amp; numbers (optional)</span>
          <input
            value={marks}
            onChange={(e) => setMarks(e.target.value)}
            placeholder="e.g. ACME COFFEE / ROTTERDAM / 1-40"
            className="field"
          />
        </label>
        <div className="col-span-full">
          <motion.div {...hoverLift} className="inline-block">
            <button onClick={() => printAs(`Packing List ${listNo}`)} className="btn btn-primary">
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
            <h1 className="text-xl font-bold">PACKING LIST</h1>
            <p className="flex items-center gap-2 text-sm text-gray-600">
              No. {listNo} · {date}
              <CopyButton text={listNo} toastMsg="Packing list number copied" className="print:hidden" />
            </p>
          </div>
          <div className="text-right text-xs text-gray-500">
            Country of origin: {countryName(intent.originCountry)}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs uppercase text-gray-400">Exporter (shipper)</div>
            <div className="font-medium">{sellerName || "-"}</div>
            <div className="whitespace-pre-line text-gray-600">{sellerAddr}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-gray-400">Consignee (buyer)</div>
            <div className="font-medium">{buyerName || "-"}</div>
            <div className="whitespace-pre-line text-gray-600">{buyerAddr}</div>
            <div className="text-gray-600">Destination: {intent.destination}</div>
          </div>
        </div>

        {marks && (
          <p className="mt-3 text-sm">
            <span className="text-xs uppercase text-gray-400">Marks &amp; numbers: </span>
            {marks}
          </p>
        )}

        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-gray-300 text-left">
              <th className="py-2">Description</th>
              <th className="py-2">HS code</th>
              <th className="py-2 text-right">Packages</th>
              <th className="py-2 text-right">Net (kg)</th>
              <th className="py-2 text-right">Gross (kg)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-200">
              <td className="py-2">
                {product?.name ?? intent.productId}
                {intent.organicClaim ? " (organic)" : ""}, {totals.packages} × {packageType.toLowerCase()}
              </td>
              <td className="py-2">{product?.hsCode ?? "-"}</td>
              <td className="py-2 text-right">{totals.packages.toLocaleString()}</td>
              <td className="py-2 text-right">{totals.totalNetKg.toLocaleString()}</td>
              <td className="py-2 text-right">{totals.totalGrossKg.toLocaleString()}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} className="py-2 text-right font-medium">Totals</td>
              <td className="py-2 text-right font-bold">{totals.packages.toLocaleString()}</td>
              <td className="py-2 text-right font-bold">{totals.totalNetKg.toLocaleString()}</td>
              <td className="py-2 text-right font-bold">{totals.totalGrossKg.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>

        <p className="mt-6 text-xs text-gray-400">
          Generated with PlotProof. Net and gross weights must match the goods actually
          shipped and the figures on the commercial invoice. Confirm with your freight
          forwarder before submission.
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
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  inputMode?: "text" | "decimal" | "numeric";
  placeholder?: string;
}) {
  return (
    <label>
      <span className="label">{label}</span>
      <input
        value={value}
        inputMode={inputMode}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="field"
      />
    </label>
  );
}
