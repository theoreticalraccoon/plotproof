"use client";

/**
 * Certificate of origin — DRAFT preparer. This is an authority-issued document:
 * only a Chamber of Commerce or national trade authority can certify it. We
 * honour the project's rule that the app never issues what an authority must —
 * so we prepare a filled draft the farmer prints and takes to be certified,
 * which saves the tedious form-filling without pretending to be the certificate.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getProduct } from "@/lib/compliance/catalog";
import { loadIntent } from "@/lib/compliance/intent";
import { markInProgress } from "@/lib/compliance/status";
import { countryName } from "@/lib/public/format";
import { docNumber } from "@/lib/compliance/documents";
import type { SaleIntent } from "@/lib/compliance/types";

export default function CertificateOfOriginPage() {
  const [intent, setIntent] = useState<SaleIntent | null>(null);
  const [sellerName, setSellerName] = useState("");
  const [sellerAddr, setSellerAddr] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerAddr, setBuyerAddr] = useState("");
  const [transport, setTransport] = useState("");
  const [marks, setMarks] = useState("");

  const refNo = useMemo(() => docNumber("CO"), []);
  const date = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const i = loadIntent();
    setIntent(i);
    if (i) markInProgress(i, "certificate_of_origin"); // opened = started
  }, []);

  if (!intent) {
    return (
      <main className="mx-auto max-w-lg p-8 text-center">
        <p className="text-sm text-gray-600">No sale details yet.</p>
        <Link href="/sell" className="mt-3 inline-block rounded bg-green-600 px-4 py-2 text-sm text-white">
          Start with “Sell your harvest”
        </Link>
      </main>
    );
  }

  const product = getProduct(intent.productId);
  const origin = countryName(intent.originCountry);

  return (
    <main className="mx-auto max-w-3xl p-6">
      {/* not-yet-valid banner — printed too, on purpose */}
      <div className="mb-4 rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
        <strong>This is a draft, not a valid certificate.</strong> A certificate of origin
        only becomes valid once it is certified and stamped by an authorised body —
        usually the Chamber of Commerce or trade authority in {origin}. Print this draft,
        then take or submit it to them to be certified. We prepared it; we cannot issue it.
      </div>

      {/* editor — hidden when printing */}
      <div className="mb-4 grid gap-2 rounded-lg border border-gray-200 p-4 text-sm print:hidden sm:grid-cols-2">
        <h2 className="col-span-full font-semibold">Fill in the details</h2>
        <Field label="Your name / farm (exporter)" value={sellerName} onChange={setSellerName} />
        <Field label="Your address" value={sellerAddr} onChange={setSellerAddr} />
        <Field label="Consignee (buyer)" value={buyerName} onChange={setBuyerName} />
        <Field label="Consignee address" value={buyerAddr} onChange={setBuyerAddr} />
        <Field label="Transport (optional)" value={transport} onChange={setTransport} placeholder="e.g. sea, Colombo → Rotterdam" />
        <Field label="Marks & numbers (optional)" value={marks} onChange={setMarks} placeholder="e.g. 1-40" />
        <div className="col-span-full">
          <button onClick={() => window.print()} className="rounded bg-green-600 px-4 py-2 text-sm text-white">
            Print / Save as PDF
          </button>
        </div>
      </div>

      {/* the draft document */}
      <article className="rounded-lg border border-gray-300 p-6 print:border-0 print:p-0">
        <div className="flex items-start justify-between border-b border-gray-300 pb-3">
          <div>
            <h1 className="text-xl font-bold">CERTIFICATE OF ORIGIN</h1>
            <p className="text-sm text-gray-600">Draft ref. {refNo} · {date}</p>
          </div>
          <div className="text-right text-xs font-semibold uppercase text-amber-700">
            Draft — awaiting certification
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs uppercase text-gray-400">1. Exporter</div>
            <div className="font-medium">{sellerName || "—"}</div>
            <div className="whitespace-pre-line text-gray-600">{sellerAddr}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-gray-400">2. Consignee</div>
            <div className="font-medium">{buyerName || "—"}</div>
            <div className="whitespace-pre-line text-gray-600">{buyerAddr}</div>
            <div className="text-gray-600">Destination: {intent.destination}</div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs uppercase text-gray-400">3. Country of origin</div>
            <div className="font-medium">{origin}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-gray-400">4. Transport details</div>
            <div className="text-gray-600">{transport || "—"}</div>
          </div>
        </div>

        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-y border-gray-300 text-left">
              <th className="py-2">5. Marks &amp; numbers</th>
              <th className="py-2">6. Description of goods</th>
              <th className="py-2">HS code</th>
              <th className="py-2 text-right">Quantity (kg)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-200">
              <td className="py-2">{marks || "—"}</td>
              <td className="py-2">
                {product?.name ?? intent.productId}
                {intent.organicClaim ? " (organic)" : ""}
              </td>
              <td className="py-2">{product?.hsCode ?? "—"}</td>
              <td className="py-2 text-right">{intent.quantityKg.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs uppercase text-gray-400">7. Declaration by the exporter</div>
            <p className="mt-1 text-gray-600">
              I, the undersigned, declare that the goods described above originate in {origin}.
            </p>
            <div className="mt-8 border-t border-gray-300 pt-1 text-xs text-gray-500">
              Signature &amp; date
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-gray-400">8. Certification by the authority</div>
            <p className="mt-1 text-gray-600">
              To be completed, stamped and signed by the certifying body.
            </p>
            <div className="mt-8 border-t border-gray-300 pt-1 text-xs text-gray-500">
              Authorised signature, stamp &amp; date
            </div>
          </div>
        </div>

        <p className="mt-6 text-xs text-gray-400">
          Prepared with PlotProof. Not valid until certified by an authorised body in {origin}.
          Some destinations or preferential trade schemes require a specific form (e.g. EUR.1,
          Form A) — check with your Chamber of Commerce which form applies.
        </p>
      </article>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="text-sm">
      {label}
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded border px-2 py-2"
      />
    </label>
  );
}
