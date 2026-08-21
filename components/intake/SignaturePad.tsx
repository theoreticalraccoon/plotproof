"use client";

/**
 * On-screen signature / thumbprint pad. Pointer-based so it works with a finger
 * on the phone (the one moment the farmer touches the device, DECISIONS.md
 * D-006). Exposes an imperative handle to export the mark as a compact PNG.
 *
 * The pad also reports emptiness upward (`onMarkChange`): an officer must be
 * able to tell at a glance whether a mark was actually captured, and a ref
 * alone can't drive that because mutating it never re-renders.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Check, PenLine } from "lucide-react";
import { canvasToPng, type ProcessedImage } from "@/lib/intake/image";

export interface SignaturePadHandle {
  toPng: () => Promise<ProcessedImage | null>;
  clear: () => void;
  isEmpty: () => boolean;
}

interface Props {
  className?: string;
  /** Drives the on-canvas prompt and the accessible name. */
  method?: "signature" | "thumbprint";
  /** Fires when the pad crosses empty ↔ marked, so the parent can show state. */
  onMarkChange?: (hasMark: boolean) => void;
}

// The canvas is and must stay white (it is the exported PNG), so anything drawn
// on top of it is fixed ink, not a theme token, or it would vanish in dark mode.
// Same reasoning as .doc-sheet in globals.css.
const INK_HINT = "#9ca3af";
const INK_RULE = "#d1d5db";

const SignaturePad = forwardRef<SignaturePadHandle, Props>(function SignaturePad(
  { className, method = "signature", onMarkChange },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const [hasMark, setHasMark] = useState(false);

  // dirty stays the source of truth for the imperative handle; state only
  // mirrors it so the surrounding UI can render the captured/empty state.
  const setDirty = (v: boolean) => {
    if (dirty.current === v) return;
    dirty.current = v;
    setHasMark(v);
    onMarkChange?.(v);
  };

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    // Match backing store to displayed size so strokes aren't blurry.
    c.width = c.clientWidth;
    c.height = c.clientHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111111";
  }, []);

  const at = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const down = (e: React.PointerEvent) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawing.current = true;
    const { x, y } = at(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    // A thumbprint is pressed, not dragged: without this dot a straight press
    // left no ink and counted as empty, so the save was rejected for a farmer
    // who had in fact confirmed.
    ctx.lineTo(x, y);
    ctx.stroke();
    setDirty(true);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = at(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const up = () => {
    drawing.current = false;
  };

  useImperativeHandle(ref, () => ({
    async toPng() {
      return dirty.current && canvasRef.current
        ? canvasToPng(canvasRef.current)
        : null;
    },
    clear() {
      const c = canvasRef.current;
      const ctx = c?.getContext("2d");
      if (!c || !ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, c.width, c.height);
      setDirty(false);
    },
    isEmpty() {
      return !dirty.current;
    },
  }));

  const noun = method === "thumbprint" ? "thumbprint" : "signature";
  const prompt = method === "thumbprint" ? "Press thumb here" : "Sign here";

  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <div className="relative">
        <canvas
          ref={canvasRef}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
          // A cancelled pointer (OS gesture, palm rejection) never fires up,
          // which used to leave the pad stuck in drawing mode.
          onPointerCancel={up}
          role="img"
          aria-label={
            hasMark ? `Farmer ${noun}, captured` : `Empty ${noun} pad. Draw with a finger or stylus.`
          }
          // touch-none stops the page scrolling while the farmer signs.
          // Canvas stays white: it's the signature surface and the PNG export needs it.
          className="block h-40 w-full touch-none rounded-xl border-2 bg-white"
          style={{
            borderColor: hasMark ? "var(--accent)" : "var(--accent-ring)",
            // Dashed while empty reads as "fill me in"; solid once there is ink.
            borderStyle: hasMark ? "solid" : "dashed",
            transition: "border-color var(--dur-base) ease",
          }}
        />
        {!hasMark && (
          // Pointer-events off so the prompt never eats the first stroke.
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-6 bottom-7 flex flex-col items-center gap-2"
          >
            <span
              className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide"
              style={{ color: INK_HINT }}
            >
              <PenLine size={14} strokeWidth={2} aria-hidden="true" />
              {prompt}
            </span>
            <span className="block h-px w-full" style={{ background: INK_RULE }} />
          </div>
        )}
      </div>

      {/* The one line that answers "did we actually get it?". */}
      <p
        className="flex items-center gap-1.5 text-xs"
        role="status"
        aria-live="polite"
        style={{ color: hasMark ? "var(--accent)" : "var(--fg-faint)" }}
      >
        {hasMark ? (
          <>
            <Check size={13} strokeWidth={2.5} aria-hidden="true" />
            {noun === "thumbprint" ? "Thumbprint captured" : "Signature captured"}
          </>
        ) : (
          `No ${noun} yet`
        )}
      </p>
    </div>
  );
});

export default SignaturePad;
