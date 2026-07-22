"use client";

/**
 * App-wide auth context over Supabase Auth. Tracks the session, exposes sign
 * in / sign up / magic-link / sign out, and on sign-in pulls the user's saved
 * state down (or migrates local state up). Everything degrades to a signed-out,
 * no-op state when Supabase isn't configured, so the app still runs.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/supabase/client";
import { clearLocalState, syncOnLogin } from "@/lib/supabase/userState";

interface AuthResult {
  error?: string;
  needsConfirmation?: boolean;
  /** Sign-up found an existing account and signed the user straight in. */
  signedInExisting?: boolean;
}

/**
 * Sign-up hit an existing account and the password did not match it, so we
 * could not sign them in. The caller should switch to the sign-in form.
 */
export const ACCOUNT_EXISTS = "account_exists";

interface AuthContextValue {
  configured: boolean;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  magicLink: (email: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx) return ctx;
  // Fallback for callers rendered outside the provider (should not happen).
  return {
    configured: false,
    user: null,
    loading: false,
    signIn: async () => ({ error: "not_configured" }),
    signUp: async () => ({ error: "not_configured" }),
    magicLink: async () => ({ error: "not_configured" }),
    signOut: async () => {},
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(configured);

  useEffect(() => {
    let mounted = true;
    let unsub: (() => void) | undefined;
    (async () => {
      const sb = await getSupabaseBrowser();
      if (!sb) {
        if (mounted) setLoading(false);
        return;
      }
      const { data } = await sb.auth.getSession();
      if (mounted) {
        setUser(data.session?.user ?? null);
        setLoading(false);
      }
      const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
        setUser(session?.user ?? null);
        if (event === "SIGNED_IN" && session?.user) void syncOnLogin(session.user.id);
      });
      unsub = () => sub.subscription.unsubscribe();
    })();
    return () => {
      mounted = false;
      unsub?.();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const sb = await getSupabaseBrowser();
    if (!sb) return { error: "not_configured" };
    const { error } = await sb.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const sb = await getSupabaseBrowser();
    if (!sb) return { error: "not_configured" };
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
    });

    // Someone signing up with an address they already registered is a person
    // who forgot, not an error to scold them for. Supabase reports this two
    // different ways depending on the project's email-confirmation setting:
    // confirmations off gives an explicit error, confirmations on deliberately
    // obfuscates it as a success carrying a user with no identities. Treat both
    // as "this account exists" and just log them in.
    const explicit = error ? /already\s*(been\s*)?registered|already exists/i.test(error.message) : false;
    const obfuscated = !error && !data.session && (data.user?.identities?.length ?? 1) === 0;

    if (explicit || obfuscated) {
      const { error: signInError } = await sb.auth.signInWithPassword({ email, password });
      // Signed in on the existing account. The password had to match for this
      // to succeed, so nothing is bypassed.
      if (!signInError) return { signedInExisting: true };
      return { error: ACCOUNT_EXISTS };
    }

    if (error) return { error: error.message };
    // No session back = the project requires email confirmation first.
    return { needsConfirmation: !data.session };
  }, []);

  const magicLink = useCallback(async (email: string): Promise<AuthResult> => {
    const sb = await getSupabaseBrowser();
    if (!sb) return { error: "not_configured" };
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
    });
    return error ? { error: error.message } : {};
  }, []);

  const signOut = useCallback(async () => {
    const sb = await getSupabaseBrowser();
    if (sb) await sb.auth.signOut();
    clearLocalState();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ configured, user, loading, signIn, signUp, magicLink, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
