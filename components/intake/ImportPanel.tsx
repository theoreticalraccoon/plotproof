"use client";

/**
 * CSV / registry import — highest-priority intake path. Cooperative registries,
 * cadastre exports and prior certification schemes already hold coordinates;
 * importing beats field capture. Columns vary by source, so the officer maps
 * them. Every row runs the SAME save-gate as tracing before it becomes a plot.
 */
import { useMemo, useState } from "react";
import {
  mapRows,
  parseCsv,
  type ColumnMapping,
  type MappedRow,
} from "@/lib/intake/csv";
import { validatePlot } from "@/lib/intake/geometry";
import type { ExistingPlot } from "@/lib/intake/geometry";
import {
  existingRings,
  newId,
  nowIso,
  saveFarmer,
  savePlot,
} from "@/lib/intake/store";
import type { LocalFarmer, LocalPlot, PlotValidation } from "@/lib/intake/types";

const DEMO_COOP = "demo-coop";
const DEMO_COUNTRY = "LK";

type Field = keyof ColumnMapping;
const FIELDS: { key: Field; label: string; required?: boolean }[] = [
  { key: "fullName", label: "Farmer name", required: true },
  { key: "geometry", label: "Geometry (GeoJSON / WKT / coords)", required: true },
  { key: "membershipNo", label: "Membership no." },
  { key: "nationalId", label: "National ID" },
  { key: "village", label: "Village" },
  { key: "phone", label: "Phone" },
  { key: "claimedAreaHa", label: "Claimed area (ha)" },
];

/** Best-effort auto-map from header names. */
function guessMapping(columns: string[]): Partial<ColumnMapping> {
  const find = (re: RegExp) => columns.find((c) => re.test(c.toLowerCase()));
  return {
    fullName: find(/name|farmer/),
    geometry: find(/geom|wkt|polygon|boundary|coord/),
    membershipNo: find(/member|reg/),
    nationalId: find(/nic|national|\bid\b/),
    village: find(/village|gn|division/),
    phone: find(/phone|mobile|tel/),
    claimedAreaHa: find(/area|ha|extent|size/),
  };
}

interface RowResult {
  row: MappedRow;
  validation?: PlotValidation;
}

export default function ImportPanel({ onImported }: { onImported?: () => void }) {
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>({});
  const [results, setResults] = useState<RowResult[] | null>(null);
  const [existing, setExisting] = useState<ExistingPlot[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canValidate = Boolean(mapping.fullName && mapping.geometry);

  const summary = useMemo(() => {
    if (!results) return null;
    let ok = 0,
      warn = 0,
      bad = 0;
    for (const r of results) {
      if (r.row.error || !r.validation?.canSave) bad++;
      else if (r.validation.warnings.length > 0) warn++;
      else ok++;
    }
    return { ok, warn, bad };
  }, [results]);

  async function loadText(text: string, source: string) {
    const parsed = parseCsv(text);
    setColumns(parsed.columns);
    setRows(parsed.rows);
    setMapping(guessMapping(parsed.columns));
    setResults(null);
    setMessage(`Loaded ${parsed.rows.length} rows from ${source}.`);
    setExisting(await existingRings());
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await loadText(await file.text(), file.name);
  }

  // Loads the bundled real seed (public/seed/plots.csv) if it's been added.
  async function loadSeed() {
    try {
      const res = await fetch("/seed/plots.csv", { cache: "no-store" });
      if (!res.ok) {
        setMessage("No bundled seed file yet — add your data at public/seed/plots.csv.");
        return;
      }
      await loadText(await res.text(), "bundled seed");
    } catch {
      setMessage("Couldn't load the bundled seed file.");
    }
  }

  function validateAll() {
    if (!canValidate) return;
    const mapped = mapRows(rows, mapping as ColumnMapping);
    const out: RowResult[] = mapped.map((row) => {
      if (row.error || !row.ring) return { row };
      const validation = validatePlot(row.ring, {
        method: "imported",
        claimedAreaHa: row.claimedAreaHa,
        existingPlots: existing,
      });
      return { row, validation };
    });
    setResults(out);
  }

  async function importValid() {
    if (!results) return;
    setBusy(true);
    let imported = 0;
    // Dedupe farmers within this batch by membership no. (fallback: name).
    const farmerIds = new Map<string, string>();
    try {
      for (const { row, validation } of results) {
        if (row.error || !validation?.canSave || !validation.orderedRing) continue;
        const key = row.membershipNo || row.fullName;
        let farmerId = farmerIds.get(key);
        if (!farmerId) {
          farmerId = newId();
          farmerIds.set(key, farmerId);
          const farmer: LocalFarmer = {
            id: farmerId,
            cooperativeId: DEMO_COOP,
            countryCode: DEMO_COUNTRY,
            fullName: row.fullName,
            nationalId: row.nationalId,
            membershipNo: row.membershipNo,
            village: row.village,
            phone: row.phone,
            capturedVia: "roster_import",
            createdAt: nowIso(),
          };
          await saveFarmer(farmer);
        }
        const plot: LocalPlot = {
          id: newId(),
          farmerId,
          cooperativeId: DEMO_COOP,
          countryCode: DEMO_COUNTRY,
          ring: validation.orderedRing,
          captureMethod: "imported",
          claimedAreaHa: row.claimedAreaHa,
          computedAreaHa: validation.areaHa ?? 0,
          acknowledgedWarnings: validation.warnings.map((w) => w.code),
          status: "captured",
          syncStatus: "queued",
          capturedAt: nowIso(),
        };
        await savePlot(plot);
        imported++;
      }
      setMessage(`Imported ${imported} plot(s). Queued for sync.`);
      onImported?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input type="file" accept=".csv,text/csv" onChange={onFile} className="text-sm" />
        <button onClick={loadSeed} className="rounded bg-gray-200 px-3 py-1.5 text-sm">
          Load bundled seed
        </button>
        {message && <p className="w-full text-sm text-gray-700">{message}</p>}
      </div>

      {columns.length > 0 && (
        <div className="grid gap-2 rounded border border-gray-200 p-3 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <label key={f.key} className="text-sm">
              {f.label}
              {f.required && <span className="text-red-600"> *</span>}
              <select
                value={mapping[f.key] ?? ""}
                onChange={(e) =>
                  setMapping((m) => ({ ...m, [f.key]: e.target.value || undefined }))
                }
                className="mt-1 w-full rounded border px-2 py-2"
              >
                <option value="">— none —</option>
                {columns.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <div className="sm:col-span-2">
            <button
              onClick={validateAll}
              disabled={!canValidate}
              className="rounded bg-gray-800 px-4 py-2 text-sm text-white disabled:opacity-40"
            >
              Preview &amp; validate
            </button>
          </div>
        </div>
      )}

      {results && summary && (
        <div className="flex flex-col gap-2">
          <div className="text-sm">
            <span className="text-green-700">{summary.ok} ready</span>
            {" · "}
            <span className="text-amber-700">{summary.warn} with warnings</span>
            {" · "}
            <span className="text-red-700">{summary.bad} rejected</span>
          </div>
          <div className="max-h-72 overflow-auto rounded border border-gray-200">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-gray-100">
                <tr>
                  <th className="p-2">Farmer</th>
                  <th className="p-2">Area (ha)</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {results.slice(0, 300).map((r, i) => {
                  const status = r.row.error
                    ? { text: r.row.error, cls: "text-red-700" }
                    : !r.validation?.canSave
                      ? {
                          text: r.validation?.errors[0]?.message ?? "invalid",
                          cls: "text-red-700",
                        }
                      : r.validation.warnings.length
                        ? { text: r.validation.warnings[0].message, cls: "text-amber-700" }
                        : { text: "ready", cls: "text-green-700" };
                  return (
                    <tr key={i} className="border-t">
                      <td className="p-2">{r.row.fullName || "—"}</td>
                      <td className="p-2">{r.validation?.areaHa?.toFixed(3) ?? "—"}</td>
                      <td className={`p-2 ${status.cls}`}>{status.text}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button
            onClick={importValid}
            disabled={busy || summary.ok + summary.warn === 0}
            className="rounded bg-green-600 px-4 py-3 font-medium text-white disabled:opacity-40"
          >
            {busy ? "Importing…" : `Import ${summary.ok + summary.warn} valid plot(s)`}
          </button>
        </div>
      )}
    </div>
  );
}
