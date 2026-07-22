"use client";

/**
 * Refined ambient backdrop, deliberately restrained (Linear / Vercel / Raycast
 * territory), NOT bouncing color blobs. Two fixed, STATIC layers:
 *   1. A faint two-tone aurora wash so glass surfaces have something to refract.
 *   2. Fine film grain (inline SVG) to kill banding and add matte texture.
 *
 * Both are intentionally static: a large 120px-blurred element that animates
 * every frame forces the GPU to re-rasterize the blur continuously, which fights
 * smooth scrolling. Rendered once, it composites cheaply and stays out of the
 * way. Pure decoration: aria-hidden, pointer-events-none.
 */

const GRAIN =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`,
  );

export default function AmbientBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute -top-1/3 left-1/2 h-[70vh] w-[110vw] -translate-x-1/2 rounded-[50%] blur-[110px]"
        style={{
          background:
            "radial-gradient(closest-side, var(--aurora-1), transparent 70%), radial-gradient(closest-side, var(--aurora-2), transparent 75%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{ backgroundImage: `url("${GRAIN}")`, backgroundSize: "140px 140px", opacity: "var(--grain-opacity)" }}
      />
    </div>
  );
}
