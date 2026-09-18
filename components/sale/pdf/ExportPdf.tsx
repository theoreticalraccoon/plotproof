/**
 * The export documents as real PDF files.
 *
 * Loaded only when the officer presses download (see `lib/sale/download.ts`):
 * the renderer is several hundred kilobytes and nobody who only fills in the
 * questionnaire should pay for it.
 *
 * Renders the models from `lib/sale/documents.ts` and nothing else — the same
 * data the on-screen preview shows — so the file that is sent is the file that
 * was checked. Documents are in English on purpose: customs authorities and
 * banks expect it, whatever language the officer works in.
 */
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type {
  ExportDoc,
  InvoiceDoc,
  OriginDoc,
  PackingListDoc,
  PartyBlock,
} from "@/lib/sale/documents";

const TITLES: Record<ExportDoc["kind"], string> = {
  invoice: "COMMERCIAL INVOICE",
  "packing-list": "PACKING LIST",
  "certificate-of-origin": "CERTIFICATE OF ORIGIN — DRAFT FOR CERTIFICATION",
};

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 9.5, fontFamily: "Helvetica", color: "#111" },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  title: { fontSize: 15, fontFamily: "Helvetica-Bold", letterSpacing: 0.5 },
  meta: { textAlign: "right", fontSize: 9 },
  metaLabel: { color: "#666" },
  rule: { borderBottomWidth: 1, borderBottomColor: "#111", marginVertical: 12 },
  thin: { borderBottomWidth: 0.5, borderBottomColor: "#bbb", marginVertical: 8 },
  row: { flexDirection: "row", gap: 16 },
  col: { flex: 1 },
  label: { fontSize: 7.5, color: "#666", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 3 },
  bold: { fontFamily: "Helvetica-Bold" },
  table: { borderWidth: 0.5, borderColor: "#999", marginTop: 6 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#999" },
  th: { padding: 5, fontFamily: "Helvetica-Bold", fontSize: 8, backgroundColor: "#f1f1ee" },
  td: { padding: 5 },
  right: { textAlign: "right" },
  foot: { marginTop: 18, fontSize: 8, color: "#444", lineHeight: 1.4 },
  sign: { marginTop: 34, width: 200, borderTopWidth: 0.5, borderTopColor: "#111", paddingTop: 4, fontSize: 8 },
  draft: {
    position: "absolute",
    top: 330,
    left: 70,
    fontSize: 90,
    color: "#d9534f",
    opacity: 0.12,
    transform: "rotate(-30deg)",
    fontFamily: "Helvetica-Bold",
  },
});

const num = (n: number, dp = 2) =>
  n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });

function Party({ label, party }: { label: string; party: PartyBlock }) {
  return (
    <View style={s.col}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.bold}>{party.name || "—"}</Text>
      {party.lines.map((l) => (
        <Text key={l}>{l}</Text>
      ))}
    </View>
  );
}

function Header({ doc }: { doc: ExportDoc }) {
  return (
    <>
      {doc.draft && <Text style={s.draft} fixed>DRAFT</Text>}
      <View style={s.head}>
        <Text style={s.title}>{TITLES[doc.kind]}</Text>
        <View style={s.meta}>
          <Text>
            <Text style={s.metaLabel}>No. </Text>
            {doc.number}
          </Text>
          <Text>
            <Text style={s.metaLabel}>Date </Text>
            {doc.date}
          </Text>
        </View>
      </View>
      <View style={s.rule} />
    </>
  );
}

function Route({ from, to, vessel }: { from: string; to: string; vessel: string }) {
  return (
    <View style={s.row}>
      <View style={s.col}>
        <Text style={s.label}>Port of loading</Text>
        <Text>{from || "—"}</Text>
      </View>
      <View style={s.col}>
        <Text style={s.label}>Port of discharge</Text>
        <Text>{to || "—"}</Text>
      </View>
      <View style={s.col}>
        <Text style={s.label}>Vessel / flight</Text>
        <Text>{vessel || "—"}</Text>
      </View>
    </View>
  );
}

function InvoicePage({ doc }: { doc: InvoiceDoc }) {
  return (
    <Page size="A4" style={s.page}>
      <Header doc={doc} />
      <View style={s.row}>
        <Party label="Exporter" party={doc.exporter} />
        <Party label="Buyer / consignee" party={doc.buyer} />
      </View>
      <View style={s.thin} />
      <Route from={doc.route.from} to={doc.route.to} vessel={doc.route.vessel} />
      <View style={[s.row, { marginTop: 8 }]}>
        <View style={s.col}>
          <Text style={s.label}>Terms of delivery</Text>
          <Text>
            {doc.incoterm} {doc.incotermPlace} (Incoterms® 2020)
          </Text>
        </View>
        <View style={s.col}>
          <Text style={s.label}>Payment terms</Text>
          <Text>{doc.paymentTerms || "—"}</Text>
        </View>
        <View style={s.col}>
          <Text style={s.label}>Country of origin</Text>
          <Text>{doc.origin}</Text>
        </View>
      </View>

      <View style={s.table}>
        <View style={s.tr}>
          <Text style={[s.th, { flex: 3 }]}>Description of goods</Text>
          <Text style={[s.th, { flex: 1 }]}>HS code</Text>
          <Text style={[s.th, { flex: 1 }, s.right]}>Net kg</Text>
          <Text style={[s.th, { flex: 1 }, s.right]}>Price/kg ({doc.currency})</Text>
          <Text style={[s.th, { flex: 1.2 }, s.right]}>Amount ({doc.currency})</Text>
        </View>
        <View style={s.tr}>
          <Text style={[s.td, { flex: 3 }]}>{doc.line.description || "—"}</Text>
          <Text style={[s.td, { flex: 1 }]}>{doc.line.hsCode}</Text>
          <Text style={[s.td, { flex: 1 }, s.right]}>{num(doc.line.quantityKg)}</Text>
          <Text style={[s.td, { flex: 1 }, s.right]}>{num(doc.line.unitPrice)}</Text>
          <Text style={[s.td, { flex: 1.2 }, s.right]}>{num(doc.line.amount)}</Text>
        </View>
        <View style={[s.tr, { borderBottomWidth: 0 }]}>
          <Text style={[s.td, { flex: 6 }, s.right, s.bold]}>TOTAL {doc.incoterm} {doc.currency}</Text>
          <Text style={[s.td, { flex: 1.2 }, s.right, s.bold]}>{num(doc.line.amount)}</Text>
        </View>
      </View>

      <Text style={s.foot}>
        {doc.packages} packages · total net weight {num(doc.netKg)} kg · total gross weight {num(doc.grossKg)} kg
        {doc.route.mode ? ` · ${doc.route.mode}` : ""}
        {doc.route.date ? ` · shipment ${doc.route.date}` : ""}
      </Text>

      {doc.rexNumber && (
        <View style={{ marginTop: 12, padding: 8, borderWidth: 0.5, borderColor: "#999" }}>
          <Text style={s.label}>Statement on origin (EU GSP)</Text>
          <Text>REX number of the exporter: {doc.rexNumber}</Text>
          <Text style={{ fontSize: 8, color: "#555", marginTop: 3 }}>
            Add the statement-on-origin text prescribed for EU GSP (Annex 22-07, Commission Implementing
            Regulation (EU) 2015/2447) exactly as published, and confirm it with the Department of Commerce
            before shipment.
          </Text>
        </View>
      )}

      <Text style={s.foot}>We certify that this invoice is true and correct.</Text>
      <Text style={s.sign}>Authorised signature and company stamp</Text>
    </Page>
  );
}

function PackingPage({ doc }: { doc: PackingListDoc }) {
  return (
    <Page size="A4" style={s.page}>
      <Header doc={doc} />
      <View style={s.row}>
        <Party label="Exporter" party={doc.exporter} />
        <Party label="Consignee" party={doc.buyer} />
      </View>
      <View style={s.thin} />
      <Route from={doc.route.from} to={doc.route.to} vessel={doc.route.vessel} />
      <View style={[s.row, { marginTop: 8 }]}>
        <View style={s.col}>
          <Text style={s.label}>Invoice number</Text>
          <Text>{doc.invoiceNumber}</Text>
        </View>
        <View style={s.col}>
          <Text style={s.label}>Shipping marks</Text>
          <Text>{doc.marks || "—"}</Text>
        </View>
      </View>

      <View style={s.table}>
        <View style={s.tr}>
          <Text style={[s.th, { flex: 3 }]}>Description</Text>
          <Text style={[s.th, { flex: 1 }]}>HS code</Text>
          <Text style={[s.th, { flex: 1.4 }]}>Package</Text>
          <Text style={[s.th, { flex: 0.8 }, s.right]}>Qty</Text>
          <Text style={[s.th, { flex: 1 }, s.right]}>Net kg each</Text>
          <Text style={[s.th, { flex: 1 }, s.right]}>Gross kg each</Text>
        </View>
        <View style={s.tr}>
          <Text style={[s.td, { flex: 3 }]}>{doc.description || "—"}</Text>
          <Text style={[s.td, { flex: 1 }]}>{doc.hsCode}</Text>
          <Text style={[s.td, { flex: 1.4 }]}>{doc.packageType}</Text>
          <Text style={[s.td, { flex: 0.8 }, s.right]}>{doc.packages}</Text>
          <Text style={[s.td, { flex: 1 }, s.right]}>{num(doc.netKgPerPackage)}</Text>
          <Text style={[s.td, { flex: 1 }, s.right]}>{num(doc.grossKgPerPackage)}</Text>
        </View>
        <View style={[s.tr, { borderBottomWidth: 0 }]}>
          <Text style={[s.td, { flex: 5.4 }, s.bold]}>TOTAL</Text>
          <Text style={[s.td, { flex: 0.8 }, s.right, s.bold]}>{doc.packages}</Text>
          <Text style={[s.td, { flex: 1 }, s.right, s.bold]}>{num(doc.totalNetKg)}</Text>
          <Text style={[s.td, { flex: 1 }, s.right, s.bold]}>{num(doc.totalGrossKg)}</Text>
        </View>
      </View>

      <Text style={s.sign}>Authorised signature</Text>
    </Page>
  );
}

function OriginPage({ doc }: { doc: OriginDoc }) {
  return (
    <Page size="A4" style={s.page}>
      <Header doc={doc} />
      <Text style={{ fontSize: 8.5, color: "#555", marginBottom: 10 }}>
        Prepared by the exporter for certification. This draft is not a certificate of origin until it is
        certified by the Department of Commerce or a recognised chamber of commerce in Sri Lanka.
      </Text>
      <View style={s.row}>
        <Party label="1. Exporter" party={doc.exporter} />
        <Party label="2. Consignee" party={doc.consignee} />
      </View>
      <View style={s.thin} />
      <View style={s.row}>
        <View style={s.col}>
          <Text style={s.label}>3. Country of origin</Text>
          <Text style={s.bold}>{doc.origin}</Text>
        </View>
        <View style={s.col}>
          <Text style={s.label}>4. Country of destination</Text>
          <Text>{doc.destinationCountry || "—"}</Text>
        </View>
        <View style={s.col}>
          <Text style={s.label}>5. Producer</Text>
          <Text>{doc.producer || "—"}</Text>
        </View>
      </View>
      <View style={[s.thin]} />
      <Route from={doc.route.from} to={doc.route.to} vessel={doc.route.vessel} />

      <View style={s.table}>
        <View style={s.tr}>
          <Text style={[s.th, { flex: 1.4 }]}>Marks</Text>
          <Text style={[s.th, { flex: 1.4 }]}>Packages</Text>
          <Text style={[s.th, { flex: 3 }]}>Description of goods</Text>
          <Text style={[s.th, { flex: 1 }]}>HS code</Text>
          <Text style={[s.th, { flex: 1 }, s.right]}>Gross kg</Text>
        </View>
        <View style={[s.tr, { borderBottomWidth: 0 }]}>
          <Text style={[s.td, { flex: 1.4 }]}>{doc.marks || "—"}</Text>
          <Text style={[s.td, { flex: 1.4 }]}>
            {doc.packages} × {doc.packageType}
          </Text>
          <Text style={[s.td, { flex: 3 }]}>{doc.description || "—"}</Text>
          <Text style={[s.td, { flex: 1 }]}>{doc.hsCode}</Text>
          <Text style={[s.td, { flex: 1 }, s.right]}>{num(doc.grossKg)}</Text>
        </View>
      </View>

      <Text style={s.foot}>
        Commercial invoice {doc.invoiceNumber} dated {doc.invoiceDate}.
      </Text>
      <Text style={s.foot}>
        The undersigned exporter declares that the goods described above were produced in Sri Lanka.
      </Text>
      <View style={s.row}>
        <Text style={s.sign}>Exporter&apos;s signature and date</Text>
        <Text style={[s.sign, { marginLeft: 40 }]}>Certifying authority — stamp and signature</Text>
      </View>
    </Page>
  );
}

export function DocPages({ doc }: { doc: ExportDoc }) {
  if (doc.kind === "invoice") return <InvoicePage doc={doc} />;
  if (doc.kind === "packing-list") return <PackingPage doc={doc} />;
  return <OriginPage doc={doc} />;
}

/** One PDF holding any number of documents, in the order given. */
export default function ExportPdf({ docs, title }: { docs: ExportDoc[]; title: string }) {
  return (
    <Document title={title} author="PlotProof" creator="PlotProof" producer="PlotProof">
      {docs.map((d) => (
        <DocPages key={d.kind} doc={d} />
      ))}
    </Document>
  );
}
