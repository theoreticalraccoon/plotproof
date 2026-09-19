"use client";

/** The shared credential form behind /login and /signup. */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Mail, Lock, ArrowRight, Check, X, Eye, EyeOff } from "lucide-react";
import { ACCOUNT_EXISTS, useAuth } from "@/lib/auth/AuthProvider";
import PendingLink from "@/components/motion/PendingLink";
import { t, useLang, type Lang } from "@/lib/i18n";
import { useToast } from "@/components/shell/Toast";

export type AuthMode = "signin" | "signup";

type Status = "idle" | "working" | "done" | "failed";
type Message = { ok: boolean; text: string; detail?: string };

function destination(): string {
  if (typeof window === "undefined") return "/documents";
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/documents";
}

/** Supabase reports failures as English strings. */
function describe(lang: Lang, raw: string): Message {
  const offline =
    (typeof navigator !== "undefined" && navigator.onLine === false) ||
    /failed to fetch|networkerror|network request failed|load failed/i.test(raw);
  // The single most common real-world sign-in failure: the account exists but its confirmation
  // link was never opened.
  const unconfirmed = /email not confirmed|not confirmed/i.test(raw);
  if (unconfirmed) return { ok: false, text: t(lang, "auth_unconfirmed"), detail: raw };
  return {
    ok: false,
    text: offline ? t(lang, "offline_message") : t(lang, "auth_error"),
    detail: raw || undefined,
  };
}

/** Why an emailed link did not work. */
function describeLink(lang: Lang, raw: string): Message {
  const wrongBrowser = /code verifier|both auth code|pkce/i.test(raw);
  const spent = /expired|invalid|already|not found/i.test(raw);
  if (wrongBrowser) return { ok: false, text: t(lang, "auth_link_wrong_browser"), detail: raw };
  if (spent) return { ok: false, text: t(lang, "auth_link_expired"), detail: raw };
  return { ok: false, text: t(lang, "auth_error"), detail: raw };
}

// With `shouldCreateUser: false`, Supabase refuses an unknown address with "Signups not allowed
// for otp".
function describeOtp(lang: Lang, mode: AuthMode, raw: string): Message {
  if (mode === "signin" && /signups not allowed|not allowed for otp/i.test(raw)) {
    return { ok: false, text: t(lang, "auth_no_such_account") };
  }
  return describe(lang, raw);
}

export default function AuthForm({ mode }: { mode: AuthMode }) {
  const lang = useLang();
  const router = useRouter();
  const reduce = useReducedMotion();
  const { configured, user, loading, signIn, signUp, magicLink } = useAuth();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [msg, setMsg] = useState<Message | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (resetTimer.current) clearTimeout(resetTimer.current); }, []);

  // Carried over from a sign-up that hit an existing address, so they do not retype what they
  // just typed.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const e = params.get("email");
    if (e) setEmail(e);

    // A refused email link redirects here with the provider's own reason.
    const authError = params.get("auth_error");
    if (authError) {
      setMsg(
        authError === "not_configured"
          ? { ok: false, text: t(lang, "auth_not_configured"), detail: t(lang, "auth_not_configured_detail") }
          : describeLink(lang, authError),
      );
      setStatus("failed");
    }
  }, [lang]);

  // Already signed in? Move along.
  useEffect(() => {
    if (user) router.replace(destination());
  }, [user, router]);

  const fail = (m: Message) => {
    setMsg(m);
    setStatus("failed");
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setStatus("idle"), 2200);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "working") return;

    // The bug this replaces: when Supabase was unconfigured the handler returned here, so the
    // button did nothing at all, no spinner, no error, no clue.
    if (!configured) {
      fail({ ok: false, text: t(lang, "auth_not_configured"), detail: t(lang, "auth_not_configured_detail") });
      return;
    }

    setStatus("working");
    setMsg(null);
    try {
      if (mode === "signup") {
        const r = await signUp(email, password);
        if (r.error === ACCOUNT_EXISTS) {
          // Address taken and this password isn't the one on it. Send them to sign-in with the
          // address preserved rather than into a dead end.
          fail({ ok: false, text: t(lang, "auth_exists_wrong_password") });
          router.push(`/login?email=${encodeURIComponent(email)}`);
        } else if (r.error) {
          fail(describe(lang, r.error));
        } else if (r.needsConfirmation) {
          setMsg({ ok: true, text: t(lang, "auth_check_email"), detail: email });
          setStatus("done");
        } else {
          if (r.signedInExisting) toast(t(lang, "auth_existing_signed_in"), "success");
          setStatus("done");
          router.replace(destination());
        }
      } else {
        const r = await signIn(email, password);
        if (r.error) fail(describe(lang, r.error));
        else {
          setStatus("done");
          router.replace(destination());
        }
      }
    } catch (err) {
      // Thrown here means the network or the Supabase client itself, not a rejected credential;
      // without this the button would spin forever.
      fail(describe(lang, err instanceof Error ? err.message : String(err)));
    }
  };

  const sendMagicLink = async () => {
    if (status === "working") return;
    if (!configured) {
      fail({ ok: false, text: t(lang, "auth_not_configured"), detail: t(lang, "auth_not_configured_detail") });
      return;
    }
    if (!email) {
      fail({ ok: false, text: t(lang, "auth_need_email") });
      return;
    }
    setStatus("working");
    setMsg(null);
    try {
      // On /signup the link must be allowed to register the address; on /login it must not.
      const r = await magicLink(email, { createAccount: mode === "signup" });
      if (r.error) fail(describeOtp(lang, mode, r.error));
      else {
        setMsg({
          ok: true,
          text: t(lang, mode === "signup" ? "auth_magic_sent_signup" : "auth_magic_sent"),
          detail: email,
        });
        setStatus("done");
      }
    } catch (err) {
      fail(describe(lang, err instanceof Error ? err.message : String(err)));
    }
  };

  const working = status === "working";
  const cta = mode === "signup" ? "auth_signup_cta" : "auth_signin_cta";

  return (
    <>
      {/* An unconfigured deployment is stated up front, not discovered by
          pressing a button that cannot work. */}
      {!configured && !loading && (
        <div
          className="mb-5 rounded-xl border p-3.5 text-sm"
          role="alert"
          style={{ background: "var(--warn-soft)", borderColor: "var(--warn)", color: "var(--warn)" }}
        >
          <p className="font-semibold">{t(lang, "auth_not_configured")}</p>
          <p className="mt-1 leading-relaxed" style={{ opacity: 0.85 }}>
            {t(lang, "auth_not_configured_detail")}
          </p>
        </div>
      )}

      <form onSubmit={submit} className="flex flex-col gap-4" aria-busy={working || undefined} noValidate={false}>
        <label className="block">
          <span className="label">{t(lang, "auth_email")}</span>
          <div className="relative">
            <Mail size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 faint" aria-hidden="true" />
            <input
              type="email"
              autoComplete="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field pl-10"
              placeholder="you@example.com"
            />
          </div>
        </label>

        <label className="block">
          <span className="label">{t(lang, "auth_password")}</span>
          <div className="relative">
            <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 faint" aria-hidden="true" />
            <input
              type={reveal ? "text" : "password"}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field pl-10 pr-11"
              placeholder={mode === "signup" ? t(lang, "auth_password_hint") : "••••••••"}
            />
            {/* Typing a password blind on a phone in a field is a real cause of
                failed sign-ins; let them look. */}
            <button
              type="button"
              onClick={() => setReveal((v) => !v)}
              className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg transition-opacity hover:opacity-100 active:scale-95"
              style={{ color: "var(--fg-faint)", opacity: 0.8 }}
              aria-label={t(lang, reveal ? "auth_hide_password" : "auth_show_password")}
            >
              {reveal ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
            </button>
          </div>
          {mode === "signup" && (
            <span className="mt-1.5 block text-xs faint">{t(lang, "auth_password_rule")}</span>
          )}
        </label>

        <AnimatePresence initial={false}>
          {msg && (
            <motion.div
              key={msg.text}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-xl p-3.5 text-sm leading-relaxed"
              role={msg.ok ? "status" : "alert"}
              aria-live="polite"
              style={{
                background: msg.ok ? "var(--accent-soft)" : "var(--danger-soft)",
                color: msg.ok ? "var(--accent)" : "var(--danger)",
              }}
            >
              <span className="font-medium">{msg.text}</span>
              {msg.detail && (
                <span className="mt-1 block text-xs" style={{ opacity: 0.8 }}>
                  {msg.detail}
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <button type="submit" disabled={working} className="btn btn-primary btn-lg mt-1 w-full">
          <AnimatePresence mode="wait" initial={false}>
            {working ? (
              <motion.span key="working" className="inline-flex items-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
                <span className="spinner" aria-hidden="true" /> {t(lang, "auth_working")}
              </motion.span>
            ) : status === "done" ? (
              <motion.span key="done" className="inline-flex items-center gap-2" initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}>
                <Check size={17} strokeWidth={2.5} aria-hidden="true" /> {t(lang, cta)}
              </motion.span>
            ) : status === "failed" ? (
              <motion.span
                key="failed"
                className="inline-flex items-center gap-2"
                initial={{ opacity: 0 }}
                animate={reduce ? { opacity: 1 } : { opacity: 1, x: [0, -5, 5, -3, 3, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.36 }}
              >
                <X size={17} strokeWidth={2.5} aria-hidden="true" /> {t(lang, "retry_label")}
              </motion.span>
            ) : (
              <motion.span key="idle" className="inline-flex items-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
                {t(lang, cta)} <ArrowRight size={17} aria-hidden="true" />
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </form>

      {/* Both routes get the passwordless option, and each asks for what that
          route means: on /signup the link may register the address, on /login it
          may not. The earlier objection, that a magic link would make the two
          routes identical, is answered by `shouldCreateUser` rather than by
          withholding the feature from people who came to sign up. */}
      <div className="my-5 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1" style={{ background: "var(--glass-hairline)" }} />
        <span className="text-xs faint">{t(lang, "auth_or")}</span>
        <span className="h-px flex-1" style={{ background: "var(--glass-hairline)" }} />
      </div>
      <button type="button" onClick={sendMagicLink} disabled={working} className="btn btn-ghost w-full">
        <Mail size={15} aria-hidden="true" />{" "}
        {t(lang, mode === "signup" ? "auth_magic_cta_signup" : "auth_magic_cta")}
      </button>
      <p className="mt-2 text-center text-xs faint" style={{ maxWidth: "44ch", marginInline: "auto" }}>
        {t(lang, "auth_magic_same_browser")}
      </p>

      <p className="mt-6 text-center text-sm muted">
        {t(lang, mode === "signin" ? "auth_no_account" : "auth_have_account")}{" "}
        <PendingLink
          href={mode === "signin" ? "/signup" : "/login"}
          className="font-semibold underline-offset-4 hover:underline"
          style={{ color: "var(--accent)" }}
        >
          {t(lang, mode === "signin" ? "auth_signup_cta" : "auth_signin_cta")}
        </PendingLink>
      </p>
    </>
  );
}
