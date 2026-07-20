"use client";

/**
 * Attestation — what turns a saved polygon into evidence (PROJECT.md).
 * Captures automatically: officer identity + timestamp. Captures in the field:
 * a geotagged, compressed photo taken at the plot, and the farmer's confirmation
 * (signature or thumbprint) with name and ID. Persists offline with the plot.
 */
import { useEffect, useRef, useState } from "react";
import SignaturePad, { type SignaturePadHandle } from "./SignaturePad";
import { processPhoto, type ProcessedImage } from "@/lib/intake/image";
import { getOfficer, setOfficer, type OfficerIdentity } from "@/lib/intake/officer";
import { getPosition } from "@/lib/geo/locate";
import { saveAttestation } from "@/lib/intake/store";
import { formatBytes, requestPersistence } from "@/lib/intake/storage";
import type { ConfirmationMethod } from "@/lib/intake/types";

interface Props {
  plotId: string;
  defaultFarmerName: string;
  defaultFarmerId?: string;
  onDone: () => void;
  onSkip: () => void;
}

export default function AttestationForm({
  plotId,
  defaultFarmerName,
  defaultFarmerId,
  onDone,
  onSkip,
}: Props) {
  const [officer, setOfficerState] = useState<OfficerIdentity | null>(null);
  const [officerName, setOfficerName] = useState("");
  const [photo, setPhoto] = useState<ProcessedImage | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [location, setLocation] = useState<
    { lng: number; lat: number; accuracy?: number } | undefined
  >();
  const [locNote, setLocNote] = useState<string | null>(null);
  const [farmerName, setFarmerName] = useState(defaultFarmerName);
  const [farmerId, setFarmerId] = useState(defaultFarmerId ?? "");
  const [method, setMethod] = useState<ConfirmationMethod>("signature");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sigRef = useRef<SignaturePadHandle>(null);

  useEffect(() => {
    setOfficerState(getOfficer());
    void requestPersistence(); // keep the offline queue from being evicted
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
    // photoUrl intentionally not a dep: we revoke the latest on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveOfficerName = () => {
    if (!officerName.trim()) return;
    setOfficerState(setOfficer(officerName));
  };

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const processed = await processPhoto(file);
    setPhoto(processed);
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(URL.createObjectURL(processed.blob));
    // Capture where the officer is standing, at photo time. A denied fix is
    // fine — the photo and attestation still stand, just without coordinates.
    setLocNote("locating…");
    const r = await getPosition({ timeoutMs: 6000 });
    if (r.status === "ok") {
      setLocation({ lng: r.lng, lat: r.lat, accuracy: r.accuracyM });
      setLocNote(null);
    } else {
      setLocation(undefined);
      setLocNote(`no photo location (${r.message.toLowerCase()})`);
    }
  };

  const submit = async () => {
    if (!officer) return setError("Enter the officer name first.");
    if (!photo) return setError("Take a photo standing at the plot.");
    if (!farmerName.trim()) return setError("Enter the farmer's name.");
    const signature = await sigRef.current?.toPng();
    if (!signature) return setError(`Capture the farmer's ${method}.`);

    setBusy(true);
    try {
      await saveAttestation({
        plotId,
        officer,
        location,
        farmerNameSnapshot: farmerName.trim(),
        farmerIdSnapshot: farmerId.trim() || undefined,
        confirmationMethod: method,
        photo,
        signature,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save attestation.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border-2 border-green-600 p-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Attest this plot</h3>
        <button onClick={onSkip} className="text-sm text-gray-500 underline">
          Skip for now
        </button>
      </div>

      {/* Officer identity — auto once set */}
      {officer ? (
        <p className="text-sm text-gray-600">
          Officer: <span className="font-medium">{officer.name}</span> · time recorded
          automatically
        </p>
      ) : (
        <div className="flex gap-2">
          <input
            value={officerName}
            onChange={(e) => setOfficerName(e.target.value)}
            placeholder="Officer name"
            className="flex-1 rounded border px-2 py-2 text-sm"
          />
          <button onClick={saveOfficerName} className="rounded bg-gray-800 px-3 py-2 text-sm text-white">
            Set
          </button>
        </div>
      )}

      {/* Geotagged photo at the plot */}
      <div>
        <label className="text-sm font-medium">Photo at the plot</label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onPhoto}
          className="mt-1 block text-sm"
        />
        {photoUrl && (
          <div className="mt-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt="Plot" className="max-h-40 rounded border" />
            <p className="text-xs text-gray-500">
              {photo && `${photo.width}×${photo.height}, ${formatBytes(photo.bytes)}`}
              {location ? ` · GPS ±${Math.round(location.accuracy ?? 0)} m` : locNote ? ` · ${locNote}` : ""}
            </p>
          </div>
        )}
      </div>

      {/* Farmer identity snapshot */}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-sm">
          Farmer name
          <input
            value={farmerName}
            onChange={(e) => setFarmerName(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-2"
          />
        </label>
        <label className="text-sm">
          Farmer ID
          <input
            value={farmerId}
            onChange={(e) => setFarmerId(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-2"
          />
        </label>
      </div>

      {/* Farmer confirmation */}
      <div>
        <div className="mb-1 flex items-center gap-4 text-sm">
          <span className="font-medium">Farmer confirmation</span>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={method === "signature"}
              onChange={() => setMethod("signature")}
            />
            Signature
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={method === "thumbprint"}
              onChange={() => setMethod("thumbprint")}
            />
            Thumbprint
          </label>
          <button
            onClick={() => sigRef.current?.clear()}
            className="ml-auto text-sm text-gray-500 underline"
          >
            Clear
          </button>
        </div>
        <SignaturePad ref={sigRef} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={submit}
        disabled={busy}
        className="rounded bg-green-600 px-4 py-3 font-medium text-white disabled:opacity-40"
      >
        {busy ? "Saving…" : "Save attestation"}
      </button>
    </div>
  );
}
