/**
 * Where every email link lands: magic sign-in links and sign-up confirmations.
 *
 * THE BUG THIS FIXES. Both flows used to redirect to `window.location.origin`,
 * so a one-time code arrived on the home page with nothing there to spend it.
 * The browser client does attempt the exchange itself once it mounts, which is
 * why this mostly appeared to work — but it only mounts after the page has
 * rendered, so on a slow connection the reader watches a signed-out home page
 * while the code sits unredeemed in the address bar, and any refresh burns it.
 * A code is single-use: the second attempt fails whatever happens.
 *
 * Exchanging it here, before anything renders, makes the outcome deterministic.
 * The reader either arrives signed in or arrives on a page that says why not.
 *
 * The `next` parameter is validated, not trusted. An open redirect on the one
 * URL a user is guaranteed to click out of their email is exactly the hole a
 * phishing campaign wants, so anything that is not a single-slash-relative path
 * is discarded rather than sanitised.
 */
import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createClient } from "@/lib/supabase/server";

/** Same rule as the sign-in form's own `next` handling. Relative paths only. */
function safeNext(raw: string | null): string {
  if (!raw) return "/documents";
  // "//evil.com" is protocol-relative and leaves the site; "/\evil.com" is the
  // same trick with a backslash, which some parsers normalise to a slash.
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/documents";
  return raw;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));

  // Supabase reports a refused link (expired, already used, wrong project) in
  // the query string rather than by failing the redirect. Carry its own words
  // through to the page so the reader is told which of those it was.
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
    // The overwhelmingly common cause is a link opened in a different browser
    // from the one that requested it: the PKCE verifier cookie is not there.
    // The login page turns this into an instruction rather than a stack trace.
    return NextResponse.redirect(
      new URL(`/login?auth_error=${encodeURIComponent(error.message)}`, url.origin),
    );
  }

  // Redirect rather than render, so the spent code leaves the address bar and a
  // refresh cannot replay it.
  return NextResponse.redirect(new URL(next, url.origin));
}
