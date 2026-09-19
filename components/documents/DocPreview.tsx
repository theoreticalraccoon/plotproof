"use client";

/** A generated document, on screen, exactly as it will print. */
import type { ExportDoc, PartyBlock } from "@/lib/sale/documents";

export default function DocPreview({ doc }: { doc: ExportDoc }) {
  return (
    <article className="doc-sheet relative overflow-hidden p-6 text-[0.82rem] leading-relaxed sm:p-9">
      {doc.draft && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 select-none font-display text-[5.5rem] font-bold tracking-[0.3em]"
          style={{ transform: "translate(-50%,-50%) rotate(-28deg)", color: "rgba(0,0,0,0.07)" }}
        >
          DRAFT
        </span>
      )}

      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-300 pb-3">
        <div>
          <h2 className="text-[1.05rem] font-bold uppercase tracking-wide">{TITLE[doc.kind]}</h2>
          <p className="mt-0.5 font-mono text-[0.75rem] text-gray-600">
            No. {doc.number || "-"} · {doc.date}
          </p>
        </div>
        <p className="text-right text-[0.72rem] uppercase tracking-wide text-gray-500">
          Country of origin
          <br />
          <span className="text-[0.85rem] font-semibold normal-case tracking-normal text-black">Sri Lanka</span>
        </p>
      </header>

      {doc.kind === "invoice" && <Invoice doc={doc} />}
      {doc.kind === "packing-list" && <Packing doc={doc} />}
      {doc.kind === "certificate-of-origin" && <Origin doc={doc} />}

      <p className="mt-7 border-t border-gray-200 pt-3 text-[0.68rem] text-gray-500">
        {doc.kind === "certificate-of-origin"
          ? "Prepared by the exporter for certification. It is not a certificate until the Department of Commerce or an authorised chamber has certified it."
          : "Prepared by the exporter in PlotProof. The exporter certifies the particulars above are true and correct."}
      </p>
    </article>
  );
}

const TITLE: Record<ExportDoc["kind"], string> = {
  invoice: "Commercial invoice",
  "packing-list": "Packing list",
  "certificate-of-origin": "Certificate of origin (draft)",
};

// --- per-document bodies -----------------------------------------------------

function Invoice({ doc }: { doc: Extract<ExportDoc, { kind: "invoice" }> }) {
  const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Party caption="Exporter (seller)" block={doc.exporter} />
        <Party caption="Importer (buyer)" block={doc.buyer} />
      </div>

      <table className="mt-5 w-full border-collapse">
        <thead>
          <tr className="border-y border-gray-300 text-left text-[0.72rem] uppercase tracking-wide text-gray-500">
            <th className="py-2 font-medium">Description</th>
            <th className="py-2 font-medium">HS code</th>
            <th className="py-2 text-right font-medium">Qty (kg)</th>
            <th className="py-2 text-right font-medium">Unit price</th>
            <th className="py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-gray-200 align-top">
            <td className="py-2 pr-3">{doc.line.description || "-"}</td>
            <td className="py-2 pr-3 font-mono text-[0.78rem]">{doc.line.hsCode || "-"}</td>
            <td className="py-2 text-right tabular-nums">{doc.line.quantityKg.toLocaleString()}</td>
            <td className="py-2 text-right tabular-nums">{money(doc.line.unitPrice)}</td>
            <td className="py-2 text-right tabular-nums">{money(doc.line.amount)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} className="py-2 text-right font-medium">
              Total, {doc.incoterm} {doc.incotermPlace || "-"}
            </td>
            <td className="py-2 text-right font-bold tabular-nums">
              {doc.currency} {money(doc.line.amount)}
            </td>
          </tr>
        </tfoot>
      </table>

      <dl className="mt-5 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <Row label="Terms of delivery" value={`${doc.incoterm} ${doc.incotermPlace}`.trim()} />
        <Row label="Terms of payment" value={doc.paymentTerms} />
        <Row label="Packages" value={`${doc.packages.toLocaleString()} (${doc.netKg.toLocaleString()} kg net, ${doc.grossKg.toLocaleString()} kg gross)`} />
        <Row label="Transport" value={doc.route.mode} />
        <Row label="From" value={doc.route.from} />
        <Row label="To" value={doc.route.to} />
        <Row label="Vessel / flight" value={doc.route.vessel} />
        <Row label="Shipment date" value={doc.route.date} />
      </dl>

      {doc.rexNumber && (
        <div className="mt-5 border-l-2 border-gray-300 pl-3">
          <p className="text-[0.72rem] uppercase tracking-wide text-gray-500">Statement on origin</p>
          <p className="mt-1">
            Registered exporter number <span className="font-mono">{doc.rexNumber}</span>.
          </p>
          <p className="mt-1 text-[0.72rem] text-gray-500">
            Add the statement-on-origin wording from Annex 22-07 of Regulation (EU) 2015/2447 here, in the language of
            your choice, and sign it. PlotProof does not write it for you: the exact wording is the legal declaration.
          </p>
        </div>
      )}
    </>
  );
}

function Packing({ doc }: { doc: Extract<ExportDoc, { kind: "packing-list" }> }) {
  return (
    <>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Party caption="Exporter" block={doc.exporter} />
        <Party caption="Consignee" block={doc.buyer} />
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <Row label="Invoice number" value={doc.invoiceNumber} />
        <Row label="HS code" value={doc.hsCode} />
        <Row label="Shipping marks" value={doc.marks} />
        <Row label="Vessel / flight" value={doc.route.vessel} />
        <Row label="From" value={doc.route.from} />
        <Row label="To" value={doc.route.to} />
      </dl>

      <table className="mt-5 w-full border-collapse">
        <thead>
          <tr className="border-y border-gray-300 text-left text-[0.72rem] uppercase tracking-wide text-gray-500">
            <th className="py-2 font-medium">Goods</th>
            <th className="py-2 text-right font-medium">Packages</th>
            <th className="py-2 text-right font-medium">Net each</th>
            <th className="py-2 text-right font-medium">Gross each</th>
            <th className="py-2 text-right font-medium">Total net</th>
            <th className="py-2 text-right font-medium">Total gross</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-gray-200 align-top">
            <td className="py-2 pr-3">
              {doc.description || "-"}
              {doc.packageType && <span className="block text-gray-500">in {doc.packageType}</span>}
            </td>
            <td className="py-2 text-right tabular-nums">{doc.packages.toLocaleString()}</td>
            <td className="py-2 text-right tabular-nums">{doc.netKgPerPackage} kg</td>
            <td className="py-2 text-right tabular-nums">{doc.grossKgPerPackage} kg</td>
            <td className="py-2 text-right tabular-nums">{doc.totalNetKg.toLocaleString()} kg</td>
            <td className="py-2 text-right tabular-nums">{doc.totalGrossKg.toLocaleString()} kg</td>
          </tr>
        </tbody>
      </table>

      <p className="mt-3 text-[0.72rem] text-gray-500">
        These figures must match the commercial invoice exactly. A mismatch between the two is one of the commonest
        reasons a consignment is held at the border.
      </p>
    </>
  );
}

function Origin({ doc }: { doc: Extract<ExportDoc, { kind: "certificate-of-origin" }> }) {
  return (
    <>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Party caption="Exporter" block={doc.exporter} />
        <Party caption="Consignee" block={doc.consignee} />
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        <Row label="Producer" value={doc.producer} />
        <Row label="Country of origin" value={doc.origin} />
        <Row label="Country of destination" value={doc.destinationCountry} />
        <Row label="Transport" value={doc.route.vessel} />
        <Row label="From" value={doc.route.from} />
        <Row label="To" value={doc.route.to} />
        <Row label="Invoice" value={`${doc.invoiceNumber} of ${doc.invoiceDate}`} />
        <Row label="HS code" value={doc.hsCode} />
      </dl>

      <div className="mt-5 border-t border-gray-300 pt-3">
        <p className="text-[0.72rem] uppercase tracking-wide text-gray-500">Marks, numbers and description of goods</p>
        <p className="mt-1 whitespace-pre-line">{doc.marks || "-"}</p>
        <p className="mt-2">
          {doc.packages.toLocaleString()} {doc.packageType || "packages"}, {doc.description || "-"}
        </p>
        <p className="mt-1">Gross weight: {doc.grossKg.toLocaleString()} kg</p>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <Signature caption="Declaration by the exporter" note="I declare that the goods described above originate in Sri Lanka." />
        <Signature caption="Certification by the competent authority" note="Stamp and signature of the certifying body." />
      </div>
    </>
  );
}

// --- shared bits ---------------------------------------------------------------

function Party({ caption, block }: { caption: string; block: PartyBlock }) {
  return (
    <div>
      <p className="text-[0.72rem] uppercase tracking-wide text-gray-500">{caption}</p>
      <p className="mt-0.5 font-semibold">{block.name || "-"}</p>
      {block.lines.map((l, i) => (
        <p key={i} className="text-gray-600">
          {l}
        </p>
      ))}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 text-gray-500">{label}:</dt>
      <dd className="min-w-0 font-medium">{value.trim() || "-"}</dd>
    </div>
  );
}

function Signature({ caption, note }: { caption: string; note: string }) {
  return (
    <div>
      <p className="text-[0.72rem] uppercase tracking-wide text-gray-500">{caption}</p>
      <p className="mt-1 text-[0.75rem] text-gray-600">{note}</p>
      <div className="mt-8 border-t border-gray-400 pt-1 text-[0.7rem] text-gray-500">Date, name and signature</div>
    </div>
  );
}
