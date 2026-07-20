# Deploy & stability

Two deployables: the **web app** (Next.js → Vercel) and the **Python analysis
service** (`service/` → any container host). Supabase remains the (still pending)
persistent layer. I can't push to your Vercel/hosting accounts from here — that
needs your logins — so this is the exact path. Everything below is verified to
build and run locally.

## 1. First deploy

```bash
# from the repo root
npm i -g vercel          # once
vercel login             # your account
vercel                   # link + preview deploy
vercel --prod            # production deploy
```

Or connect the repo on vercel.com (push it to GitHub first: `gh repo create`,
`git push -u origin main`). The daily monitoring cron in `vercel.json` activates
automatically on Vercel.

## 2. Environment variables

Set these in Vercel → Project → Settings → Environment Variables (see
`.env.example`). None are required for the **demo** (all services fall back to
stubs), but set them for real behaviour:

| var | needed for |
|-----|-----------|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase (after schema sign-off) |
| `SUPABASE_SERVICE_ROLE_KEY` | server-side privileged writes |
| `ANALYSIS_SERVICE_URL` | real Python analysis service (else stub) |
| `CRON_SECRET` | protects the monitoring sweep cron |
| `ALERT_WEBHOOK_SECRET` | signs outgoing alert webhooks |
| `ACOUSTIC_INGEST_TOKEN` | authenticates the LoRa ingest webhook |

## 3. Stability notes

- **Error boundaries:** `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`
  turn any thrown error into an explainable card, never a stack trace.
- **Cold starts:** `/api/health` is pinged (`warmup()`) from the intake and pack
  pages to wake serverless functions before they're needed.
- **In-memory stores** (monitoring, public, acoustic) are per-process and reset
  on a cold start — fine for the demo (seed data re-seeds deterministically), but
  the reason the Supabase-backed versions are the production target once the
  schema is signed off.

## 4. The analysis service (real satellite verdicts + tiles)

Without it, the web app falls back to the built-in stub (fake verdicts, placeholder
imagery). With it, `/plot/<id>` runs real Sentinel-2 analysis and shows the real
before/after tiles.

```bash
docker build -t plotproof-analysis ./service
docker run -p 8000:8000 plotproof-analysis          # local
```

Deploy the same image to Railway / Render / Fly.io / Cloud Run (each gives a free
or hobby tier; they inject `PORT`, which the server honours). Mount a volume at
`/app/.cache` if you want the scene cache to survive restarts — first analysis of
a plot downloads scenes (minutes), warm re-analyses are seconds.

Then in Vercel env: `ANALYSIS_SERVICE_URL=https://<service-host>` and
`ANALYSIS_STUB=0`. The web app switches over with no code change, and the poll
route rewrites tile URLs against that host automatically.

Honesty note: the per-pixel classifier inside is the documented NDVI proxy
(`modelVersion: ndvi-proxy-0.1`) until the U-Net is trained on Colab
(`service/TRAIN.md`) — swapping it in changes one function + the version string.

## 5. Verify a deploy

```bash
curl https://<your-app>.vercel.app/api/health          # {ok:true,...}
curl https://<your-app>.vercel.app/api/public/flagged  # GeoJSON
curl https://<service-host>/health                     # {ok:true} (analysis service)
```

Then walk the two demo paths:
- **Farmer (the pivot's spine):** `/` → language switch → `/sell` (4 questions) →
  checklist + shipping → generate invoice / packing list / CoO draft → `/documents`
  (progress bar).
- **EUDR evidence:** `/intake` → capture → `/plot/<id>` (real verdict + tiles when
  the service is up) → `/explore`.
