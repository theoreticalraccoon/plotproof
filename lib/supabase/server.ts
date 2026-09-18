import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client (Server Components, Route Handlers, Server
 * Actions). Uses the anon key + the user's session cookie, so RLS still
 * applies as that user. For privileged jobs that must bypass RLS (e.g. the
 * background analysis writer), build a separate client with the service-role
 * key instead, never expose that key to the browser.
 *
 * Callers must check `isSupabaseConfigured()` first — this throws on the `!`
 * assertions when the env vars are absent, which is the right behaviour for a
 * route that has already decided it needs a database.
 *
 * `/auth/callback` is the one place this is genuinely load-bearing rather than
 * a convenience. A one-time email link arrives as `?code=…` on a fresh request,
 * and the PKCE verifier it must be paired with lives in a cookie written when
 * the link was REQUESTED. Only a server handler sees that cookie on the first
 * paint, so only a server handler can complete the exchange before anything
 * renders.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[],
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll called from a Server Component, where cookies are
            // read-only. Safe to ignore when middleware refreshes sessions.
          }
        },
      },
    },
  );
}
