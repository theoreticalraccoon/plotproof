"use client";

/**
 * Attestation, what turns a saved polygon into evidence (PROJECT.md).
 * Captures automatically: officer identity + timestamp. Captures in the field:
 * a geotagged, compressed photo taken at the plot, and the farmer's confirmation
 * (signature or thumbprint) with name and ID. Persists offline with the plot.
 */
import { useEffect, useRef, useState } from "react";
import SignaturePad, { type SignaturePadHandle } from "./SignaturePad";
import ActionButton from "@/components/motion/ActionButton";
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
  // Timestamped at the moment the farmer consents, not at save, so the record
  // reflects when consent was actually given. Cleared if the box is unticked.
  const [consentAt, setConsentAt] = useState<string | null>(null);
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
    const processed = await processPhoto(file);
    setPhoto(processed);
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(URL.createObjectURL(processed.blob));
    // Capture where the officer is standing, at photo time. A denied fix is
    // fine, the photo and attestation still stand, just without coordinates.
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

  // Throws on any validation or save failure so the Save button surfaces it as
  // an error toast + shake; resolves on success (which closes the form).
  const submit = async () => {
    if (!officer) throw new Error("Enter the officer name first.");
    if (!photo) throw new Error("Take a photo standing at the plot.");
    if (!farmerName.trim()) throw new Error("Enter the farmer's name.");
    if (!consentAt) throw new Error("Read the consent statement to the farmer and tick the box.");
    const signature = await sigRef.current?.toPng();
    if (!signature) throw new Error(`Capture the farmer's ${method}.`);

    await saveAttestation({
      plotId,
      officer,
      location,
      farmerNameSnapshot: farmerName.trim(),
      farmerIdSnapshot: farmerId.trim() || undefined,
      confirmationMethod: method,
      photo,
      signature,
      consentAt,
    });
    onDone();
  };

  return (
    <div className="glass-card flex flex-col gap-3 p-4" style={{ borderColor: "var(--accent)" }}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Attest this plot</h3>
        <button onClick={onSkip} className="text-sm faint underline underline-offset-2">
          Skip for now
        </button>
      </div>

      {/* Officer identity, auto once set */}
      {officer ? (
        <p className="text-sm muted">
          Officer: <span className="font-semibold">{officer.name}</span> · time recorded
          automatically
        </p>
      ) : (
        <div className="flex gap-2">
          <input
            value={officerName}
            onChange={(e) => setOfficerName(e.target.value)}
            placeholder="Officer name"
            className="field flex-1"
          />
          <button onClick={saveOfficerName} className="btn btn-ghost btn-sm">
            Set
          </button>
        </div>
      )}

      {/* Geotagged photo at the plot */}
      <div>
        <label className="label">Photo at the plot</label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onPhoto}
          className="block text-sm file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[var(--accent-soft)] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-[var(--accent)]"
        />
        {photoUrl && (
          <div className="mt-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt="Plot" loading="lazy" decoding="async" className="max-h-40 rounded-xl border" style={{ borderColor: "var(--glass-border)" }} />
            <p className="text-xs faint">
              {photo && `${photo.width}×${photo.height}, ${formatBytes(photo.bytes)}`}
              {location ? ` · GPS ±${Math.round(location.accuracy ?? 0)} m` : locNote ? ` · ${locNote}` : ""}
            </p>
          </div>
        )}
      </div>

      {/* Farmer identity snapshot */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="label">Farmer name</span>
          <input
            value={farmerName}
            onChange={(e) => setFarmerName(e.target.value)}
            className="field"
          />
        </label>
        <label>
          <span className="label">Farmer ID</span>
          <input
            value={farmerId}
            onChange={(e) => setFarmerId(e.target.value)}
            className="field"
          />
        </label>
      </div>

      {/* Farmer confirmation */}
      <div>
        <div className="mb-1.5 flex items-center gap-4 text-sm">
          <span className="label !mb-0">Farmer confirmation</span>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              checked={method === "signature"}
              onChange={() => setMethod("signature")}
              className="accent-[var(--accent)]"
            />
            Signature
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              checked={method === "thumbprint"}
              onChange={() => setMethod("thumbprint")}
              className="accent-[var(--accent)]"
            />
            Thumbprint
          </label>
          <button
            onClick={() => sigRef.current?.clear()}
            className="ml-auto text-sm faint underline underline-offset-2"
          >
            Clear
          </button>
        </div>
        <SignaturePad ref={sigRef} />
      </div>

      {/* Explicit consent. A thumbprint is biometric data, so implied consent is
          not sufficient: the officer reads this aloud and the farmer agrees. */}
      <div
        className="rounded-xl p-3 text-sm"
        style={{ background: "var(--info-soft)", border: "1px solid var(--info)" }}
      >
        <p className="mb-2 font-semibold" style={{ color: "var(--info)" }}>
          Read this to the farmer before saving
        </p>
        <p className="muted">
          &ldquo;This records your name, your plot boundary, a photo of the plot,
          and your {method}. It is used only to prove your land was not deforested,
          so you can sell to buyers who require that proof. You can ask for it to
          be deleted at any time, and you do not have to agree.&rdquo;
        </p>
        <label className="mt-2.5 flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            checked={consentAt !== null}
            onChange={(e) => setConsentAt(e.target.checked ? new Date().toISOString() : null)}
            className="mt-0.5 accent-[var(--accent)]"
          />
          <span>
            The farmer heard this and agreed.
            {consentAt && (
              <span className="faint"> Recorded {new Date(consentAt).toLocaleTimeString()}.</span>
            )}
          </span>
        </label>
      </div>

      <ActionButton
        onAction={submit}
        className="btn btn-primary"
        loadingLabel="Saving"
        successToast="Attestation saved"
      >
        Save attestation
      </ActionButton>
    </div>
  );
}
