"use client";

/**
 * Auth screen. Email + password (sign in / sign up) with a magic-link fallback,
 * over Supabase Auth via the app AuthProvider. Fully translated; degrades to a
 * clear "not set up yet" state when Supabase isn't configured. On success it
 * returns the user to ?next= (or the documents hub), where their now-synced
 * sale + progress are waiting.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Leaf, Mail, Lock, ArrowRight } from "lucide-react";
import { ACCOUNT_EXISTS, useAuth } from "@/lib/auth/AuthProvider";
import { t, useLang } from "@/lib/i18n";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useToast } from "@/components/shell/Toast";

type Mode = "signin" | "signup" | "magic";

function destination(): string {
  if (typeof window === "undefined") return "/documents";
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") ? next : "/documents";
}

export default function LoginPage() {
  const lang = useLang();
  const router = useRouter();
  const { configured, user, loading, signIn, signUp, magicLink } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // First-time visitors arrive with ?mode=signup so "Create account" is default.
  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("mode");
    if (m === "signup") setMode("signup");
  }, []);

  // Already signed in? Move along.
  useEffect(() => {
    if (user) router.replace(destination());
  }, [user, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!configured || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "magic") {
        const r = await magicLink(email);
        setMsg(r.error ? { ok: false, text: t(lang, "auth_error") } : { ok: true, text: t(lang, "auth_magic_sent") });
      } else if (mode === "signup") {
        const r = await signUp(email, password);
        if (r.error === ACCOUNT_EXISTS) {
          // The address is taken but this password is not the one on it. Move
          // them to sign-in with their email kept, rather than a dead end.
          setMode("signin");
          setPassword("");
          setMsg({ ok: false, text: t(lang, "auth_exists_wrong_password") });
        } else if (r.error) setMsg({ ok: false, text: t(lang, "auth_error") });
        else if (r.needsConfirmation) setMsg({ ok: true, text: t(lang, "auth_check_email") });
        else {
          // Tell them what happened, otherwise being sent straight in after
          // pressing "Create account" looks like it made a duplicate.
          if (r.signedInExisting) toast(t(lang, "auth_existing_signed_in"), "success");
          router.replace(destination());
        }
      } else {
        const r = await signIn(email, password);
        if (r.error) setMsg({ ok: false, text: t(lang, "auth_error") });
        else router.replace(destination());
      }
    } finally {
      setBusy(false);
    }
  };

  const cta =
    mode === "magic" ? "auth_magic_cta" : mode === "signup" ? "auth_signup_cta" : "auth_signin_cta";

  const heading =
    mode === "signup"
      ? { title: "auth_title_signup", subtitle: "auth_subtitle_signup" } as const
      : mode === "magic"
        ? { title: "auth_title_magic", subtitle: "auth_subtitle_magic" } as const
        : { title: "auth_title", subtitle: "auth_subtitle" } as const;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="glass-card glass-glow w-full p-7 sm:p-8"
      >
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: "var(--accent)", color: "var(--accent-fg)" }}>
              <Leaf size={17} strokeWidth={2.25} />
            </span>
            PlotProof
          </div>
          <LanguageSwitcher />
        </div>

        {/* The heading names the task, so it is never ambiguous whether this
            form is about to create an account or open an existing one. */}
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1 className="font-display text-2xl sm:text-[1.7rem]">{t(lang, heading.title)}</h1>
          <p className="mt-2 text-sm muted">{t(lang, heading.subtitle)}</p>
        </motion.div>

        {!configured ? (
          <div className="mt-5 rounded-xl p-3 text-sm" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>
            {t(lang, "auth_not_configured")}
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
            <label>
              <span className="label">{t(lang, "auth_email")}</span>
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 faint" />
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field pl-9"
                  placeholder="you@example.com"
                />
              </div>
            </label>

            {mode !== "magic" && (
              <label>
                <span className="label">{t(lang, "auth_password")}</span>
                <div className="relative">
                  <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 faint" />
                  <input
                    type="password"
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="field pl-9"
                    placeholder="••••••••"
                  />
                </div>
              </label>
            )}

            {msg && (
              <p
                className="rounded-xl p-3 text-sm"
                style={{
                  background: msg.ok ? "var(--accent-soft)" : "var(--danger-soft)",
                  color: msg.ok ? "var(--accent)" : "var(--danger)",
                }}
              >
                {msg.text}
              </p>
            )}

            <button type="submit" disabled={busy} className="btn btn-primary mt-1">
              {busy ? (
                <>
                  <span className="spinner" aria-hidden="true" /> {t(lang, "auth_working")}
                </>
              ) : (
                <>
                  {t(lang, cta)} <ArrowRight size={16} />
                </>
              )}
            </button>

            <div className="mt-1 flex flex-col items-center gap-2 text-sm">
              {mode !== "magic" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === "signin" ? "signup" : "signin");
                    setMsg(null);
                  }}
                  className="faint hover:underline underline-offset-2"
                >
                  {t(lang, mode === "signin" ? "auth_to_signup" : "auth_to_signin")}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "magic" ? "signin" : "magic");
                  setMsg(null);
                }}
                className="faint hover:underline underline-offset-2"
              >
                {t(lang, mode === "magic" ? "auth_to_signin" : "auth_magic_cta")}
              </button>
            </div>
          </form>
        )}
      </motion.div>

      {!loading && (
        <p className="mt-4 max-w-sm text-center text-xs faint">{t(lang, "auth_saved_note")}</p>
      )}
    </main>
  );
}
