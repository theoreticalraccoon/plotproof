"use client";

/**
 * Nav auth affordance. Signed out: a "Sign in" link. Signed in: the account
 * initial + email, and a sign-out button. Hidden entirely when Supabase isn't
 * configured (the app still runs anonymously). Used in both the desktop nav
 * cluster and the mobile drawer.
 *
 * Feedback: signing out is a network round trip followed by a navigation, so it
 * goes through ActionButton (spinner → check → toast) rather than sitting inert
 * while the session is torn down. Signing in is a navigation, so it is a
 * PendingLink. Resolving the session is async too, which is why the control
 * renders a placeholder of its own size first instead of flashing "Sign in" at
 * a user who is already signed in.
 */
import { useRouter } from "next/navigation";
import { LogIn, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import PendingLink from "@/components/motion/PendingLink";
import ActionButton from "@/components/motion/ActionButton";
import { Skeleton } from "@/components/motion/Skeleton";
import { t, useLang } from "@/lib/i18n";

export default function AccountControl({ full = false }: { full?: boolean }) {
  const lang = useLang();
  const router = useRouter();
  const { configured, user, loading, signOut } = useAuth();

  if (!configured) return null;

  // Sized to the widest state this slot can settle into, so the nav row does
  // not reflow when the session resolves.
  if (loading) {
    return (
      <span
        role="status"
        aria-busy="true"
        aria-label={t(lang, "loading")}
        className={`inline-flex ${full ? "w-full" : ""}`}
      >
        <Skeleton className={`h-[38px] ${full ? "w-full" : "w-[11.5rem]"}`} style={{ borderRadius: 999 }} />
      </span>
    );
  }

  if (!user) {
    return (
      <PendingLink href="/login" className={`btn btn-ghost btn-sm ${full ? "w-full" : ""}`}>
        <span className="inline-flex items-center gap-2">
          <LogIn size={15} aria-hidden="true" /> {t(lang, "nav_signin")}
        </span>
      </PendingLink>
    );
  }

  const email = user.email ?? "";
  const initial = (email[0] ?? "?").toUpperCase();

  return (
    <div className={`flex items-center gap-1.5 ${full ? "w-full" : ""}`}>
      <span
        className="flex min-w-0 items-center gap-2 rounded-full py-1 pl-1 pr-3 text-[0.82rem]"
        style={{ background: "var(--glass)", border: "1px solid var(--glass-border)" }}
      >
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold"
          style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
        >
          {initial}
        </span>
        <span className="truncate" style={{ maxWidth: full ? "100%" : "9rem", color: "var(--fg-muted)" }}>
          {email}
        </span>
      </span>
      <ActionButton
        onAction={async () => {
          await signOut();
          router.push("/");
        }}
        className="btn btn-ghost btn-sm !px-2.5"
        successToast={t(lang, "auth_signout")}
      >
        <LogOut size={15} aria-hidden="true" />
        <span className="sr-only">{t(lang, "auth_signout")}</span>
      </ActionButton>
    </div>
  );
}
