# Deploy

**One deployable.** The Next.js app on Vercel, with Supabase behind it.

There is no longer a second service to host. The Python analysis service was
deleted (`PARKED.md`), and every model now ships as a static file in
`public/models/` that runs in the browser. `app/api/` contains one route:
`health`.

## 1. Deploy the web app

```bash
npm i -g vercel     # once
vercel login        # your account
vercel              # link + preview deploy
vercel --prod       # production
```

Or connect the repo at vercel.com after pushing it (`gh repo create`,
`git push -u origin main`).

## 2. Environment

Two variables, both public, both protected by Row Level Security:

| Variable | Where |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page (the `sb_publishable_…` key) |

Set them in Vercel → Settings → Environment Variables, then redeploy.

**Without them the app still runs**, as an anonymous prototype: sync says "on
this device only" and `/verify/<id>` says verification is unavailable. Nothing is
faked and nothing crashes.

The GROW lane needs no keys at all. Open-Meteo requires none, and the tea
classifier is a static file.

## 3. Database

Apply the migrations in `supabase/migrations/` in order, via the Supabase
dashboard SQL editor (see `supabase/README.md`). Four objects: `user_state`,
`farmers`, `plots`, `attestations`, `media`, `lot_verification`.

## 4. Verify the deploy

```bash
curl -s https://<your-app>/api/health        # {"ok":true,...}
curl -sI https://<your-app>/models/tea-disease-mnv3s.onnx | head -1   # 200
```

Then walk the three lanes:

| Lane | Path | Should show |
|---|---|---|
| GROW | `/grow` | plot picker → crop/soil → weather, watering verdict, disease pressure |
| EARN | `/sell` | four questions → HS code, checklist, shipping, price card |
| PROVE | `/documents`, `/intake` | checklist + generators; capture → attest → `/verify/<id>` |
| — | `/models` | every model with its metrics, datasets, licences and limitations, read from the published artifacts |

Kill your network on `/grow` and confirm it says weather is unavailable rather
than spinning — every number on that page derives from weather, so it renders
nothing rather than estimating.

**One gate is not closed by any of the above.** In-browser ONNX inference has
never been observed on a real device. Work through
[BROWSER-SMOKE-TEST.md](BROWSER-SMOKE-TEST.md) on an Android phone and a desktop
browser before treating `/grow/diagnose` as released.

## Local

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # 196 unit tests
npm run typecheck
npm run build
```

## Re-training the models

Neither is needed to deploy; both are reproducible.

```bash
# tea classifier — see ml/tea/README.md for the full pipeline
python ml/tea/check_leakage.py --csd <d> --ewu <d> --tld <d>   # must pass first
python ml/tea/train.py --csd <d> --img-size 160 --samples-per-group 1 --epochs 14
python ml/tea/evaluate.py --csd <d> --ewu <d> --tld <d>
python ml/tea/export.py

# price intelligence — run ml/prices/*.ipynb in Colab, commit the JSON
```

Datasets are fetched from the DOIs pinned in `models/tea/provenance.json` and are
never committed.
