# Supabase setup

Auth works with **no database changes** — Supabase Auth manages users itself.
The one table below adds **per-user persistence** (a signed-in user keeps their
sale + document progress across devices). Until it exists, the app still runs and
just falls back to browser-only storage; the sync calls fail silently.

## 1. Apply the schema (once)

Easiest, no password or CLI needed:

1. Supabase dashboard → **SQL Editor** → **New query**
2. Paste the contents of `migrations/0001_user_state.sql`
3. **Run**

Or with the CLI (needs the DB password, which you have):

```bash
supabase login
supabase link --project-ref tjiitiohiuztqzuoojdh
supabase db push
```

## 2. Email confirmation (so accounts are usable immediately)

By default Supabase requires users to confirm their email before they can sign
in. For quick testing, turn it off:

- Dashboard → **Authentication → Providers → Email** → toggle **Confirm email** off.

Leave it on for production; the login screen already handles the
"check your email" state.

## 3. Environment variables

The app reads two public vars (already set in `.env.local` for local dev, and in
the Vercel project for production):

```
NEXT_PUBLIC_SUPABASE_URL       = https://tjiitiohiuztqzuoojdh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY  = <the sb_publishable_... key>
```

Both are safe to expose (they ship in the browser bundle); Row Level Security is
what protects the data.
