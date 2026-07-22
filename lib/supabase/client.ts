import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True only when both public Supabase env vars are present at build time.
 *  The whole auth/persistence layer no-ops (rather than crashes) when false, so
 *  the app still runs as an anonymous prototype without Supabase configured. */
export function isSupabaseConfigured(): boolean {
  return Boolean(url && anon);
}

let clientPromise: Promise<SupabaseClient> | null = null;

/**
 * Lazily-loaded singleton browser Supabase client. The `@supabase/ssr` +
 * `@supabase/supabase-js` bundle (~70 KB) is a *dynamic* import, so it is code-
 * split out of the initial page load and only fetched the first time auth is
 * actually needed. Resolves to null when Supabase isn't configured. Async, so
 * callers await it.
 */
export function getSupabaseBrowser(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import("@supabase/ssr").then(({ createBrowserClient }) =>
      createBrowserClient(url!, anon!),
    );
  }
  return clientPromise;
}
