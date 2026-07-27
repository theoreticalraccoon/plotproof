# Next steps that only a human can do

Infrastructure is live. What remains cannot be coded — it needs a person in a
field, a conversation, and a careful read.

---

## ✅ Done — infrastructure (2026-07-27)

- **Database migrations applied.** All six objects exist in Supabase:
  `user_state`, `farmers`, `plots`, `attestations`, `media`, `lot_verification`.
- **Secrets set in Vercel.** `CRON_SECRET` and `ACOUSTIC_INGEST_TOKEN` are
  configured and enforcing — both guarded routes return `401` without a token
  and `200` with one (verified against production, not assumed).
- **Supabase connected** to the deployment; sync and `/verify/<id>` are wired
  to a real database.
- **Live at** https://plot-proof.vercel.app

Consequence: a plot captured on a phone now syncs to the server under row-level
security, and its verification page becomes a real, shareable URL. Nothing in
the persistence chain is simulated any more.

---

## 1. Capture one real plot (half a day) — the highest-value remaining action

Zero real plots exist. Every feature is still a hypothesis until one farmer and
one officer have touched it.

Take a phone to a real farm (Matale or Ratnapura):

1. Sign in at https://plot-proof.vercel.app → **Intake**
2. Trace the boundary — ideally by *walking* it, which is the highest-confidence
   capture method and the one never yet tested outdoors
3. Attest with the farmer: plot photo, read the consent statement aloud, capture
   signature or thumbprint
4. Back online, confirm the sync bar clears, then open
   `https://plot-proof.vercel.app/verify/<plot-id>` — that page is now a real
   artifact you can send to anyone

**Watch for, and write down:** where the officer hesitates, whether the map is
readable in direct sunlight, how long attestation takes, what the farmer asks.
That list is worth more than any feature currently in the backlog.

If arranging this proves impossible, *that* is the finding — record why.

## 2. One exporter or cooperative conversation (1 hour)

The entire repositioning rests on an untested assumption: that someone
downstream wants farmer-side plot evidence. Ask one person who would know.

Five questions, verbatim:

1. When EUDR filing starts (Dec 2026 for medium/large operators), where will
   your smallholder plot geolocation come from?
2. Would an attested boundary — officer countersignature, recorded farmer
   consent, tamper-evident record — be usable evidence for your filing?
3. What would it need before you'd trust it? (Land title? Independent satellite
   check? A specific person's signature?)
4. Would you pay for it, or pay more for crop that carries it?
5. Who already offers you this? (Listen for Koltiva, Meridia, Farmforce, TraceX.)

Q3's answer redesigns the trust ladder on `/verify`. Q5's answer is the
competitive map. Both change what gets built next.

## 3. Read the competition rubric against the product (30 min)

Score-weighted attributes, and where the evidence already sits:

| Attribute | Weight | Your strongest evidence |
|---|---|---|
| Content & Standards | 18% | `/whats-real`, cited EUDR dates (Reg 2025/2650), catalog verification dates, published model backtests |
| Product Stability & Reliability | 12% | Fail-closed auth, staleness gates, honest "unavailable" states, 45 passing tests |
| User Requirements | 10% | Trilingual Sinhala-first, offline-first capture, four-question sell flow |
| Compatibility & Interoperability | 10% | DDS GeoJSON (TRACES-shaped), CSV import, public verification URL, GFW deep link |
| Application of Technologies | 7.5% | Hash-chained attestation, backtested price pipeline, YAMNet classifier |
| Innovation | 7.5% | Farmer-owned verification record; honesty-as-a-feature |
| Understanding of Problem | 7.5% | Two-lane positioning (EUDR crops vs spice food-safety), "what happens next" |
| Understanding of Business Environment | 7.5% | Who legally files the DDS, container-scale reality, `PARKED.md` competitor map |

The honesty overhaul is the differentiator to argue from — most submissions
cannot show a page documenting their own limits.

---

## Blocked on a decision from you

- **Sinhala LLM assistant** (explain any checklist field, translate buyer
  emails). Ready to build; needs an API key and a per-query cost decision.
- **Sri Lanka EDB / Colombo auction spice prices** — would fill the
  cinnamon/pepper/cardamom gap the World Bank data can't. Sources are PDF
  bulletins, so this needs a real digitisation pass, not a scrape hack.
