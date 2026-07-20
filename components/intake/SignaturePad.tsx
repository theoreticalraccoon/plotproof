"use client";

/**
 * On-screen signature / thumbprint pad. Pointer-based so it works with a finger
 * on the phone (the one moment the farmer touches the device — DECISIONS.md
 * D-006). Exposes an imperative handle to export the mark as a compact PNG.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { canvasToPng, type ProcessedImage } from "@/lib/intake/image";

export interface SignaturePadHandle {
  toPng: () => Promise<ProcessedImage | null>;
  clear: () => void;
  isEmpty: () => boolean;
}

const SignaturePad = forwardRef<SignaturePadHandle, { className?: string }>(
  function SignaturePad({ className }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const dirty = useRef(false);

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
      (e.target as Element).setPointerCapture?.(e.pointerId);
    };
    const move = (e: React.PointerEvent) => {
      if (!drawing.current) return;
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx) return;
      const { x, y } = at(e);
      ctx.lineTo(x, y);
      ctx.stroke();
      dirty.current = true;
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
        dirty.current = false;
      },
      isEmpty() {
        return !dirty.current;
      },
    }));

    return (
      <canvas
        ref={canvasRef}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
        // touch-none stops the page scrolling while the farmer signs.
        className={`h-40 w-full touch-none rounded border border-gray-300 bg-white ${className ?? ""}`}
      />
    );
  },
);

export default SignaturePad;
