"use client";

/**
 * Nav auth affordance. Signed out: a "Sign in" link. Signed in: a glass pill
 * with the account initial + email, and a sign-out button. Hidden entirely when
 * Supabase isn't configured (the app still runs anonymously). Used in both the
 * desktop nav cluster and the mobile drawer.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useToast } from "./Toast";
import { t, useLang } from "@/lib/i18n";

export default function AccountControl({ full = false }: { full?: boolean }) {
  const lang = useLang();
  const router = useRouter();
  const { configured, user, signOut } = useAuth();
  const { toast } = useToast();

  if (!configured) return null;

  if (!user) {
    return (
      <Link href="/login" className={`btn btn-ghost btn-sm ${full ? "w-full" : ""}`}>
        <LogIn size={15} /> {t(lang, "nav_signin")}
      </Link>
    );
  }

  const email = user.email ?? "";
  const initial = (email[0] ?? "?").toUpperCase();

  const onSignOut = async () => {
    await signOut();
    toast(t(lang, "auth_signout"));
    router.push("/");
  };

  return (
    <div className={`flex items-center gap-2 ${full ? "w-full" : ""}`}>
      <span
        className="flex min-w-0 items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm"
        style={{ background: "var(--glass)", border: "1px solid var(--glass-border)" }}
      >
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold"
          style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
        >
          {initial}
        </span>
        <span className="truncate faint" style={{ maxWidth: full ? "100%" : "9rem" }}>
          {email}
        </span>
      </span>
      <button onClick={onSignOut} aria-label={t(lang, "auth_signout")} className="btn btn-ghost btn-sm !px-2.5">
        <LogOut size={15} />
      </button>
    </div>
  );
}
