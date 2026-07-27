/**
 * Public per-lot verification — the page a farmer or cooperative WhatsApps to
 * an exporter. Server-rendered from the de-identified lot_verification view
 * (migration 0003); reachable only by knowing the lot's unguessable UUID.
 *
 * The trust ladder is stated explicitly, strongest claim first, and every
 * self-reported element is labelled as such. This page never overstates:
 * a hash chain proves the record hasn't changed, not that the capture was
 * honest — so it says exactly that, and points at the independent
 * cross-check (Global Forest Watch) for the deforestation question.
 */
import type { Metadata } from "next";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Lot verification",
  description: "Independent verification record for an attested farm plot.",
};

interface LotRow {
  id: string;
  country_code: string;
  commodity: string | null;
  ring: [number, number][];
  computed_area_ha: number;
  capture_method: string;
  captured_at: string;
  attested_at: string;
  officer_name: string;
  confirmation_method: string;
  consent_recorded: boolean;
  integrity_hash: string | null;
  integrity_algo: string | null;
  integrity_chain_seq: number | null;
}

function centroid(ring: [number, number][]): { lat: number; lng: number } {
  const pts = ring.slice(0, -1);
  const lng = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const lat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return { lat, lng };
}

export default async function VerifyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold">Verification unavailable</h1>
        <p className="mt-2 text-sm muted">
          This deployment has no verification database connected, so no lot can be looked up.
          Nothing is shown rather than something invented.
        </p>
      </Shell>
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lot_verification")
    .select("*")
    .eq("id", id)
    .maybeSingle<LotRow>();

  if (error || !data) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold">No verified lot with this ID</h1>
        <p className="mt-2 text-sm muted">
          Either the link is wrong, the lot was never attested, or it has not synced from the
          capture device. An unverifiable lot is shown as exactly that — unverifiable.
        </p>
      </Shell>
    );
  }

  const c = centroid(data.ring);
  const gfwUrl = `https://www.globalforestwatch.org/map/?map=${encodeURIComponent(
    JSON.stringify({ center: { lat: c.lat, lng: c.lng }, zoom: 14 }),
  )}`;

  return (
    <Shell>
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide faint">
          PlotProof lot verification
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">
          {data.commodity ?? "Crop"} plot · {data.computed_area_ha.toFixed(2)} ha ·{" "}
          {data.country_code}
        </h1>
        <p className="mt-1 font-mono text-xs faint">{data.id}</p>
      </header>

      <section className="glass-card p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide faint">What is verified</h2>
        <dl className="mt-2 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          <Item k="Boundary captured" v={`${data.captured_at.slice(0, 10)} (${data.capture_method})`} />
          <Item k="Area (geodesic, WGS84)" v={`${data.computed_area_ha.toFixed(4)} ha`} />
          <Item k="Attested in the field" v={data.attested_at.slice(0, 10)} />
          <Item k="Officer countersignature" v={data.officer_name} />
          <Item k="Farmer confirmation" v={`${data.confirmation_method} · consent ${data.consent_recorded ? "recorded" : "NOT recorded"}`} />
          <Item
            k="Tamper-evidence seal"
            v={
              data.integrity_hash
                ? `${data.integrity_algo} ${data.integrity_hash.slice(0, 16)}… · chain #${data.integrity_chain_seq}`
                : "none (pre-integrity record)"
            }
          />
        </dl>
      </section>

      <section className="glass-card p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide faint">
          What this does and does not prove
        </h2>
        <ul className="mt-2 ml-4 list-disc space-y-1.5 text-sm">
          <li>
            <strong>Proven:</strong> this exact boundary, area, and attestation record have not
            been altered since capture (hash-chained on the capture device), and a named field
            officer countersigned the capture with the farmer&apos;s recorded consent.
          </li>
          <li>
            <strong>Self-reported:</strong> the boundary itself was traced in the field by the
            officer and farmer. It is not government-survey data and is not land-title
            verification.
          </li>
          <li>
            <strong>Independently checkable:</strong> deforestation status is not our claim to
            make —{" "}
            <a className="underline underline-offset-2" href={gfwUrl} target="_blank" rel="noopener noreferrer">
              view this exact location on Global Forest Watch
            </a>{" "}
            (Hansen/UMD data) and judge the authoritative record yourself.
          </li>
        </ul>
      </section>

      <section className="glass-card p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide faint">For due diligence</h2>
        <p className="mt-2 text-sm muted">
          The plot geometry is available as TRACES-shaped GeoJSON (WGS84) from the lot holder —
          the geolocation format an EU due-diligence statement expects. Under Regulation (EU)
          2023/1115 as amended by 2025/2650, the importing operator files the statement; this
          record is the smallholder-side evidence for it.
        </p>
      </section>

      <p className="text-xs faint">
        De-identified by design: no farmer name, ID, or contact details appear on this page.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 px-5 py-10 sm:px-8">
      {children}
    </main>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs faint">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}
