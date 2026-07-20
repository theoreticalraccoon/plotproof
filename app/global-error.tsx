"use client";

/** Last-resort boundary if the root layout itself throws. Must render <html>. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 32, textAlign: "center" }}>
        <h1 style={{ fontSize: 18 }}>The app hit an unexpected error.</h1>
        <p style={{ color: "#555", fontSize: 14 }}>Your captured plots remain saved on this device.</p>
        <button
          onClick={reset}
          style={{ marginTop: 12, padding: "8px 16px", background: "#1f2937", color: "#fff", borderRadius: 6 }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
