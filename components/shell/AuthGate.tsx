"use client";

/**
 * Route gate. The farmer product (sell, documents, intake, alerts, plot) is
 * account-first: a signed-out visitor sees a clean prompt to create an account
 * instead of a populated app. The public front door (landing, login) and the
 * public pages (the landing page, /whats-real, /verify) stay open. When Supabase
 * isn't configured the gate is inert, so the app still runs as a prototype.
 */
import { usePathname } from "next/navigation";
import PendingLink from "@/components/motion/PendingLink";
import { motion } from "framer-motion";
import { Lock, UserPlus, LogIn } from "lucide-react";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { Skeleton } from "@/components/motion/Skeleton";
import { t, useLang } from "@/lib/i18n";

const GATED = ["/sell", "/documents", "/intake", "/plot"];

export default function AuthGate({ children }: { children: ReactNode }) {
  const { configured, user, loading } = useAuth();
  const pathname = usePathname();
  const lang = useLang();
  const gated = GATED.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!configured || !gated) return <>{children}</>;

  // Session still resolving: a skeleton, not a flash of the gate or the page.
  if (loading) {
    return (
      <main className="mx-auto min-h-dvh max-w-2xl px-5 py-10 sm:px-8" aria-busy="true">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-3 h-4 w-full max-w-md" />
        <Skeleton className="mt-8 h-40 w-full" />
      </main>
    );
  }

  if (user) return <>{children}</>;

  const next = encodeURIComponent(pathname);
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 py-10 text-center">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="glass-card glass-glow w-full p-8"
      >
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
          <Lock size={22} />
        </span>
        <h1 className="font-display mt-4 text-2xl">{t(lang, "gate_title")}</h1>
        <p className="mt-2 text-sm muted">{t(lang, "gate_body")}</p>
        <div className="mt-6 flex flex-col gap-2">
          <PendingLink href={`/signup?next=${next}`} className="btn btn-primary">
            <UserPlus size={16} aria-hidden="true" /> {t(lang, "gate_create")}
          </PendingLink>
          <PendingLink href={`/login?next=${next}`} className="btn btn-ghost">
            <LogIn size={16} aria-hidden="true" /> {t(lang, "gate_have")}
          </PendingLink>
        </div>
      </motion.div>
    </main>
  );
}
