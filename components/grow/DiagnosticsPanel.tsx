"use client";

/**
 * The `?diag=1` panel. Hidden from farmers, visible to whoever is running the
 * real-device smoke test.
 *
 * Presentation only, and deliberately untranslated: its audience is the person
 * holding the phone against a checklist, not a user. It renders whatever
 * `buildDiagnosticRows` produced and knows no model facts of its own.
 */
import type { DiagRow } from "@/lib/grow/tea/diagnostics";

function mark(ok: boolean | null): { glyph: string; color: string } {
  if (ok === true) return { glyph: "PASS", color: "var(--accent)" };
  if (ok === false) return { glyph: "FAIL", color: "var(--danger)" };
  return { glyph: "", color: "var(--fg-faint)" };
}

export default function DiagnosticsPanel({
  rows,
  failures,
}: {
  rows: DiagRow[];
  /** Count of rows that failed, computed by the caller so the test can too. */
  failures: number;
}) {
  return (
    <section
      className="rounded-[var(--radius)] p-4"
      style={{
        background: "var(--bg-1)",
        border: `1px solid ${failures > 0 ? "var(--danger)" : "var(--glass-hairline)"}`,
      }}
      aria-label="Browser inference diagnostics"
      data-testid="tea-diagnostics"
    >
      <p
        className="text-[0.7rem] font-semibold uppercase tracking-[0.14em]"
        style={{ color: failures > 0 ? "var(--danger)" : "var(--fg-faint)" }}
      >
        Diagnostics · {failures > 0 ? `${failures} failing` : "all checks pass"}
      </p>
      <p className="mt-1 text-[0.72rem] faint">
        Shown because the URL carries <code>?diag=1</code>. Not part of the advisory.
      </p>

      <dl className="mt-3 space-y-1.5">
        {rows.map((r, i) => {
          const m = mark(r.ok);
          return (
            <div key={`${r.label}-${i}`} className="flex items-baseline gap-3 text-[0.78rem]">
              <dt className="shrink-0 basis-[9.5rem] muted">{r.label}</dt>
              <dd className="min-w-0 flex-1 break-all font-mono">{r.value}</dd>
              {m.glyph && (
                <span className="shrink-0 font-mono text-[0.68rem]" style={{ color: m.color }}>
                  {m.glyph}
                </span>
              )}
            </div>
          );
        })}
      </dl>
    </section>
  );
}
