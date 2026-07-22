"use client";

/**
 * Public dispute / confirmation form, no login. Captures a training-quality
 * label: stance, a reason category, observed land cover, an optional geotagged
 * photo, and reporter provenance. Written for a first-time member of the public,
 * not an analyst.
 */
import { useState } from "react";
import ActionButton from "@/components/motion/ActionButton";
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

interface Props {
  featureId?: string;
  location: [number, number]; // [lng, lat]
  countryCode?: string;
  onSubmitted: () => void;
  onCancel: () => void;
  /** Default stance when opened from a feature's Confirm/Dispute buttons. */
  initialStance?: DisputeStance;
}

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
  const [geo, setGeo] = useState<{ lng: number; lat: number; accuracyM?: number } | null>(null);

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const processed = await processPhoto(file);
    const dataUrl = await blobToDataUrl(processed.blob);
    setPhotoData(dataUrl);
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(URL.createObjectURL(processed.blob));
    const r = await getPosition({ timeoutMs: 6000 });
    if (r.status === "ok") setGeo({ lng: r.lng, lat: r.lat, accuracyM: r.accuracyM });
    else setGeo(null);
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
    onSubmitted();
  };

  return (
    <div className="flex flex-col gap-3 text-sm">
      {/* stance */}
      <div className="flex gap-2">
        <StanceButton active={stance === "dispute"} onClick={() => setStance("dispute")}>
          This looks wrong
        </StanceButton>
        <StanceButton active={stance === "confirm"} onClick={() => setStance("confirm")}>
          This looks right
        </StanceButton>
      </div>

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

      <label className="flex items-center gap-2">
        <input type="checkbox" checked={onSite} onChange={(e) => setOnSite(e.target.checked)} className="h-5 w-5 accent-[var(--accent)]" />
        I have been to this location in person
      </label>

      {/* photo */}
      <div>
        <label className="label">Photo (optional, strengthens your report)</label>
        <input type="file" accept="image/*" capture="environment" onChange={onPhoto} className="block text-sm file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[var(--accent-soft)] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-[var(--accent)]" />
        {photoUrl && (
          <div className="mt-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt="Report" loading="lazy" decoding="async" className="max-h-36 rounded-xl border" style={{ borderColor: "var(--glass-border)" }} />
            <p className="text-xs faint">
              {geo ? `location captured (±${Math.round(geo.accuracyM ?? 0)} m)` : "location not captured"}
            </p>
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
        Your report may be published as open data and used to improve the detection
        model. Don&apos;t include personal information about others.
      </p>

      <div className="flex gap-2">
        <ActionButton
          onAction={submit}
          className="btn btn-primary flex-1"
          loadingLabel="Sending"
          successToast="Report received. Thank you."
        >
          Submit report
        </ActionButton>
        <button onClick={onCancel} className="btn btn-ghost">
          Cancel
        </button>
      </div>
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
  return (
    <button onClick={onClick} className={`btn flex-1 ${active ? "btn-primary" : "btn-ghost"}`}>
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
