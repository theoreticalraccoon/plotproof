"use client";

/**
 * Public dispute / confirmation form, no login. Captures a training-quality
 * label: stance, a reason category, observed land cover, an optional geotagged
 * photo, and reporter provenance. Written for a first-time member of the public,
 * not an analyst.
 *
 * Photo intake is the slow step (decode, downscale, then a GPS fix that can take
 * seconds or be denied outright), so it narrates itself rather than leaving the
 * reporter staring at an unchanged form.
 */
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ImageOff, MapPin, X } from "lucide-react";
import ActionButton from "@/components/motion/ActionButton";
import { inlineStatusIn } from "@/lib/motion/variants";
import { processPhoto } from "@/lib/intake/image";
import { getPosition } from "@/lib/geo/locate";
import {
  LANDCOVER_LABELS,
  REASON_LABELS,
  REPORTER_LABELS,
} from "@/lib/public/format";
import type {
  DisputeReason,
  DisputeStance,
  LandCover,
  ReporterType,
} from "@/lib/public/types";

/** What the caller needs to acknowledge the submission truthfully. */
export interface DisputeReceipt {
  id: string;
  reviewStatus: string;
}

interface Props {
  featureId?: string;
  location: [number, number]; // [lng, lat]
  countryCode?: string;
  onSubmitted: (receipt: DisputeReceipt) => void;
  onCancel: () => void;
  /** Default stance when opened from a feature's Confirm/Dispute buttons. */
  initialStance?: DisputeStance;
}

/** Photo intake is a two-stage async job and each stage can fail on its own. */
type PhotoState =
  | { kind: "idle" }
  | { kind: "processing" }
  | { kind: "locating" }
  | { kind: "ready"; note: string; located: boolean }
  | { kind: "error"; message: string };

export default function DisputeForm({
  featureId,
  location,
  countryCode,
  onSubmitted,
  onCancel,
  initialStance = "dispute",
}: Props) {
  const [stance, setStance] = useState<DisputeStance>(initialStance);
  const [reason, setReason] = useState<DisputeReason>("plantation_not_natural");
  const [landCover, setLandCover] = useState<LandCover | "">("");
  const [comment, setComment] = useState("");
  const [onSite, setOnSite] = useState(false);
  const [reporterType, setReporterType] = useState<ReporterType>("anonymous");
  const [reporterName, setReporterName] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [photo, setPhoto] = useState<PhotoState>({ kind: "idle" });
  const [geo, setGeo] = useState<{ lng: number; lat: number; accuracyM?: number } | null>(null);
  const reduce = useReducedMotion();

  // The preview blob outlives the component otherwise; the form is unmounted
  // every time the reporter cancels or the panel switches.
  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);

  const busy = photo.kind === "processing" || photo.kind === "locating";

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto({ kind: "processing" });
    try {
      const processed = await processPhoto(file);
      const dataUrl = await blobToDataUrl(processed.blob);
      setPhotoData(dataUrl);
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      setPhotoUrl(URL.createObjectURL(processed.blob));

      // The photo is attached either way; the fix only strengthens it, so a
      // denied or slow GPS is reported as a downgrade, never as a failure.
      setPhoto({ kind: "locating" });
      const r = await getPosition({ timeoutMs: 6000 });
      if (r.status === "ok") {
        setGeo({ lng: r.lng, lat: r.lat, accuracyM: r.accuracyM });
        setPhoto({
          kind: "ready",
          located: true,
          note: `Photo attached, location captured (±${Math.round(r.accuracyM)} m).`,
        });
      } else {
        setGeo(null);
        setPhoto({
          kind: "ready",
          located: false,
          note: `${r.message} The photo is still attached, just without coordinates.`,
        });
      }
    } catch {
      setPhotoData(null);
      setGeo(null);
      setPhoto({ kind: "error", message: "That image couldn't be read. Try another photo." });
    }
  };

  const removePhoto = () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(null);
    setPhotoData(null);
    setGeo(null);
    setPhoto({ kind: "idle" });
  };

  // Throws on failure so the Submit button shows an error toast + shake.
  const submit = async () => {
    const res = await fetch("/api/public/disputes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        featureId,
        location,
        countryCode,
        stance,
        reason: stance === "dispute" ? reason : undefined,
        landCover: landCover || undefined,
        onSite,
        comment,
        reporterType,
        reporterName: reporterName || undefined,
        photo: photoData
          ? {
              dataUrl: photoData,
              capturedAt: new Date().toISOString(),
              lng: geo?.lng,
              lat: geo?.lat,
              accuracyM: geo?.accuracyM,
            }
          : undefined,
      }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error ?? "Could not send your report. Please try again.");
    }
    const j = (await res.json().catch(() => ({}))) as Partial<DisputeReceipt>;
    onSubmitted({ id: j.id ?? "", reviewStatus: j.reviewStatus ?? "unverified" });
  };

  return (
    <div className="flex flex-col gap-5 text-sm">
      {/* stance */}
      <div className="flex flex-col gap-2">
        <span className="label">Your verdict on this location</span>
        <div className="flex gap-2">
          <StanceButton active={stance === "dispute"} onClick={() => setStance("dispute")}>
            This looks wrong
          </StanceButton>
          <StanceButton active={stance === "confirm"} onClick={() => setStance("confirm")}>
            This looks right
          </StanceButton>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {stance === "dispute" && (
          <label>
            <span className="label">What&apos;s wrong?</span>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as DisputeReason)}
              className="field"
            >
              {(Object.keys(REASON_LABELS) as DisputeReason[]).map((r) => (
                <option key={r} value={r}>
                  {REASON_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
        )}

        <label>
          <span className="label">What&apos;s actually on the ground here?</span>
          <select
            value={landCover}
            onChange={(e) => setLandCover(e.target.value as LandCover)}
            className="field"
          >
            <option value="">- not sure -</option>
            {(Object.keys(LANDCOVER_LABELS) as LandCover[]).map((c) => (
              <option key={c} value={c}>
                {LANDCOVER_LABELS[c]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-h-11 cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={onSite}
            onChange={(e) => setOnSite(e.target.checked)}
            className="h-5 w-5 shrink-0 accent-[var(--accent)]"
          />
          I have been to this location in person
        </label>
      </div>

      {/* photo */}
      <div className="flex flex-col gap-2">
        <span className="label">Photo (optional, strengthens your report)</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onPhoto}
          disabled={busy}
          className="block text-sm file:mr-3 file:min-h-9 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[var(--accent-soft)] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-[var(--accent)] disabled:opacity-50"
        />

        {/* Every stage of a multi-second job says which stage it is on. */}
        <div aria-live="polite" className="min-h-5">
          <AnimatePresence mode="wait" initial={false}>
            {busy && (
              <motion.p
                key={photo.kind}
                variants={reduce ? undefined : inlineStatusIn}
                initial="hidden"
                animate="show"
                exit="exit"
                className="flex items-center gap-2 text-xs faint"
              >
                <span className="spinner" aria-hidden="true" />
                {photo.kind === "processing"
                  ? "Preparing your photo…"
                  : "Getting this device's location…"}
              </motion.p>
            )}
            {photo.kind === "error" && (
              <motion.p
                key="err"
                variants={reduce ? undefined : inlineStatusIn}
                initial="hidden"
                animate="show"
                exit="exit"
                className="flex items-center gap-2 text-xs"
                style={{ color: "var(--danger)" }}
              >
                <ImageOff size={14} aria-hidden="true" /> {photo.message}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {photoUrl && (
          <div className="flex flex-col gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl}
              alt="The photo attached to your report"
              loading="lazy"
              decoding="async"
              className="max-h-40 w-full rounded-xl object-cover"
              style={{ border: "1px solid var(--glass-border)" }}
            />
            <div className="flex items-start gap-2">
              {photo.kind === "ready" && (
                <p
                  className="flex flex-1 items-start gap-1.5 text-xs"
                  style={{ color: photo.located ? "var(--fg-faint)" : "var(--warn)" }}
                >
                  <MapPin size={13} className="mt-px shrink-0" aria-hidden="true" />
                  {photo.note}
                </p>
              )}
              <button
                type="button"
                onClick={removePhoto}
                className="btn btn-ghost btn-sm shrink-0"
                aria-label="Remove the attached photo"
              >
                <X size={14} aria-hidden="true" /> Remove
              </button>
            </div>
          </div>
        )}
      </div>

      <label>
        <span className="label">Comment</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="Describe what you know about this place…"
          className="field"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="label">You are…</span>
          <select
            value={reporterType}
            onChange={(e) => setReporterType(e.target.value as ReporterType)}
            className="field"
          >
            {(Object.keys(REPORTER_LABELS) as ReporterType[]).map((r) => (
              <option key={r} value={r}>
                {REPORTER_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Name (optional)</span>
          <input
            value={reporterName}
            onChange={(e) => setReporterName(e.target.value)}
            className="field"
          />
        </label>
      </div>

      <p className="glass p-3 text-xs muted">
        Your report is stored as an <strong>unverified</strong> community label, never
        as a finding against anyone. It may be published as open data and used to
        improve the detection model, so don&apos;t include personal information about
        others.
      </p>

      <div className="flex gap-2">
        <ActionButton
          onAction={submit}
          className="btn btn-primary flex-1"
          loadingLabel="Sending"
          successLabel="Sent"
          successToast="Report received. Thank you."
          disabled={busy}
        >
          Submit report
        </ActionButton>
        <button type="button" onClick={onCancel} className="btn btn-ghost">
          Cancel
        </button>
      </div>
      {/* A disabled submit must say why it is disabled. */}
      {busy && (
        <p className="text-xs faint" aria-live="polite">
          Waiting for your photo to finish before sending.
        </p>
      )}
    </div>
  );
}

function StanceButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  // Instant state change: the press cue comes from .btn:active, never a spinner.
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`btn flex-1 ${active ? "btn-primary" : "btn-ghost"}`}
    >
      {children}
    </button>
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(blob);
  });
}
