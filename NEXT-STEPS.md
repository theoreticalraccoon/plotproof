# Next steps that only a human can do

The code is ready for all four. Each unblocks something already built.

## 1. Apply the database migrations (~15 min)

Supabase Dashboard → your project → SQL Editor → New query. Paste and run, in
order:

1. `supabase/migrations/0001_user_state.sql`
2. `supabase/migrations/0002_field_data.sql`
3. `supabase/migrations/0003_lot_verification.sql`

Then Vercel → Project → Settings → Environment Variables, add:

- `CRON_SECRET` — any long random string (`openssl rand -hex 32`)
- `ACOUSTIC_INGEST_TOKEN` — same idea

Redeploy. Until this is done: sync says "on this device only", and
`/verify/<id>` says "verification unavailable" — both honestly.

## 2. Capture one real plot (half a day)

Take a phone to a real farm (Matale or Ratnapura). Sign in → Intake → trace the
boundary walking it → attest with the farmer (photo, signature, read the
consent aloud). Watch where they hesitate — that hesitation is the finding.
When back online it syncs, and `/verify/<plot-id>` goes live as a shareable
page.

## 3. One exporter/co-op conversation (1 hour)

Five questions, verbatim:
1. When EUDR filing starts (Dec 2026), where will your smallholder plot
   geolocation come from?
2. Would an attested boundary + officer countersign + tamper-evident record
   from the farmer's side be usable evidence for you?
3. What would it need before you'd trust it? (title? satellite check? whose
   signature?)
4. Would you pay for it — or pay more for crop that carries it?
5. Who else already offers you this? (listen for Koltiva/Meridia/Farmforce)

Answers to Q3 redesign the trust ladder; answer to Q5 is the competitive map.

## 4. Read the competition rubric against /whats-real (30 min)

Quality/Content 18% and Stability 12% are the biggest attributes — the honesty
overhaul and the fail-closed states are your evidence for both. Uniqueness
argues from: price intelligence with published backtests, hash-chained
attestation, the de-identified verification page, DDS GeoJSON interop.
