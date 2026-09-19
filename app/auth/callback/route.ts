/** Where every email link lands: magic sign-in links and sign-up confirmations. */
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createClient } from "@/lib/supabase/server";

/** Same rule as the sign-in form's own `next` handling. Relative paths only. */
function safeNext(raw: string | null): string {
  if (!raw) return "/documents";
  // "//evil.com" is protocol-relative and leaves the site; "/\evil.com" is the same trick with a
  // backslash, which some parsers normalise to a slash.
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/documents";
  return raw;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));

  // Supabase reports a refused link (expired, already used, wrong project) in the query string
  // rather than by failing the redirect.
  const providerError = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  if (providerError) {
    return NextResponse.redirect(
      new URL(`/login?auth_error=${encodeURIComponent(providerError)}`, url.origin),
    );
  }

  const code = url.searchParams.get("code");
  if (!code) {
    // No code and no error: somebody opened the callback directly.
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/login?auth_error=not_configured", url.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // The overwhelmingly common cause is a link opened in a different browser from the one that
    // requested it: the PKCE verifier cookie is not there.
    return NextResponse.redirect(
      new URL(`/login?auth_error=${encodeURIComponent(error.message)}`, url.origin),
    );
  }

  // Redirect rather than render, so the spent code leaves the address bar and a refresh cannot
  // replay it.
  return NextResponse.redirect(new URL(next, url.origin));
}
