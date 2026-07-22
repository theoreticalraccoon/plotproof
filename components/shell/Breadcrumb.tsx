"use client";

/**
 * Breadcrumb trail for deep pages, reinforces "where am I / how do I get back"
 * alongside the persistent top nav, so a workflow never feels like a dead end.
 * Each crumb except the last is a real link; the last is the current page.
 */
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  href?: string;
}

export default function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="print:hidden">
      <ol className="flex flex-wrap items-center gap-1 text-sm">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-1">
              {c.href && !last ? (
                <Link href={c.href} className="faint transition-colors hover:text-[var(--fg)]">
                  {c.label}
                </Link>
              ) : (
                <span className={last ? "font-medium" : "faint"} aria-current={last ? "page" : undefined}>
                  {c.label}
                </span>
              )}
              {!last && <ChevronRight size={14} className="faint" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
