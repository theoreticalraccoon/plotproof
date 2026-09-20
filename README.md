# PlotProof

Software for the Sri Lankan factory, cooperative or exporter that ships smallholder
crops, and for the field officer standing in the plot with one mid-range Android
phone and no signal. The grower holds the phone; the customer is whoever files the
paperwork and has to show where every supplier's crop was grown. It covers three
jobs across a season — **grow the crop, price it, prove it** — from a single plot
record.

Under EUDR the EU operator files the due-diligence statement, never the smallholder,
so the evidence this produces is built to be handed up the chain. EUDR Annex I covers
cattle, cocoa, coffee, oil palm, rubber, soya and wood: **tea is not on it**, and the
product catalogue marks it `eudrCovered: false` so the check never appears for tea.

Trilingual (English, Sinhala, Tamil). Offline-first, because that is the operating
condition rather than a feature.

---

## The claim this project is built around

Every number a farmer sees traces to a measured value in a published artifact, or
is deterministic and cited. Nothing is a figure that felt about right.

That constraint shows up everywhere in the code: no model constant is typed into a
component, every dataset licence was read from its original DOI before a single
image was downloaded, the classifier abstains rather than guessing on photographs
unlike the ones it learned from, and a script fails the build if the model card,
the shipped weights and the documentation ever disagree.

There is an inventory of what is and is not real at **`/whats-real`**, and the
technical evidence — architecture, datasets, licences, three separate test sets,
calibration, limitations — at **`/models`**.

---

## Product surfaces

| Route | What it does |
| --- | --- |
| `/grow` | Weather, a watering verdict and disease pressure for one plot, computed from that plot's own conditions. Says which tier of evidence set the soil state. |
| `/grow/diagnose` | The full advisory: field status → leaf assessment (the CNN) → conditions → why → what to do. Each line of the "why" names its own provenance. |
| `/grow/sensor` | Connect a Magicbit soil probe over USB (Web Serial), calibrate it against air and water, and store readings that outrank the satellite soil model. |
| `/sell` | Four questions → an HS code, a documents checklist, shipping options, and a world reference price shown next to its own forecast error and a naive baseline. |
| `/documents` | Which papers a shipment needs, with generators for the three we can legitimately produce: invoice, packing list, certificate-of-origin *draft*. |
| `/intake` | Offline-first plot capture: draw or walk a boundary, photograph, attest with a signature. Everything persists on-device the instant it is captured. |
| `/verify/[id]` | A public verification URL for one lot, so a buyer can check a claim without an account. |
| `/models` | Technical evidence page: every model with its metrics, baselines where the artifact publishes one, datasets, licences and limitations. |
| `/whats-real` | A blunt inventory of what is working software and what is not. |

---

## The AI / ML surface

### 1. Tea leaf disease classifier — the trained model

A MobileNetV3-Small CNN (~1.5M parameters, 6 MB ONNX) that reads one photograph of
a tea leaf and returns one of six conditions, a calibrated confidence, or a refusal
to answer.

It runs **entirely in the browser** via `onnxruntime-web` compiled to WebAssembly.
There is no inference server; the photograph never leaves the phone.

The result worth reporting is a gap, not a number:

| | In-distribution | Cross-dataset |
| --- | --- | --- |
| Accuracy | ~99.8% on held-out data from the set it trained on | ~70% on photographs from farms it has never seen |
| Calibration error (ECE) | ~0.001 | ~0.20–0.24 |

Calibration does not survive domain shift, which is why abstention is not optional.
At the published threshold the model declines roughly two cross-dataset photographs
in three, and what it does answer is substantially more reliable. The app explains
that decline rate on screen so repeated refusals read as caution rather than
breakage.

Exact figures, per class and per test set, are on `/models` and in
`models/tea/evaluation.json`. **The three test sets are never pooled into a single
headline metric** — they measure different things.

### 2. Deterministic engines — not learned, on purpose

- **Irrigation** (`lib/grow/irrigation.ts`) — the FAO-56 soil-water balance,
  implemented directly, every constant traceable to one of its tables. A farmer
  acting on a watering instruction deserves arithmetic they could check.
- **Disease pressure** (`lib/grow/risk.ts`) — trapezoidal fuzzy membership over
  leaf wetness, temperature, humidity and sunshine for three tea pathogens. Unlike
  the classifier this is computed from *this plot's* weather, so it carries no
  transfer gap. Infection *pressure*, never a diagnosis.
- **Price forecast** (`ml/prices` → `public/models/prices.json`) — a univariate
  ETS forecast that publishes its backtest error next to a naive baseline's,
  including where the margin between them is small.
- **HS code** (`lib/compliance/hs.ts`) — a token-overlap baseline, labelled as one.

### 3. There is deliberately no fusion model

Combining the classifier's output with the weather-driven infection pressure into a
single confidence would produce a number with no referent: a calibrated posterior
over six classes and a fuzzy index over weather conditions are not commensurable.
Worse, merging them would hide the disagreement — which is the most useful thing on
the screen. When the photograph and the weather point different ways the app says
so and recommends inspection. **Environmental evidence can never change the
predicted class.**

---

## Evidence and grounding

Four ideas do most of the work:

1. **Static artifacts, consumed client-side.** Every model ships as a file in
   `public/models/` that a typed loader reads. `app/api/` contains exactly one
   route (`health`). Nothing to run means nothing to break, and it works offline.
2. **No artifact → render nothing.** Never a placeholder, never a guess. Weather
   unavailable means the page says so, not that it estimates.
3. **The card is the source of truth.** No threshold, class name, temperature or
   preprocessing constant is written into a component. They are read from the
   published model card, and the app refuses to load a malformed one.
4. **Provenance is named on screen.** Soil state says whether it came from a
   measurement, a satellite-informed model or a rainfall balance. Weather says it
   is a grid cell near the plot, not a station on it.

---

## Where the artifacts live

| Path | What it is |
| --- | --- |
| `public/models/tea-disease-mnv3s.onnx` | The weights the browser downloads |
| `public/models/tea-disease-mnv3s-card.json` | The model card the app reads every constant from |
| `public/models/prices.json` | Price series, forecasts and baselines |
| `models/tea/evaluation.json` | Full evaluation: per class, confusion matrices, reliability bins |
| `models/tea/provenance.json` | Licence verification per dataset, from the original DOI records |
| `models/tea/taxonomy.json` | The class contract — active and reserved |
| `models/tea/manifest.json` | Dataset inventory: counts, grouping, archive hashes |
| `models/tea/dataset-audit.md` | Sixteen findings from inspecting the actual images |
| `models/tea/TRANSLATION-REVIEW.md` | Every Sinhala/Tamil string awaiting native review |

Training images are **not** committed. Each dataset is fetched from the DOI pinned
in the provenance record; CS-D's archive is verified by SHA-256 before use.

---

## Running it

Node 22 or newer.

```bash
npm install
npm run dev          # http://localhost:3000
```

That is the whole setup. Most of the app needs no keys at all: plot capture, the
documents, the weather and watering advice (Open-Meteo needs no key) and the tea
leaf classifier (a static file that runs in the browser) all work from a clean
clone.

Two features call a service that needs a key of its own. Copy `.env.example` to
`.env.local` and fill in whichever you want:

| Variable | Powers | Without it |
| --- | --- | --- |
| `GFW_API_KEY` | The EUDR forest check on `/sell` and the evidence pack | The check says the forest data service is not configured. Everything else works. |
| `GEMINI_API_KEYS` | The export assistant on `/sell`, comma separated for several keys | The assistant says it is not configured. Everything else works. |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Accounts and sync | Anonymous prototype: sync says "on this device only" and `/verify/<id>` says verification is unavailable. |

Keys live only in `.env.local`, which is gitignored and never committed.
`docs/GFW-API-KEY.md` explains how to get a GFW key; Gemini keys come from
Google AI Studio. Nothing is faked when a key is missing: the feature says so.

**Deploying.** Vercel builds this repository directly; the only environment
variables are `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
both public and both protected by row-level security. Apply the migrations in
`supabase/migrations/` in order. Without either variable the app still runs, as
an anonymous prototype.

### Retraining

Not needed to run the project, but fully reproducible:

```bash
python ml/tea/check_leakage.py --csd <d> --ewu <d> --tld <d>   # must pass first
python ml/tea/train.py         --csd <d> --img-size 160 --samples-per-group 1 --epochs 14
python ml/tea/evaluate.py      --csd <d> --ewu <d> --tld <d>
python ml/tea/export.py
```

---

## What is in this repository

This tree is deliberately the code needed to **build and run the site**, plus the
ML pipeline (`ml/`) and the evidence record (`models/`) that `/models` is built
from. The project's narrative documents — the decision log, the dataset audit
write-up, the deployment runbook, the device-test checklist — and the unit-test
suite are kept with the working copy rather than published here.

That means `npm test` will not run from a fresh clone of this repository: the
`test/` directory is not part of the published tree. The suite is 289 cases
across 17 files and runs with no test framework at all, directly under Node's
`--experimental-strip-types`.

## Testing and checks

```bash
npm run typecheck
npm run build
```

Plus checks that unit tests structurally cannot make:

```bash
python ml/tea/smoke_infer.py     --csd <d> --tld <d>   # runs the PUBLISHED artifact
python ml/tea/check_ts_parity.py --csd <d>             # TypeScript vs Python preprocessing
python scripts/audit_release.py                        # card vs artifact vs docs
python scripts/translation_review.py --check           # translation table is current
```

`check_ts_parity.py` deserves a note: it runs the *actual TypeScript* preprocessing
over real JPEG bytes and pushes both tensors through the published ONNX. If the
browser and Python transforms ever diverged, no test would fail and no error would
be raised — the model would simply get quietly worse in the field than on the
bench, which is the hardest class of bug to notice.

---

## Limitations, stated plainly

- **In-browser inference has not been verified on a real device.** The published
  artifact loads and runs under Python, the preprocessing matches across
  languages, the decision logic is unit-tested and the assets serve — but the span
  from WebAssembly instantiation to `session.run` has never been observed on an
  actual phone. The checklist for closing that gap is in
  a 24-step device checklist kept with the project's working notes. The gate
  closes only when it has been walked on a real Android phone and a desktop
  browser.
- **The model is not a diagnosis.** It is a suggestion from an image, trained
  entirely on Assam imagery, and it can be confidently wrong on a farm unlike the
  ones it learned from. Every prediction is shown as a lead to confirm with a TRI
  extension officer, and the app never names a pesticide or a dose.
- **Blister blight and red rust have no external validation at all.** Neither
  appears in any cross-dataset test set in the audited corpus. Blister blight is
  simultaneously the most important class in the product and the least externally
  verifiable one.
- **No Sri Lankan tea imagery exists in any public dataset** we could find. The
  cross-dataset number *is* the measurement of that gap.
- **The soil probe has never been run against real hardware.** The software is
  complete — Web Serial, frame parsing, two-point calibration, storage — and the
  pure parts are unit-tested, but the ESP32 sketch has never been flashed and the
  serial path has never seen a board. The calibration it performs is a field one:
  air and water remove the probe's arbitrary scale, but a water content accurate
  for a specific soil needs oven-dried samples.
- **Sinhala and Tamil are unreviewed.** Labels, states, errors and names are
  translated; the advisory sentences stay English by policy, because a
  mistranslated treatment instruction is worse than an English one, and the app
  discloses that in the reader's own language. See `models/tea/TRANSLATION-REVIEW.md`.
- **No real farmer plot has been captured.** Any plot in a demonstration is
  self-traced and labelled as demonstration data.

---

## Implemented vs planned

**Implemented and tested:** the three lanes and every route in the table above; the
tea classifier end to end (audit → split → train → calibrate → abstain → export →
browser integration); the FAO-56 and disease-pressure engines; offline capture with
a per-device attestation hash chain; the price artifact; trilingual UI.

**Planned, not built:** a border-rejection-risk model on FDA import-refusal data;
a landed-cost and margin calculator for `/sell`. Each is recorded with its reasoning
in the project's working notes, along with the ideas deliberately *not* being
built and the reason for each.

---

## Repository map

```
app/            routes (Next.js App Router)
components/     UI, grouped by lane
lib/            pure logic — grow/, sensor/, intake/, compliance/, weather/, i18n/
hardware/       the ESP32 sketch for the soil node
ml/tea/         the classifier pipeline: audit, split, train, evaluate, export, verify
models/tea/     the evidence record: card, evaluation, taxonomy, provenance, audit
public/models/  the artifacts the running app consumes
scripts/        release audit, dataset audit, translation review
test/           unit tests, run directly by Node
supabase/       SQL migrations
```

Design decisions, with the reasoning and the rejected alternatives, are logged in
a dated decision log kept with the project's working notes, which records the
rejected alternatives as well as the chosen ones.
