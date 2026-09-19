"use client";

// Attestation, what turns a saved polygon into evidence (PROJECT.md). Captures automatically:
// officer identity + timestamp.
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { EASE_OUT_2 } from "@/lib/motion/variants";
import SignaturePad, { type SignaturePadHandle } from "./SignaturePad";
import ActionButton from "@/components/motion/ActionButton";
import { SkeletonBlock } from "@/components/motion/Skeleton";
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

// Photo compression runs on the phone and takes a visible moment on a 4–8 MB camera shot, so it
// is a state, not an instant.
type PhotoState = "idle" | "processing" | "ready" | "error";
// The GPS reading is separate from the photo: the photo can succeed while the fix fails, and
// the officer needs to see which of the two happened.
type LocState = "idle" | "locating" | "ok" | "failed";

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
  const [photoState, setPhotoState] = useState<PhotoState>("idle");
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [location, setLocation] = useState<
    { lng: number; lat: number; accuracy?: number } | undefined
  >();
  const [locState, setLocState] = useState<LocState>("idle");
  const [locNote, setLocNote] = useState<string | null>(null);
  const [farmerName, setFarmerName] = useState(defaultFarmerName);
  const [farmerId, setFarmerId] = useState(defaultFarmerId ?? "");
  const [method, setMethod] = useState<ConfirmationMethod>("signature");
  const [signed, setSigned] = useState(false);
  // Timestamped at the moment the farmer consents, not at save, so the record reflects when
  // consent was actually given. Cleared if the box is unticked.
  const [consentAt, setConsentAt] = useState<string | null>(null);
  const sigRef = useRef<SignaturePadHandle>(null);
  const reduce = useReducedMotion();

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
    setPhotoState("processing");
    setPhotoError(null);
    setLocState("idle");
    setLocNote(null);
    let processed: ProcessedImage;
    try {
      processed = await processPhoto(file);
    } catch (err) {
      // A failed decode used to reject silently and leave the form looking untouched, so the
      // officer thought the photo had been taken.
      setPhotoState("error");
      setPhotoError(
        err instanceof Error && err.message ? err.message : "That photo couldn't be read.",
      );
      return;
    }
    setPhoto(processed);
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(URL.createObjectURL(processed.blob));
    setPhotoState("ready");
    // Capture where the officer is standing, at photo time. A denied fix is fine, the photo and
    // attestation still stand, just without coordinates.
    setLocState("locating");
    setLocNote("locating…");
    const r = await getPosition({ timeoutMs: 6000 });
    if (r.status === "ok") {
      setLocation({ lng: r.lng, lat: r.lat, accuracy: r.accuracyM });
      setLocState("ok");
      setLocNote(null);
    } else {
      setLocation(undefined);
      setLocState("failed");
      setLocNote(`no photo location (${r.message.toLowerCase()})`);
    }
  };

  // Throws on any validation or save failure so the Save button surfaces it as an error toast +
  // shake; resolves on success (which closes the form).
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

  // What the officer still has to do, derived from real state so it can never disagree with what
  // submit() will actually reject.
  const missing = [
    !officer && "officer name",
    !photo && "photo",
    !farmerName.trim() && "farmer name",
    !consentAt && "consent",
    !signed && method,
  ].filter((x): x is string => typeof x === "string");

  // One shared entrance for the photo region's three states, so processing → preview → error
  // swap without a jump.
  const blockIn = {
    hidden: { opacity: 0, y: reduce ? 0 : 4 },
    show: { opacity: 1, y: 0 },
    exit: { opacity: 0 },
  };
  const blockTransition = { duration: reduce ? 0 : 0.2, ease: EASE_OUT_2 };

  return (
    <div className="glass-card flex flex-col gap-4 p-4" style={{ borderColor: "var(--accent)" }}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">Attest this plot</h3>
        {/* Padded well past its text so the tap target clears 44px without the
            button growing into something that competes with Save. */}
        <button
          onClick={onSkip}
          className="-mx-2 -my-3 px-2 py-3 text-sm faint underline underline-offset-2"
        >
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
          <button
            onClick={saveOfficerName}
            disabled={!officerName.trim()}
            title={officerName.trim() ? undefined : "Type the officer's name first"}
            className="btn btn-ghost btn-sm"
          >
            Set
          </button>
        </div>
      )}

      {/* Geotagged photo at the plot */}
      <div>
        <label className="label" htmlFor="attest-photo">
          Photo at the plot
        </label>
        <input
          id="attest-photo"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onPhoto}
          disabled={photoState === "processing"}
          className="block text-sm file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[var(--accent-soft)] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-[var(--accent)] disabled:opacity-60"
        />

        <AnimatePresence mode="wait" initial={false}>
          {photoState === "processing" ? (
            // Shaped like the preview it will become, so nothing jumps when the real image
            // lands.
            <motion.div
              key="processing"
              variants={blockIn}
              initial="hidden"
              animate="show"
              exit="exit"
              transition={blockTransition}
              className="mt-2"
              aria-busy="true"
            >
              <SkeletonBlock className="h-40 w-56 max-w-full" style={{ borderRadius: "0.75rem" }} />
              <p className="mt-1.5 flex items-center gap-1.5 text-xs faint" role="status" aria-live="polite">
                <span className="spinner" aria-hidden="true" style={{ width: "0.75rem", height: "0.75rem" }} />
                Compressing photo…
              </p>
            </motion.div>
          ) : photoState === "error" ? (
            <motion.p
              key="error"
              variants={blockIn}
              initial="hidden"
              animate="show"
              exit="exit"
              transition={blockTransition}
              role="status"
              aria-live="polite"
              className="mt-2 rounded-xl px-3 py-2 text-xs"
              style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
            >
              {photoError} Take it again.
            </motion.p>
          ) : photoUrl ? (
            <motion.div
              key="preview"
              variants={blockIn}
              initial="hidden"
              animate="show"
              exit="exit"
              transition={blockTransition}
              className="mt-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl}
                alt="Plot"
                loading="lazy"
                decoding="async"
                className="max-h-40 rounded-xl border"
                style={{ borderColor: "var(--glass-border)" }}
              />
              <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-xs faint" role="status" aria-live="polite">
                {photo && <span className="tabular-nums">{photo.width}×{photo.height}, {formatBytes(photo.bytes)}</span>}
                {locState === "locating" && (
                  <span className="flex items-center gap-1.5" style={{ color: "var(--fg-muted)" }}>
                    ·
                    <span className="spinner" aria-hidden="true" style={{ width: "0.75rem", height: "0.75rem" }} />
                    locating…
                  </span>
                )}
                {locState === "ok" && location && (
                  <span className="flex items-center gap-1 tabular-nums" style={{ color: "var(--accent)" }}>
                    · <Check size={12} strokeWidth={2.5} aria-hidden="true" />
                    GPS ±{Math.round(location.accuracy ?? 0)} m
                  </span>
                )}
                {locState === "failed" && (
                  <span style={{ color: "var(--warn)" }}>· {locNote}</span>
                )}
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>
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
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="label !mb-0 mr-1">Farmer confirmation</span>
          {/* Chips rather than bare radios: which method is armed has to be
              readable across a table in daylight. The real radio stays in the
              DOM for keyboard and screen-reader semantics. */}
          {(["signature", "thumbprint"] as const).map((m) => (
            <label
              key={m}
              className={`chip cursor-pointer gap-1.5 focus-within:shadow-[0_0_0_3px_var(--accent-ring)] ${
                method === m ? "chip-active" : ""
              }`}
              style={{ minHeight: "2.75rem" }}
            >
              <input
                type="radio"
                name="confirmation-method"
                className="sr-only"
                checked={method === m}
                onChange={() => setMethod(m)}
              />
              {method === m && <Check size={13} strokeWidth={2.5} aria-hidden="true" />}
              {m === "signature" ? "Signature" : "Thumbprint"}
            </label>
          ))}
          <button
            onClick={() => sigRef.current?.clear()}
            disabled={!signed}
            title={signed ? undefined : "Nothing to clear yet"}
            className="btn btn-ghost btn-sm ml-auto"
          >
            Clear
          </button>
        </div>
        <SignaturePad ref={sigRef} method={method} onMarkChange={setSigned} />
      </div>

      {/* Explicit consent. A thumbprint is biometric data, so implied consent is
          not sufficient: the officer reads this aloud and the farmer agrees. */}
      <div
        className="rounded-xl p-3 text-sm"
        style={{
          background: consentAt ? "var(--accent-soft)" : "var(--info-soft)",
          // The border carries the state: unticked is a notice, ticked is a recorded fact.
          border: `1px solid ${consentAt ? "var(--accent)" : "var(--info)"}`,
          transition: "background-color var(--dur-base) ease, border-color var(--dur-base) ease",
        }}
      >
        <p className="mb-2 font-semibold" style={{ color: consentAt ? "var(--accent)" : "var(--info)" }}>
          Read this to the farmer before saving
        </p>
        <p className="muted">
          &ldquo;This records your name, your plot boundary, a photo of the plot,
          and your {method}. It is used only to prove your land was not deforested,
          so you can sell to buyers who require that proof. You can ask for it to
          be deleted at any time, and you do not have to agree.&rdquo;
        </p>
        <label className="-mx-1 mt-2 flex cursor-pointer items-start gap-2 rounded-lg px-1 py-2">
          <input
            type="checkbox"
            checked={consentAt !== null}
            onChange={(e) => setConsentAt(e.target.checked ? new Date().toISOString() : null)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
          />
          <span>
            The farmer heard this and agreed.
            {consentAt && (
              <span className="faint"> Recorded {new Date(consentAt).toLocaleTimeString()}.</span>
            )}
          </span>
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <ActionButton
          onAction={submit}
          className="btn btn-primary"
          loadingLabel="Saving"
          successToast="Attestation saved"
          disabled={photoState === "processing"}
        >
          Save attestation
        </ActionButton>
        {/* Never a dead button: whatever blocks the save is named here. */}
        <p className="text-xs faint" role="status" aria-live="polite">
          {photoState === "processing"
            ? "Waiting for the photo to finish compressing."
            : missing.length > 0
              ? `Still needed: ${missing.join(", ")}.`
              : "Everything needed is captured."}
        </p>
      </div>
    </div>
  );
}
