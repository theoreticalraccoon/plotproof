"use client";

/** The card /login and /signup share. */
import { Leaf, ShieldCheck } from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import PendingLink from "@/components/motion/PendingLink";
import { t, useLang } from "@/lib/i18n";

export default function AuthShell({
  titleKey,
  subtitleKey,
  children,
}: {
  titleKey: string;
  subtitleKey: string;
  children: React.ReactNode;
}) {
  const lang = useLang();

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[27rem] flex-col justify-center px-6 py-12">
      {/* A CSS entrance, not a JS one. The card is server-rendered, and a
          Framer entrance meant the served HTML carried opacity:0 until
          hydration, invisible to anyone on a slow connection, and a hydration
          mismatch in the console. `.page-in` animates the same rise and is
          already reduced-motion aware in globals.css. */}
      <div className="page-in">
        <div className="mb-7 flex items-center justify-between gap-3">
          <PendingLink href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-xl"
              style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
            >
              <Leaf size={17} strokeWidth={2.25} aria-hidden="true" />
            </span>
            PlotProof
          </PendingLink>
          <LanguageSwitcher />
        </div>

        <div className="glass-card glass-glow p-7 sm:p-8">
          {/* The heading names the task, so it is never ambiguous whether this
              page creates an account or opens an existing one. */}
          <h1 className="font-display text-[1.65rem] leading-tight sm:text-[1.8rem]">
            {t(lang, titleKey)}
          </h1>
          <p className="mt-2.5 mb-7 text-sm leading-relaxed muted">{t(lang, subtitleKey)}</p>
          {children}
        </div>

        <p className="mt-5 flex items-start justify-center gap-1.5 px-4 text-center text-xs faint">
          <ShieldCheck size={13} className="mt-px shrink-0" aria-hidden="true" />
          <span>{t(lang, "auth_saved_note")}</span>
        </p>
      </div>
    </main>
  );
}
