"use client";

/** A next/link that acknowledges the click the instant it happens. */
import Link, { useLinkStatus } from "next/link";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import type { UrlObject } from "url";

function PendingInner({ children }: { children: ReactNode }) {
  const { pending } = useLinkStatus();
  return (
    // `gap-2`, not the whitespace between JSX children: this span is a flex container, and a
    // flex container drops the anonymous whitespace between an icon and its label.
    <span className="inline-flex items-center gap-2" aria-busy={pending || undefined}>
      {children}
      {/*
        The slot is always in the layout and only its CONTENTS toggle, so the
        click can never reflow the label the user just aimed at. The spinner
        itself is mounted only while pending, so idle links are not each
        running an infinite animation. Under prefers-reduced-motion the global
        reduce block freezes .spinner into a static ring, which still reads as
        "working" without spinning.
      */}
      <span
        aria-hidden="true"
        className="ml-2 inline-flex h-4 w-4 shrink-0 items-center justify-center"
        style={{ opacity: pending ? 1 : 0, transition: "opacity var(--dur-fast) ease" }}
      >
        {pending ? <span className="spinner" /> : null}
      </span>
    </span>
  );
}

export default function PendingLink({
  href,
  children,
  className,
  style,
  prefetch,
  target,
  rel,
  onClick,
  ariaLabel,
  inline = false,
}: {
  href: string | UrlObject;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  prefetch?: boolean | "auto" | null;
  target?: string;
  rel?: string;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  ariaLabel?: string;
  /** For a link inside running text. */
  inline?: boolean;
}) {
  return (
    <Link
      href={href}
      className={className}
      style={style}
      prefetch={prefetch}
      target={target}
      rel={rel}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {inline ? children : <PendingInner>{children}</PendingInner>}
    </Link>
  );
}
