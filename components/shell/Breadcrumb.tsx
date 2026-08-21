"use client";

/**
 * Breadcrumb trail for deep pages, reinforces "where am I / how do I get back"
 * alongside the persistent top nav, so a workflow never feels like a dead end.
 * Each crumb except the last is a real link; the last is the current page.
 *
 * The crumbs are the escape hatch out of the document generators, which are the
 * slowest routes in the app, so they use PendingLink: a crumb that takes a
 * moment to load has to look tapped, or it looks broken.
 */
import { ChevronRight } from "lucide-react";
import PendingLink from "@/components/motion/PendingLink";

export interface Crumb {
  label: string;
  href?: string;
}

export default function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="print:hidden">
      <ol className="flex flex-wrap items-center gap-y-0.5 text-sm">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="flex min-w-0 items-center">
              {c.href && !last ? (
                <PendingLink
                  href={c.href}
                  className="inline-flex min-h-[32px] max-w-[16rem] items-center rounded-md px-1 transition-colors duration-150 hover:text-[var(--fg)]"
                  style={{ color: "var(--fg-faint)" }}
                >
                  <span className="truncate">{c.label}</span>
                </PendingLink>
              ) : (
                <span
                  className={`inline-flex min-h-[32px] max-w-[22rem] items-center truncate px-1 ${last ? "font-medium" : "faint"}`}
                  aria-current={last ? "page" : undefined}
                >
                  {c.label}
                </span>
              )}
              {/* The separator carries no meaning for a screen reader; the list
                  structure already conveys the trail. */}
              {!last && <ChevronRight size={14} className="shrink-0 faint" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
