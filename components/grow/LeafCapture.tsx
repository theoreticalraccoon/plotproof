"use client";

/**
 * Leaf photo input: camera or gallery, with a preview of what the model will
 * actually see before anything is inferred.
 *
 * The preview matters more than it looks. The model consumes a square centre
 * crop, so a farmer who frames a lesion at the edge of a landscape photo would
 * otherwise get a confident answer about a part of the leaf they never intended
 * to submit. Showing the crop makes that visible before they commit.
 *
 * Presentation only. No preprocessing, no inference, no thresholds — those live
 * in `lib/grow/tea/`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RotateCcw } from "lucide-react";
import { t, type Lang } from "@/lib/i18n";

export interface LeafCaptureProps {
  lang: Lang;
  busy: boolean;
  /** Square crop side the model uses, from the card. Drives the preview overlay. */
  cropHint?: number;
  onAnalyse: (img: HTMLImageElement) => void;
  onError: (reason: "bad_image") => void;
}

export default function LeafCapture({ lang, busy, onAnalyse, onError }: LeafCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const urlRef = useRef<string | null>(null);

  // Object URLs are a manual-lifetime resource; a farmer retaking a photo ten
  // times would otherwise leak ten decoded images on a phone with little to spare.
  const revoke = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);
  useEffect(() => revoke, [revoke]);

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        onError("bad_image");
        return;
      }
      revoke();
      const url = URL.createObjectURL(file);
      urlRef.current = url;
      const img = new Image();
      img.onload = () => {
        setImage(img);
        setPreview(url);
      };
      img.onerror = () => {
        revoke();
        onError("bad_image");
      };
      img.src = url;
    },
    [onError, revoke],
  );

  const reset = () => {
    revoke();
    setPreview(null);
    setImage(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <section className="glass-card p-5" aria-labelledby="leaf-capture-heading">
      <h2 id="leaf-capture-heading" className="text-[1.1rem] font-semibold">
        {t(lang, "tea_take_photo")}
      </h2>
      <p className="mt-2 text-[0.85rem] muted">{t(lang, "tea_formats")}</p>

      {/* `capture="environment"` opens the rear camera directly on a phone while
          still allowing a gallery pick on desktop. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="sr-only"
        id="leaf-photo-input"
        onChange={(e) => handleFile(e.target.files?.[0])}
        disabled={busy}
      />

      {!preview && (
        <label
          htmlFor="leaf-photo-input"
          className="btn btn-primary mt-4 inline-flex min-h-[48px] cursor-pointer items-center gap-2"
        >
          <Camera size={16} aria-hidden="true" />
          {t(lang, "tea_take_photo")}
        </label>
      )}

      {preview && (
        <>
          <div className="mt-4">
            {/* Square frame: exactly the region the model receives. */}
            <div
              className="relative mx-auto aspect-square w-full max-w-[280px] overflow-hidden rounded-[var(--radius-sm)]"
              style={{ background: "var(--bg-1)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt={t(lang, "tea_preview_alt")}
                className="h-full w-full object-cover"
              />
            </div>
            <p className="mt-2 text-center text-[0.78rem] faint">{t(lang, "tea_preview_note")}</p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary min-h-[48px] flex-1"
              disabled={busy || !image}
              onClick={() => image && onAnalyse(image)}
            >
              {busy ? t(lang, "tea_analysing") : t(lang, "tea_analyse")}
            </button>
            <button
              type="button"
              className="btn btn-ghost min-h-[48px] inline-flex items-center gap-2"
              onClick={reset}
              disabled={busy}
            >
              <RotateCcw size={15} aria-hidden="true" />
              {t(lang, "tea_retake")}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
