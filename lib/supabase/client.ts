import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True only when both public Supabase env vars are present at build time. */
export function isSupabaseConfigured(): boolean {
  return Boolean(url && anon);
}

let clientPromise: Promise<SupabaseClient> | null = null;

/** Lazily-loaded singleton browser Supabase client. */
export function getSupabaseBrowser(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import("@supabase/ssr").then(({ createBrowserClient }) =>
      createBrowserClient(url!, anon!),
    );
  }
  return clientPromise;
}
