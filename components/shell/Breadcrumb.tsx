"use client";

// Breadcrumb trail for deep pages, reinforces "where am I / how do I get back" alongside the
// persistent top nav, so a workflow never feels like a dead end.
import PendingLink from "@/components/motion/PendingLink";

export interface Crumb {
  label: string;
  href?: string;
}

export default function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="print:hidden">
      <ol className="-mx-1.5 flex flex-wrap items-center gap-y-0.5 text-[0.8rem]">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="flex min-w-0 items-center">
              {c.href && !last ? (
                <PendingLink
                  href={c.href}
                  className="inline-flex min-h-[32px] max-w-[16rem] items-center rounded-md px-1.5 transition-colors duration-150 hover:text-[var(--fg)]"
                  style={{ color: "var(--fg-faint)" }}
                >
                  <span className="truncate">{c.label}</span>
                </PendingLink>
              ) : (
                <span
                  className="inline-flex min-h-[32px] max-w-[22rem] items-center truncate px-1.5"
                  style={{
                    color: last ? "var(--fg-muted)" : "var(--fg-faint)",
                    fontWeight: last ? 600 : 400,
                  }}
                  aria-current={last ? "page" : undefined}
                >
                  {c.label}
                </span>
              )}
              {/* The separator carries no meaning for a screen reader; the list
                  structure already conveys the trail. */}
              {!last && (
                <span aria-hidden="true" className="select-none" style={{ color: "var(--fg-faint)", opacity: 0.5 }}>
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
