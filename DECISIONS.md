# DECISIONS.md

Running log of decisions and the reasoning behind them. Read this first after a
gap. Newest decisions at the bottom of each section. "RECOMMENDED — needs your
sign-off" marks calls I made but that are genuinely yours to confirm.

---

## D-001 — EUDR dates (verified 2026-07-18)

Two different dates live in this domain and the schema must not conflate them:

1. **Deforestation-free cutoff date = 31 December 2020.** This is the date every
   plot is *assessed against*: goods must not come from land deforested or
   degraded after it. It is **fixed** — the two application delays did **not**
   move it. This is the date that drives the model's "before/after" logic.

2. **Operator compliance deadlines** (when someone must actually file due
   diligence): **30 December 2026** for large operators and traders;
   **30 June 2027** for micro/small enterprises and natural persons. Set by
   Regulation (EU) 2025/2650 (targeted revision, signed off Dec 2025). Micro/
   small *primary* operators now only file a one-off simplified declaration.

**Implication for us:** our paying users (exporters / larger cooperatives) sit on
the **Dec 2026** clock — that is the product's urgency deadline, comfortably
before our late-August submission. The smallholders themselves are micro
operators (Jun 2027, simplified) — which is exactly why the cooperative, not the
farmer, is the buyer.

**Re-verify before submission.** The timeline has already been amended twice; do
not trust this number in late August without re-checking.

Sources (access date 2026-07-18):
- https://trade.ec.europa.eu/access-to-markets/en/news/delay-until-december-2026-and-other-developments-implementation-eudr-regulation
- https://www.consilium.europa.eu/en/press/press-releases/2025/12/18/deforestation-council-signs-off-targeted-revision-to-simplify-and-postpone-the-regulation/
- https://www.europarl.europa.eu/news/en/press-room/20251211IPR32168/deforestation-law-parliament-adopts-changes-to-postpone-and-simplify-measures

---

## Resolutions to the open ambiguities

### D-002 — "cutoff date" means two fields, not one
`country_profile.deforestation_cutoff_date` (assessment; default `2020-12-31`,
kept per-country so a stricter national date can override) is separate from the
operator application deadline (an operational/reminder concern, not part of the
imagery verdict). See D-001.

### D-003 — Which national forest definition governs a plot
The country **where the plot physically sits** (country of production) — EUDR
assesses deforestation and legality in the country of origin. Determine that
country by point-in-polygon of the plot geometry against admin boundaries, **not**
from the officer's phone locale. Flag plots near a national border for manual
confirmation. This also picks the forest definition (canopy %, min area, min
height) and the cutoff.

### D-004 — `insufficient_data` still generates a PDF
It is a first-class verdict. The pack renders with the "we cannot determine"
result stated plainly and the reason (cloud gaps, plot < ~0.2 ha) in the caveats.
An honest non-answer is a usable auditor document; withholding it is not.

### D-005 — Week-six minimum (the MVP spine) — RECOMMENDED, needs your sign-off
One vertical slice working end to end beats breadth that half-works:

    offline intake of ONE plot  →  queued analysis (against the stub)  →  ONE
    defensible PDF, in ONE country.

Then replicate *data* across three countries (the regional argument is real
plots + per-country numbers, not more features). Everything else — all four
intake methods, five languages, public layer, standing monitoring, acoustic —
is post-spine and gets cut first if week five is tight. Sign off or adjust.

### D-006 — The one moment the farmer touches the phone
Reconciles PROJECT.md line 19 ("farmer never touches the interface") with line 59
(farmer signature/thumbprint). The **only** farmer interaction is the attestation
signature/thumbprint, on a screen the officer deliberately hands over, in the
farmer's language. Everything else is officer-driven. Design that one handoff on
purpose.

---

## D-007 — Farmer & plot intake design (make officer entry effortless)

**Principle: the officer should almost never type a farmer's name or ID.** Typing
is the friction and the error source, several hundred times, in the field, on a
phone keyboard. Three mechanisms, each a fallback for the one above it.

### Layer 0 — Roster import (eliminates field typing; the default path)
Before fieldwork, import the cooperative's existing member list — they always
have one, it's how they pay farmers. Accept CSV/XLSX with messy real columns;
map columns once. Each row becomes a Farmer record (name, national ID,
membership no, village, phone). In the field the officer **searches and taps**
the farmer (by name / membership no / village). Zero identity typing. This also
honours the spec's "import beats capture, always" ranking, and front-loads the
project's real bottleneck — getting real farmer data — into a desk task instead
of a field one.

### Layer 1 — Scan the national ID card (walk-ups / farmers not on the roster)
Tap "New farmer" → camera. The app reads the card automatically; the *method* is
a country-profile field, because each target country exposes a **different**
machine-readable channel (all verified 2026-07-18):

| Country     | Channel on the card              | Result offline |
|-------------|----------------------------------|----------------|
| Vietnam     | Front **QR code** (CCCD)         | Full name, DOB, sex, ID no, address — structured, zero typing |
| Sri Lanka   | **PDF417 barcode** (2017+ NIC)   | Structured. Old NIC: OCR the number — it encodes DOB + sex (day-of-year, +500 for women), so we auto-fill and validate |
| Indonesia   | **MRZ** strip (KTP-el, ICAO-9303)| OCR → NIK, name, DOB. (Chip needs a reader officers won't carry; the MRZ does not.) |
| Philippines | Card **face** OCR (PhilID)       | Name, DOB, PCN. The QR is an online-only signed token — useless offline, so we OCR the face |

All on-device (e.g. Google ML Kit barcode + text recognition), fully offline.
"How to read this country's ID" is configuration, not code — consistent with the
global-from-commit-one rule. Store the captured ID image as an attestation
artifact (with consent — see PII note).

### Layer 2 — Manual, minimal, assisted (last resort, no card present)
Only the fields the PDF needs. Local-language labels. Numeric keypad for the ID.
**Live per-country validation:** these ID formats have checkable structure
(SL NIC checksum + embedded DOB/sex; Indonesia NIK = region code + DDMMYY, +40 to
day for women; Vietnam 12-digit province/DOB structure). Validate on entry and
auto-derive DOB/sex where the number encodes them, so a typo surfaces immediately
instead of on a legal document.

### Cross-cutting frictions removed
- **One farmer, many plots:** capture identity once; "Add another plot for this
  farmer" reuses it. A tapper with 3 plots enters identity 0–1 times, not 3.
- **Context auto-fill:** country from point-in-polygon on the plot (not phone
  locale), commodity default from the cooperative profile, cutoff from the
  country profile. Officer confirms, doesn't type.
- **Progressive disclosure:** capture the minimum to make a plot; never block a
  save on a nonessential field.
- **Offline-first, crash-safe:** every farmer/plot persists on capture and queues
  to sync (satisfies the plot-30-phone-dies rule).

### PII caveat — needs a decision (touches the schema)
National ID numbers + ID-card photos are sensitive personal data. Capture
explicit consent (fold it into attestation), encrypt at rest, and let a country
profile forbid storing the ID *image* where local law requires it. Decide before
the schema is frozen.

---

## D-008 — Plot intake build (import + tracing first)

Built the offline-first intake for the two highest-priority paths; corner
capture and boundary walk deferred until these are confirmed working.

- **Local store = source of truth in the field.** IndexedDB via **Dexie**
  (`lib/intake/db.ts`). Every plot/farmer persists the instant it's captured and
  is appended to an **outbox**; nothing waits for "end of session". IDs are
  client-generated (`crypto.randomUUID`) so records are stable offline.
- **Sync is a drainable outbox** behind a `SyncTransport` interface
  (`lib/intake/sync.ts`). Default is a **stub** that fakes success — so the
  queued→syncing→synced lifecycle demos with no backend. Swapping in a Supabase
  transport is a one-file change once the migration lands. (Same pattern as the
  analysis stub. Two stubs now: analysis + sync.)
- **Client-side area = geodesic (turf), in hectares.** It needs no projection
  choice and is correct in any UTM zone/hemisphere — right for the live
  "matches the claim?" check. The AUTHORITATIVE figure for the PDF is still
  recomputed server-side in PostGIS in the country's equal-area CRS (SCHEMA.md
  §A). Documented in `lib/intake/geometry.ts`.
- **Save-gate rules** (`validatePlot`): auto-order applies to **corner capture
  only** (traced/walked keep tap order); self-intersection is a **blocking**
  error; overlap uses **intersection area** (not boundary-touch, and catches
  containment) and area-mismatch (>20%) are **non-blocking warnings** the officer
  acknowledges. Proven by `test/geometry.test.ts` (7 cases, run `npm test`).
- **Basemap = Esri World Imagery** (free, no key, global) — config, not
  hardcoded. Tiles pre-cached per district into IndexedDB and served offline by a
  custom Leaflet `GridLayer` (`components/intake/OfflineTileLayer.ts`).
- **Leaflet is vanilla**, not react-leaflet (cleaner custom offline tile layer;
  avoids React-19 version risk), loaded via `dynamic(..., { ssr:false })`.
- **Placeholders to replace when auth/country profiles land:** `DEMO_COOP` /
  `DEMO_COUNTRY = "LK"` are hardcoded in the intake components until officers
  (auth) and country profiles are wired.

Verified: `npm run typecheck`, `npm run build`, `npm test` (7/7), and the
`/intake` route serves 200.

---

## D-009 — Attestation layer + photo storage on a full phone

Added the attestation layer to field capture (traced plots now; corners/walk
inherit it). Photos survive the offline queue without filling the device.

- **What's captured:** officer identity + timestamp (automatic; officer identity
  is a localStorage placeholder — `lib/intake/officer.ts` — until magic-link auth
  replaces it, at which point attestation code doesn't change); a geotagged photo
  taken at the plot; farmer confirmation by on-screen **signature or thumbprint**
  with name + ID. Farmer name/ID are **snapshotted** on the attestation so a later
  edit to the farmer record can't rewrite what was attested.
- **Atomic save:** photo + signature (media) + attestation + `plot.status =
  'attested'` + outbox items all land in one Dexie transaction — a crash can't
  leave a plot marked attested with a missing photo (`saveAttestation`).
- **Photo storage strategy (the explicit ask):**
  1. **Compress on capture** — downscale to 1600 px long edge, JPEG q0.72 via
     canvas: a 4–8 MB shot → ~150–350 KB (`lib/intake/image.ts`). Re-encoding
     also **strips EXIF** (privacy); we attach our own GPS reading as data.
  2. **Never touch the gallery** — capture goes straight into IndexedDB, so a
     full camera roll is irrelevant and we don't add to it.
  3. **Purge-after-sync** — once a photo is really uploaded (transport returns a
     `remotePath`), the local blob is dropped and only the path kept, so weeks of
     fieldwork don't accumulate. Under the stub (no upload) blobs are retained so
     the demo can still show them.
  4. **Budget + persistence** — `requestPersistence()` stops the browser evicting
     unsynced work; the sync bar shows "N photos · X MB local".
- **Capture method → confidence** (`lib/intake/confidence.ts`): expressed as a
  **label + rationale, deliberately NOT a number folded into model confidence** —
  inventing a combined score is the overclaiming the caveats warn against. Traced
  = high (no GPS error), walked/corners = medium, imported = low. Shown per plot
  in the list and destined for the PDF next to the model verdict. Tested
  (`test/confidence.test.ts`).

Verified: `npm run typecheck`, `npm run build`, `npm test` (11/11 across geometry
+ confidence).

---

## D-010 — Standing monitoring cadence (the "in time" question)

The binding limit on detection latency is **satellite revisit + cloud**, not our
schedule — re-analysing faster than new imagery arrives just reprocesses
identical scenes. So cadence is three tiers:

1. **Sweep cron: daily** (`vercel.json`, 03:00 UTC). Cheap — only re-analyses
   plots that are *due*, no-ops the rest.
2. **Per-plot re-analysis cadence: weekly (default, configurable).** Matches new
   usable observations over tropical Asia-Pacific: Sentinel-1 ~6–12 day revisit,
   RADD humid-tropics alerts ~weekly, Sentinel-2 5-day nominal but cloud-gapped.
   Daily cron × weekly per-plot due-date → plots picked up within ~1 day of
   becoming due, staggered, without wasted compute.
3. **Pre-shipment recheck: immediate, on-demand** (`POST /api/monitoring/recheck`).
   This is the actual "before the container leaves" guarantee — a fixed weekly
   tick can't know a ship date, so the shipment workflow forces a fresh check
   against the newest pass and gates on a clear result.

We cannot beat revisit, so every alert and clear is stamped **"observed through
`<latest acquisition date>`"** — the exporter sees freshness, not "now".

**Design notes:**
- **New-clearing detection** (`lib/monitoring/detect.ts`, pure + tested) compares
  the latest verdict/clearing-window to the last one we *alerted on* — fires on
  clear→flagged and on a *later* clearing window (additional clearing), never on
  a repeat of the same window (no alert fatigue). Change detection itself stays
  in the analysis service.
- **Delivery: email or webhook per subscription.** Webhook is real (HTTP POST +
  HMAC `X-PlotProof-Signature`); email is a stub transport (swap in Resend/SES).
  Delivery status (delivered/failed) is recorded on each alert.
- **Alert history** (`/alerts`) lists every alert with delivery status and an
  **acknowledge** action recording who acted + when + the action taken — the
  evidence an exporter needs to show they responded.
- **Persistence is an in-memory repo** behind `MonitoringRepo`; per-process only
  (fine for dev/demo, does NOT survive Vercel's serverless model). The Supabase
  impl (subscriptions + alerts tables) is the production target — **gated on the
  same schema sign-off**. Swapping it is one line in `getMonitoringRepo`.

Verified live: sweep (6 due → 2 alerts, one webhook failure correctly recorded),
pre-shipment recheck de-dupes an already-alerted clearing, acknowledge records
the actor. Tests: `test/monitoring.test.ts` (8 cases). Build + typecheck clean.

---

## D-011 — Free public layer (open map + crowd labels)

Built the no-login public layer: a global map of flagged clearing plus public
confirm/dispute reporting, written for a first-time journalist, not as a debug
view of the flagged table.

- **De-identified by design.** `PublicFeature` carries a public id (never the
  internal plot id) and no farmer/cooperative identity. Publicly naming an
  unverified smallholder on a deforestation map would harm the people the project
  protects. Verified live (PII check on the API output passes). In production the
  public source is a de-identified view of flagged analysis runs; here it's 14
  seeded patches across 13 tropical countries so "global" reads as global.
- **Disputes are training labels, not tickets** (`lib/public/types.ts`). Each
  record ties a human label (`stance` + a `reason` category that maps onto the
  hard ML confusions — plantation-vs-natural, legal harvest, pre-cutoff regrowth,
  mislocation, cloud) and observed `landCover` to the **exact satellite claim it
  corrects** (`observedThrough` + `modelVersion`), with an optional geotagged
  ground photo as the sample and reporter provenance for trust-weighting. Export
  (`GET /api/public/disputes/export[?format=ndjson]`) projects these to
  ground-truth label tuples — demonstrated working. Every submission lands
  `reviewStatus:"unverified"`; only curated labels are trusted for training.
- **Journalist-usable, honest.** `/explore` opens with an About panel that states
  the caveat up front — flagged ≠ proven illegal, legal harvest and mature
  plantation look identical from orbit — plus a country filter, plain-language
  confidence bands (never a raw 0.87), per-feature community tallies, and a
  drop-a-pin "Report clearing you've seen" flow for clearing the model missed.
- **Photos** reuse the intake compression (`processPhoto`) client-side, posted as
  a data URL; the export omits photos/free-text (PII). Public map shows report
  *counts*, not raw unmoderated photos.
- **Store is in-memory** behind simple functions (`lib/public/store.ts`),
  per-process — same Supabase-swap seam and **same schema sign-off gate** as
  monitoring. Abuse handling (rate limit, CAPTCHA, moderation) is a noted
  production concern, not built.

Verified: typecheck, build, and live exercise of flagged / dispute / confirm /
export endpoints. Home page now links `/explore`, `/intake`, `/alerts`.

---

## D-012 — Acoustic ground truth ingest (stretch)

Built the ingest endpoint + data model for ESP32 chainsaw / heavy-vehicle nodes,
seeded with simulated events so the PDF exhibit renders before any hardware.

- **Modelled the real LoRa chain**, not a toy: node → LoRa → gateway/network
  server (TTN, ChirpStack) → HTTP webhook → `/api/acoustic/ingest`. Node identity
  is a **DevEUI**; uplinks carry a **frame counter (fCnt)**, **RSSI/SNR**, and a
  gateway id. Ingest is **idempotent on (devEui, fCnt)** because LoRa delivers the
  same frame via multiple gateways. Verified live: duplicate frame → `200
  duplicate:true`.
- **Location resolves** from the event's GPS or the node's registered position —
  most low-power nodes have no GPS. Unknown node *with* a location auto-provisions
  (`status:"provisional"`); *without* one is rejected.
- **Auth:** bearer token (`ACOUSTIC_INGEST_TOKEN`), the TTN-webhook pattern; unset
  → open for dev.
- **The exhibit is the point.** `buildExhibit(events, plotLocation, {radiusKm,
  since})` (pure) returns the events near a plot, time-ordered, with haversine
  distances + a summary — the exact shape the PDF exhibit section consumes.
  "Satellite says where (the plot); the nodes say when (these timestamped nearby
  detections)." Verified live: near the Ratnapura plot, 27 chainsaw + 4
  heavy-vehicle from 3 nodes within 3 km; empty far away.
- **Seed is deterministic** (`mulberry32`): a realistic clearing *burst* over ~3
  days near the Ratnapura plot plus background scatter elsewhere, so the exhibit
  is compelling and stable across rebuilds.
- **In-memory store**, same Supabase-swap seam and schema-sign-off gate as the
  other layers. `/acoustic` previews nodes, the exhibit, and the event stream.

Tests: `test/acoustic.test.ts` (haversine, 5 cases); buildExhibit verified via the
live endpoint. Typecheck + build clean. Total suite now 24 unit tests.

---

## D-013 — Deploy readiness + demo-path hardening

Hardened the exact demo sequence (capture on a phone → evidence pack → public
map) against everything that can fail on conference wifi.

- **Deploy:** ready for Vercel + Supabase; `DEPLOY.md` has the commands + env
  table. Cannot deploy from here (no Vercel login / git remote) — that's the
  user's step. `next build` + `next start` verified stable.
- **No stack traces / no forever-spinners:** `app/error.tsx`,
  `global-error.tsx`, `not-found.tsx`, `loading.tsx` turn any failure into an
  explainable card; a 404 renders friendly (verified).
- **Slow / flaky network:** `lib/net.ts fetchJson` (timeout + one retry +
  human-readable errors); global `OnlineBanner`; tile-load failures show a hint
  ("you can still trace; pre-cache when you have signal") instead of a grey map.
- **Denied geolocation:** `lib/geo/locate.ts getPosition` never throws and always
  explains; wired into TraceMap (reassures "tracing doesn't use GPS"),
  AttestationForm, DisputeForm — capture never blocks on a location fix.
- **Analysis not finished:** the new `/plot/[id]` evidence pack drives
  `/api/analysis/submit` + `/api/analysis/poll` with explicit states —
  warming/queued/running/slow/failed — each a readable sentence with a Retry,
  plus honest handling of the `insufficient_data` verdict. Verified live:
  queued→running→succeeded.
- **Cold serverless start:** `/api/health` + `warmup()` pinged from intake and
  the pack page; submit/poll use retries to absorb the first-call latency.
- **The evidence pack** renders all required sections on-screen (identifiers,
  verdict, geometry + CRS stated, imagery captions, methodology + access dates,
  caveats, attestation, acoustic exhibit) with **Print / Save-as-PDF** as the
  demo output while the PDFKit generator stays parked on caveats sign-off.
- **Seed:** `Load bundled seed` button imports `public/seed/plots.csv` through the
  same save-gate; `public/seed/README.md` + `plots.template.csv` define the
  format. No coordinates are fabricated — the map/pack only ever show loaded data.

Verified: typecheck, build, 24 unit tests, live health/analysis/404 smoke.

**Blocked on you:** (1) deploy needs your Vercel login; (2) real plot coordinates
— drop them at `public/seed/plots.csv` (3 countries, one cooperative each).

---

## D-014 — PREMISE PIVOT: farmer-first direct-export compliance

The product changed. It is no longer "help an exporter prove EUDR compliance."
It is **"help the farmer sell direct to EU/UK/US buyers and keep the margin"** by
handling the whole documentation/certification wall. Confirmed choices:
**B2B direct-to-importer**, **both ML anchors**, **multi-market EU/UK/US**.

- **New primary user: the farmer** (tech-comfortable and traditional). New front
  door `/sell`: four plain questions (what you grow → HS code, where you farm,
  where you sell, how much) → a personalized documents checklist + shipping
  options. Copy is short, one-decision-per-step, translation-ready.
- **Requirements as data** (`lib/compliance/catalog.ts`): products (with HS
  codes), markets (EU/UK/US), and a document registry where each doc has an
  `applies(ctx)` predicate. Adding a product/market/document is data, never code.
  Resolver + HS classifier + shipping suggester are pure and tested (10 cases):
  EU+coffee→EUDR+phyto; EU+tea→neither; US+coffee→FDA prior notice; organic claim
  → organic cert; durable high-volume→FCL, low→LCL, perishable→air.
- **Both ML anchors kept:** (1) deforestation detection stays as the engine
  behind the EUDR document; (2) **HS-code / requirements intelligence** is the new
  data-science core — a transparent keyword baseline today with a clear seam to an
  embedding/LLM classifier, plus the requirements knowledge base. LLM
  translate/explain is the next extension.
- **Honesty rule carried over:** the app never invents law. Every requirement
  cites a source and says "verify with the authority." Same ethos as the caveats.
- **First generated document:** commercial invoice (`/documents/invoice`),
  prefilled from the sale intent, printable. Packing list / certificate-of-origin
  helper follow the same pattern.
- **How prior work maps:** plot capture + attestation + analysis + evidence pack
  → the **EUDR document**, reached from the checklist's "EUDR evidence" item
  (links to `/intake`). Monitoring → reframable as "keep your certification
  valid." **Public map + acoustic → parked** (watchdog features, off the new
  premise) — kept working, not deleted.

Verified: 34 unit tests, typecheck, build, live 200s on `/`, `/sell`,
`/documents/invoice`, `/intake`.

**Open follow-ups from the pivot:** packing-list + certificate-of-origin
generators; LLM translation/explanation of requirements; persist sale intents +
per-document status (needs auth/schema); decide whether to rename the product.

---

## D-015 — Document generator set completed + scope discipline

Closed the first two pivot follow-ups (packing list + certificate of origin) and
made a deliberate, honest call about what is *not* being built before the
deadline, rather than leaving ten things half-real.

**Built (the "we generate the documents" promise, now three deep):**
- **Packing list** (`/documents/packing-list`) and **certificate of origin**
  (`/documents/certificate-of-origin`), matching the invoice pattern: prefilled
  from the saved sale intent, printable / Save-as-PDF, self-contained.
- **Documents hub** (`/documents`) — a durable return point that re-resolves the
  checklist from the persisted intent (the generators all assume one exists).
- **Shared `DocumentChecklist`** component now backs both `/sell` step 5 and the
  hub, so the two lists can't drift; removed the duplicated inline version.
- **Pure `lib/compliance/documents.ts`** (packing totals with physical invariants
  — whole packages, gross ≥ net; suggested even split; invoice line amount; doc
  numbers). Tested: `test/documents.test.ts` (7 cases). Suite now 41 unit tests.
- Catalog `actionHref`s point at the real generators; home page links the hub.

**Honesty posture on the certificate of origin.** It is `issuer: authority`, so the
app must not *issue* it. It generates a **clearly-marked DRAFT** the farmer prints
and takes to the Chamber of Commerce / trade authority to be certified (banner is
printed too; the form carries an empty "certification by the authority" block).
This saves the form-filling without pretending to be the certificate — the same
"never invents law / never overclaims" rule as the EUDR caveats.

**Doc drift fixed.** PROJECT.md now opens with a pivot banner pointing here; the
original brief is retained for history but explicitly superseded.

**Deliberate cuts for the deadline (solo, part-time, late-Aug), with honest cost.**
These are recommendations acted on, not silent drops — reverse any on request:
- **Do not train a satellite model from scratch** — integrate existing forest-loss
  data (Hansen/RADD/JRC) for real plots instead. *Cost:* no bespoke-model story;
  gains real results on real plots (aligns with ML.md's "finish + validate").
- **EU-first depth over EU/UK/US breadth.** The engine stays data-driven (a market
  is a row) but UK/US requirements are not being validated to the same standard.
  *Cost:* weaker breadth-scoring; avoids publishing legal detail we can't stand behind.
- **Keep Print / Save-as-PDF, leave the PDFKit server generator parked.** *Cost:*
  less polished output; functionally sufficient for the pack and every document.
- **Keep in-memory / localStorage / IndexedDB; no live Supabase persistence or auth
  yet.** *Cost:* not multi-user / not cold-start-durable — a prototype, stated as such.
- **LLM translation deferred; watchdog layers (public map, acoustic, monitoring)
  stay parked, not deleted.** *Cost:* loses the public-good and "in-time" stories
  from the headline; they remain demoable as "also here".

**Still blocked on you (unchanged):** deploy needs your Vercel login; real plot
coordinates at `public/seed/plots.csv`; schema sign-off (SCHEMA.md) before any of
the stubbed persistence becomes real. The long-lead-time item is the real
coordinates — chase the cooperatives this week; it can't be coded around.

Verified: typecheck, build, `npm test` (41/41), live 200s on `/`, `/sell`,
`/documents`, `/documents/invoice`, `/documents/packing-list`,
`/documents/certificate-of-origin`.

---

## D-016 — Completion pass: languages, document status, real imagery, deploy packaging

The "make it fully complete for deploy" pass. Every closable gap against the pivot's
intended features (D-014) closed; the genuinely blocked items are listed at the end
of this entry rather than papered over.

**Language support (the "traditional farmers" promise):** English / Sinhala / Tamil
(`lib/i18n`, Sri Lanka first per D-015's EU-first depth; adding a language is a
dictionary, not code). A `LanguageSwitcher` sits on the home page, `/sell`, and
`/documents`; wizard chrome, checklist labels, status pills, summaries and
disclaimers all follow it, hydration-safe via `useSyncExternalStore`. **Deliberate
limit, stated in-app:** per-document guidance text and the generated documents stay
English — documents because customs authorities expect English (a translated note
says so), guidance because machine-translating semi-legal text without review risks
misleading a farmer. That is the LLM-translation seam, still open.

**Per-document status (closes a D-014 follow-up):** `lib/compliance/status.ts` —
localStorage keyed by the sale's identity (product+origin+market+claim), so a new
sale starts fresh and a returning farmer keeps progress. Generators mark their
document "in progress" on open; the farmer marks "done"; `/documents` shows an
X-of-N progress bar. Pure logic (key identity, progress, toggle) tested
(`test/status.test.ts`, 4 cases → suite 45). Durable per-user status still follows
auth/schema, as before.

**Real satellite imagery in the evidence pack:** the poll API route rewrites the
analysis service's relative `/tiles/...` URLs against `ANALYSIS_SERVICE_URL`, and
`/plot/[id]` now renders the real before/after tiles (stub results keep a labelled
placeholder). With the service up, the pack shows genuine Sentinel-2 true-colour
tiles — polygon overlaid, date burned in, consistent stretch.

**Deploy packaging for both halves:** `service/Dockerfile` (+`.dockerignore`;
`server.py` honours injected `PORT`) so the analysis service deploys to any
container host; DEPLOY.md now covers web + service + the env switch + both demo
paths. Verified this pass: typecheck, build, 45/45 tests, live 200s on all nine
farmer-path and supporting routes.

**Honest remainder — cannot be completed from this environment:**
1. **Deploy execution** — needs your Vercel login (web) and a container-host login
   (service). Everything is one command away; DEPLOY.md has the exact commands.
2. **Trained U-Net** — needs a GPU (Colab, `service/TRAIN.md`); until then verdicts
   carry `modelVersion: ndvi-proxy-0.1`, which the PDF/methodology states.
3. **Supabase persistence + auth** — needs schema sign-off (open since D-008) and a
   provisioned project; client/in-memory storage stands in, stated as such.
4. **Real plot coordinates** (`public/seed/plots.csv`) — the long-lead item only you
   can obtain.
5. **Open sign-offs** below (countries, PII, schema) — decisions that are yours.

---

---

## D-017 — ML becomes the spine, not a bolted-on notebook

The project is submitted under Big Data/ML/AI/Data Science and did not support
the claim: the satellite model was deleted (D-015), leaving a univariate price
forecast that beats naive by 4.6 vs 4.9 MAPE and a 37-line keyword matcher
labelled "the data-science front door".

Reorganised around the three jobs a farmer actually has — **grow it, price it,
pass it** — with one data spine. The plot record already captured for EUDR now
also keys the weather grid cell and the sensor binding.

**The architectural decision that made it possible in the time available:** every
model ships as a **static artifact consumed client-side**, following the pattern
`ml/prices` already proved. No Python service, no inference server, no new API
routes. `app/api/` still contains exactly one route. The CNN runs in the browser
via ONNX; weather is Open-Meteo called directly (CORS-open, no key); the soil
probe talks to the page over Web Serial.

**GROW lane built (deterministic half first, deliberately):** FAO-56 water
balance and a weather-driven disease-risk engine, both pure and tested. No model
to train, no dataset to caveat — which de-risked the lane before the CNN landed.

Three things real data changed that unit tests alone would not have caught
(`scripts/live-check.ts` runs the chain against live Open-Meteo):

1. Canopy interception was a flat 2 mm/day. Against a month of live Nuwara Eliya
   weather that zeroed nearly every light-rain day and said "water soon" on a
   plot whose own soil-moisture data said it was saturated.
2. Surface soil moisture (0.45) is nothing like the root zone (0.33). Now
   depth-blended over the crop's rooting depth from four Open-Meteo layers.
3. That made an **anchoring ladder** worth building: sensor > grid > balance. An
   observation of the state beats an integration toward it, because a running
   balance accumulates every coefficient error and never forgets it. The UI names
   which tier answered — a farmer deciding whether to act on "water now" should
   know whether anything actually touched their soil.

Also: temperature is a **gate**, not a weighted term, in the risk model. As a
weight it let blister blight score maximum risk at 28 °C, past the point
*Exobasidium vexans* develops. A necessary condition must be a gate; no weight is
large enough to substitute for one.

---

## D-018 — Tea classifier: licence and audit before training

Trained a MobileNetV3-Small leaf classifier. The order of work is the decision
worth recording: **licence, then audit, then training loop.** The acoustic model
was built on ESC-50 and only afterwards found to be CC BY-NC, which made the
weights unshippable and the effort dead.

**Licence finding.** For both primary datasets the Data in Brief *article* is
CC BY-NC while the Mendeley *dataset* is CC BY 4.0. A web search for teaLeafBD's
licence returns "CC BY-NC" — the article licence reported as the data licence.
Reading the authoritative repository record rather than a mirror decided the
outcome. All datasets used are CC BY 4.0: commercial use and trained weights
permitted, with attribution and a statement of modification.

**Audit findings that changed the plan** (`models/tea/dataset-audit.md`):

- CS-D is **9,000 photographs, not 80,329 images** — 8.93x augmented, grouping
  undocumented, recovered empirically (nearest neighbour at index delta exactly
  1500). Splitting on images would have produced ~99% "accuracy" that was
  memorisation of augmented siblings.
- **teaLeafBD publishes no images at all.** The CC BY 4.0 record contains zero
  image files in any version. Licence clean, nothing to license. Dropped.
- **Blister blight appears in exactly one of five datasets.** It is the flagship
  Sri Lankan disease, the one `lib/grow/risk.ts` models, and it can never be
  cross-dataset validated.
- **TLD-BD cannot support an estate hold-out.** It names two estates with GPS in
  prose; 0 of 4,016 files carry EXIF GPS, though 100% carry other EXIF — so GPS
  was never recorded, not stripped. Kept test-only.

**The result is a gap, not a number.** In-distribution 0.9975 accuracy against
~0.70 cross-dataset. The three test sets are never averaged; they measure
different things. Calibration does not survive the domain shift either — ECE
0.0006 in-distribution, 0.20–0.24 cross-dataset, i.e. the model stays confident
while becoming wrong.

**The abstention mechanism is therefore not optional**, and choosing its
threshold exposed a subtle trap: the first rule took the lowest threshold
reaching 95% accuracy-on-accepted, but validation accuracy is 0.9964 at threshold
0.0, so it chose 0.0 and the mechanism could never fire. A validation set
contains no out-of-distribution inputs *by construction*, so it cannot locate
where the model becomes unreliable on them. Replaced with the 5% quantile of
in-distribution confidence — a question validation can answer. On EWU it declines
65% of inputs and lifts accuracy on the rest from 0.706 to 0.957.

**Taxonomy is a contract** (`models/tea/taxonomy.json` + `lib/grow/teaClasses.ts`,
drift-tested). Class IDs are stable forever; dataset folder names never reach the
app. Two of six classes are **pests**, so `riskEngineKey` is `null` for them —
meaning *no environmental prior exists*, not *prior is neutral*. Fusion must not
reweight a mite by a fungal infection window. Red rust, algal leaf spot and red
leaf spot stay unmerged: the pathology literature says one disease, two unrelated
annotation teams shipped them separate, and a wrong merge is unrecoverable once
trained.

---

## D-019 — Documentation sweep after the pivot

Deleted `GO-LIVE.md` (stages for a service and a U-Net that no longer exist;
redundant with `DEPLOY.md`) and `ml/acoustic/` (orphaned once its routes went).
Rewrote `ML.md`, `PROJECT.md`, `SCHEMA.md`, `PARKED.md`, `NEXT-STEPS.md`,
`DEPLOY.md`.

Two of these were **live bugs, not stale prose**:

- `vercel.json` ran a daily cron against `/api/monitoring/sweep`, deleted weeks
  earlier — a 404 every night in production.
- `.env.example` documented four secrets whose features were all gone, inviting
  someone to provision credentials for nothing.

Also removed six orphaned i18n keys across all three dictionaries, corrected the
`/whats-real` claims about acoustic monitoring (which described a page that no
longer exists), and added the tea model's honest limitations there instead.
`/whats-real` is the one page where a stale claim is worse than no page.

---

## D-020 — The finished `/grow`: one advisory, five sections, no fused score

`/grow/diagnose` was a leaf classifier with an evidence list under it. It is now
the whole advisory for a plot, in the order a farmer thinks in: **field status →
leaf assessment → conditions → why → what to do**. Field status and conditions
render before any photograph is taken and survive the model failing outright,
because they are computed by the Day 1 engines from weather — the leaf checker
is an addition to that advice, never a precondition for it.

The rejected alternative was a single combined confidence. It was rejected for
the same reason `lib/grow/fusion.ts` was never written: a temperature-scaled
posterior over six disease classes and a trapezoidal infection-pressure index
are not commensurable, so any average of them is a number with no referent. When
the photograph and the weather disagree, the app now says so and recommends
inspection. The disagreement is the most useful thing on the screen and merging
would have deleted it.

Four defects were fixed on the way, all of them silent:

- **Wrong-plot association.** `/grow` and `/grow/diagnose` each picked
  `plots[0]` independently, so selecting a second plot and tapping "check the
  leaves" produced a leaf assessment composed against the FIRST plot's weather,
  soil and infection pressure, with nothing on screen revealing the swap. Both
  pages now share `lib/grow/selection.ts`, and switching plots clears any leaf
  result rather than re-describing it. The previous plot's profile is also
  cleared before the new one loads, so the water balance is never computed from
  the last plot's crop and soil.
- **Engineering identifiers on a farmer's screen.** The evidence layer is pure
  and calls no `t()`, so it was putting raw enum values into user-facing slots:
  the advisory read "Conditions currently favour blister_blight" and "Watering
  advice: water_now", in all three languages. `EvidenceItem.translatedSlots` now
  names which slots carry i18n keys, `lib/grow/tea/display.ts` resolves them,
  and a test renders every scenario in every language and fails on anything
  matching the shape of an identifier.
- **Invisible keyboard focus.** The capture control's real element is an
  `sr-only` file input; a keyboard user tabbing to it saw no ring anywhere.
- **Unreachable leaf check.** The link to `/grow/diagnose` lived inside the
  weather-dependent risk block, so a tea grower with no signal could not reach
  the one feature that does not need weather.

Translation policy is unchanged and now enforced rather than assumed: labels,
states, errors, buttons, bands, and disease names are translated in all three
languages and a test fails on any English fallback among them; the advisory
SENTENCES and action instructions stay English by choice (D-016 — a
mistranslated instruction a farmer acts on is worse than an English one), and
`tea_guidance_in_english` discloses that on screen in the reader's language.

**Browser inference remains unverified on a real device.** Nothing in this entry
changes that; see [BROWSER-SMOKE-TEST.md](BROWSER-SMOKE-TEST.md).
