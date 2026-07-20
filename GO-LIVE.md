# GO-LIVE — everything left to deploy the final product, and how to do it

This is the complete, ordered checklist to take PlotProof from "runs on my machine"
to "deployed final product." It's written so you can **deploy incrementally**: after
Stage 1 you have a live, demoable URL; each later stage upgrades one real capability.
Nothing here can be done from the build environment — every step needs one of *your*
accounts, *your* hardware, or *your* decision. That's why it's a runbook for you.

**Legend:** ⏱ rough effort · 🔑 needs an account/login · 🧠 needs a decision only you can make · 💻 just run the commands

---

## At a glance — what each stage unlocks

| Stage | Unlocks | Blocked by | The app without it |
|-------|---------|-----------|--------------------|
| 0. Prep | a pushed repo | — | — |
| 1. Web app → Vercel | a live public URL; the **whole farmer product** works | your Vercel login | (this is the floor) |
| 2. Analysis service | **real satellite verdicts + before/after tiles** | a container-host login | verdicts are the fake stub |
| 3. Supabase + auth | **durable multi-user data**, real login | schema sign-off (🧠) + code work | data is per-browser / resets on restart |
| 4. Train the U-Net | a **real model** instead of the NDVI proxy | a GPU (Colab) | verdicts say `ndvi-proxy-0.1` |
| 5. Real data + legal | **trustworthy real verdicts** | real coordinates + legal verification (🧠) | runs on a test AOI + placeholder law |

You can stop after any stage and still have something real to show. Stages 1–2 are
"just run the commands." Stages 3–5 contain genuine remaining work, flagged below.

---

## Stage 0 — Prep ⏱ 10 min 💻🔑

You need free accounts on: **GitHub**, **Vercel**, and one container host
(**Railway** or **Render** — both have a hobby/free tier). Optional later: **Supabase**,
**Google Colab** (free GPU).

Commit and push the repo (it isn't pushed yet):

```bash
cd c/Users/HP/DeforestationPrediction
git add -A
git status                      # review what's staged — do NOT commit real farmer data or secrets
git commit -m "PlotProof: farmer export-compliance + EUDR evidence + analysis service"
gh repo create plotproof --private --source=. --remote=origin --push
# or: create the repo on github.com, then `git remote add origin ... && git push -u origin main`
```

> ⚠️ Before pushing, confirm `.env*` files and any real `public/seed/plots.csv` are
> git-ignored. `.gitignore` already excludes `node_modules`, `.next`, `.env*`; the
> Python `service/.venv`, `.cache`, `output`, `chips` are large and should stay local.

**Verify:** the repo is visible on GitHub and `.env` is *not* in it.

---

## Stage 1 — Web app on Vercel ⏱ 15 min 💻🔑

This gives you a live URL where the **entire farmer product works immediately**
(`/sell` wizard, HS classifier, all document generators, per-document status, 3
languages, shipping) plus the EUDR intake/pack flow on the built-in stub verdict.

```bash
npm i -g vercel        # once
vercel login           # your account
vercel                 # links the project + preview deploy
vercel --prod          # production deploy
```

Or on vercel.com: **New Project → import the GitHub repo → Deploy** (framework
auto-detects as Next.js). The daily monitoring cron in `vercel.json` activates
automatically.

**Env vars (Vercel → Project → Settings → Environment Variables):** none are required
for Stage 1 — every service falls back to a stub. Leave them unset for now.

**Verify:**
```bash
curl https://<your-app>.vercel.app/api/health          # {"ok":true}
```
Then walk it in a browser: `/` → switch language → `/sell` → answer 4 questions →
generate an invoice → `/documents` (progress bar). This is the demoable product.

---

## Stage 2 — Analysis service (real satellite verdicts) ⏱ 30–45 min 💻🔑

Deploys the Python service so `/plot/<id>` runs real Sentinel-2 analysis and shows
real before/after tiles instead of the placeholder. (Verdict still uses the NDVI
proxy until Stage 4 — that's honest and labelled in `modelVersion`.)

### 2a. Build the image locally first (sanity check)
```bash
docker build -t plotproof-analysis ./service
docker run -p 8000:8000 plotproof-analysis
curl http://localhost:8000/health                       # {"ok":true}
```

### 2b. Deploy to a container host
**Railway** (simplest):
```bash
npm i -g @railway/cli
railway login
railway init
railway up                     # builds ./service/Dockerfile, gives you a URL
```
**Render:** New → Web Service → connect the repo → Root Directory `service` →
Runtime "Docker" → Create. It reads `service/Dockerfile` and assigns a URL and `PORT`
(the server honours `PORT`).

> First analysis of a plot downloads satellite scenes (minutes); warm re-analyses are
> seconds. On Render/Railway, add a **persistent disk mounted at `/app/.cache`** so
> the scene cache survives restarts (optional but worth it).

### 2c. Connect the web app to it
In Vercel env, set:
```
ANALYSIS_SERVICE_URL = https://<your-service-host>
ANALYSIS_STUB        = 0
```
Redeploy the web app (`vercel --prod` or push to main). No code change — the poll
route rewrites tile URLs against this host automatically.

**Verify:**
```bash
curl https://<your-service-host>/health
# then in the app: capture a plot at /intake, open /plot/<id> — real tiles + a real
# (proxy) verdict should appear, not the "sample imagery — stub result" box.
```

---

## Stage 3 — Supabase persistence + auth ⏱ 1–3 days 🧠💻🔑

This is the first stage with **real remaining code work**, not just config. Today all
plot/farmer/monitoring/public/acoustic data lives in the browser (IndexedDB/localStorage)
or in per-process memory that resets on a serverless cold start. To make it durable and
multi-user:

### 3a. 🧠 Sign off the schema
Read `SCHEMA.md` (the proposal) and confirm the modelling — especially geometry storage
(`geometry(Polygon,4326)` + equal-area reprojection per country) and the immutable,
versioned `country_profile_versions` (so an old verdict stays reproducible when a country
changes its forest definition). **This is a decision only you can make.**

### 3b. Provision + migrate
```bash
# On supabase.com: New Project. Then, in the SQL editor or via the CLI:
create extension if not exists postgis;
# Write migrations from the signed-off SCHEMA.md (tables: countries, country_profile_versions,
# cooperatives, farmers, plots, attestations, analysis_runs, alerts, disputes, acoustic_events).
# NOTE: migrations are NOT written yet — SCHEMA.md is a proposal. This is the main code task here.
```

### 3c. Swap the stub stores for Supabase (the seams are already isolated)
Each of these is a single-file implementation behind an interface — replace the
in-memory/stub body with a Supabase-backed one; callers don't change:
- `lib/intake/sync.ts` — `SyncTransport` (drain the offline outbox to Postgres/PostGIS)
- `lib/monitoring/repo.ts` — `getMonitoringRepo` (subscriptions + alerts)
- `lib/public/store.ts` — flagged features + disputes
- `lib/acoustic/store.ts` — nodes + events
- `lib/analysis` result persistence (store `analysis_runs`)

### 3d. Auth
Replace the officer-identity placeholder (`lib/intake/officer.ts`) with Supabase
magic-link auth; gate `/intake`, `/alerts`. Attestation code doesn't change (it already
snapshots identity).

### 3e. Env (Vercel)
```
NEXT_PUBLIC_SUPABASE_URL       = https://<proj>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY  = <anon key>
SUPABASE_SERVICE_ROLE_KEY      = <service role key>   # server-side writes only
```
Also set Row-Level Security policies so a cooperative only sees its own plots.

**Verify:** capture a plot on one device, see it on another after sign-in; restart the
service and confirm monitoring/public data survives.

---

## Stage 4 — Train the real model ⏱ 1–2 days of work + GPU time 🧠💻🔑

Replaces the NDVI proxy with the U-Net. The pipeline is written and smoke-verified;
it needs real training data and a GPU. Follow `service/TRAIN.md`. Prerequisites, in order:

1. **Extend the chip builder to 10 channels.** Today it saves 4 optical bands; the model
   needs `[10,256,256]` = B02 B03 B04 B08 B11 B12 + NDVI + NDMI + S1 VV + VH. Add the two
   SWIR bands to `config.BANDS` and save co-registered `radar.npy` per chip (the S1 RTC
   read path from Stage-2 alignment already exists).
2. **Fix the data-quality issues the QA grid found:** tighten the cloud gate (thin haze
   leaked into Amazon/Borneo chips) and the dry-deciduous label rule (require Hansen +
   WorldCover agreement, or a higher canopy threshold in dry biomes).
3. **Scale the chip set** — raise `config.CHIPS_PER_REGION` and add regions until each
   stratum has real volume (hundreds+, not the current ~19).
4. **Train on Colab** (free T4): upload `chips/` + `model.py dataset.py train.py
   requirements-train.txt`, then `!pip install -r requirements-train.txt && python
   train.py --chips ./chips --epochs 40 --batch 8`. Best checkpoint → `forest_unet.pt`.
5. **Run the evaluation** (`eval.py`) and read the per-country / per-forest-type table —
   expect an *uneven* table (plantation-vs-natural is the known weak spot).
6. **Swap it into the service:** replace `forest_prob_proxy` in `service/analyze.py` with
   a `torch` load of `forest_unet.pt`, and change `MODEL_VERSION` to e.g. `unet-fused-v1`.
   Add `torch` to the service image. Also start fusing S1 into the live series (today
   `analyze.py` is optical-only, `sensor:"S2"`).

> Optional but recommended for the plantation problem: add a per-pixel plantation dataset
> (e.g. Descals global oil-palm) so the model can actually separate mature rubber/palm
> from natural forest — the single most important accuracy gap.

**Verify:** `/plot/<id>` shows `modelVersion: unet-fused-v1`; the eval table is defensible.

---

## Stage 5 — Real data + legal verification ⏱ ongoing 🧠

The last mile that makes verdicts *trustworthy*, not just *real-shaped*:

1. **Real plot coordinates** — collect from the cooperatives and drop them at
   `public/seed/plots.csv` (format in `public/seed/README.md`). This is the long-lead
   item; start it early.
2. **🧠 Verify each country's forest definition.** `service/profiles.py` canopy %, min
   area, min height and cutoff are **placeholders marked VERIFY**. Confirm them against
   each nation's official EUDR forest definition before any real verdict is issued —
   the app must never invent law.
3. **🧠 Re-verify the EUDR dates** near submission (they've been amended twice; see
   DECISIONS.md D-001).
4. **Validate UK/US requirement content** to the same depth as EU, or keep the app scoped
   to EU and say so.
5. **PII decision** (DECISIONS.md D-007): consent flow + whether national-ID card images
   are stored, per country.

---

## Optional polish (not required to deploy)

- **Server-side PDF** — today the evidence pack + documents use browser Print/Save-as-PDF,
  which is fully functional. A PDFKit generator (caveats prose already drafted) would give
  a downloadable file instead.
- **LLM translation** of the per-document guidance (document bodies stay English for customs).
- **Capture methods not built:** corner capture, boundary walk, national-ID-card scanning
  (designed in DECISIONS D-007 but never implemented).

---

## Environment variable reference

| var | stage | needed for |
|-----|-------|-----------|
| `ANALYSIS_SERVICE_URL` | 2 | point web app at the real analysis service |
| `ANALYSIS_STUB=0` | 2 | turn off the fake-verdict stub |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 3 | Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | 3 | privileged server-side writes |
| `CRON_SECRET` | 1+ | protects the daily monitoring sweep cron |
| `ALERT_WEBHOOK_SECRET` | 1+ | signs outgoing alert webhooks |
| `ACOUSTIC_INGEST_TOKEN` | 1+ | authenticates the LoRa ingest webhook |
| `PORT` | 2 | injected by the container host; server honours it |

(Full descriptions in `.env.example` and `DEPLOY.md`.)

---

## Final go-live checklist

- [ ] Stage 0 — repo pushed; no secrets/real data committed
- [ ] Stage 1 — web app live on Vercel; `/api/health` ok; farmer flow walked
- [ ] Stage 2 — analysis service deployed; `ANALYSIS_SERVICE_URL` set; `/plot/<id>` shows real tiles
- [ ] Stage 3 — schema signed off; migrations run; stubs swapped; auth on; data survives restart
- [ ] Stage 4 — 10-channel chips built; model trained on Colab; eval table read; proxy swapped out; S1 fused
- [ ] Stage 5 — real coordinates loaded; country forest definitions verified; EUDR dates re-checked; PII decided
- [ ] Set the operational secrets (`CRON_SECRET`, `ALERT_WEBHOOK_SECRET`, `ACOUSTIC_INGEST_TOKEN`)
- [ ] Re-run `npm run typecheck && npm test && npm run build` before the final prod deploy

**Minimum viable public demo = Stage 1 (≈25 min).** Fully real product = all five stages.
