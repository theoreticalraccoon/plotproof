# PlotProof

**Help a smallholder farmer in the Asia-Pacific grow an export crop well, price
it honestly, and get it legally into EU/UK/US markets — without a consultant.**

Submitted to YCS under Big Data / ML / AI / Data Science.

---

## The three jobs

The product is organised around what a farmer actually does across a season, not
around what was built first.

### 1. GROW — `/grow`
Weather, watering and disease pressure for one plot, computed from that plot's
own conditions.

- **Watering** — FAO-56 soil-water balance. Deterministic, citable, every
  constant traceable to a published table. Anchored to the best soil evidence
  available: a sensor if one exists, otherwise a satellite-informed soil model,
  otherwise the accumulated balance. The UI names which.
- **Disease pressure** — weather-driven infection risk for blister blight, brown
  blight and grey blight, with the specific conditions that produced the score.
  Infection *pressure*, never a diagnosis.
- **Leaf diagnosis** — a MobileNetV3-Small CNN running in the browser. Trained,
  evaluated, **not yet wired in**.

### 2. EARN — `/sell`
Four questions → HS code, a documents checklist, shipping options, and a world
reference price with its forecast error printed next to the naive baseline's.

### 3. PROVE — `/documents`, `/intake`, `/verify/<id>`
The documentation wall: which papers this shipment needs, generated where we
legitimately can (invoice, packing list, certificate-of-origin *draft*), plus
offline-first plot capture with attestation, and a public verification URL.

---

## Who it is for

A smallholder farmer, or the cooperative officer standing next to them with one
mid-range Android phone and intermittent signal. Trilingual, Sinhala first.
Offline-first is not a feature here; it is the operating condition.

## The rule the whole project runs on

**Never invent.** Not law, not agronomy, not a price, not a verdict.

Every requirement cites its source and says to verify with the issuing
authority. Every model ships its metric next to its baseline. Every number has a
provenance. Where something cannot be determined, the app says so — an honest
"we cannot tell you" is a usable answer; a confident wrong one is a liability.

`/whats-real` is the inventory of exactly what works and what does not, and it is
updated in the same commit as the feature it describes.

---

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind v4 · Supabase (auth + Postgres) ·
Dexie/IndexedDB for field capture · Leaflet · ONNX Runtime Web for in-browser
inference · Open-Meteo for weather.

**No ML server.** Every model is a static artifact in `public/models/` consumed
client-side. `app/api/` contains one route: `health`.

## Orientation

| File | What |
|---|---|
| `ML.md` | What the ML actually is, and the rules it follows |
| `DECISIONS.md` | Running log of decisions and the reasoning. Read this first after a gap |
| `PARKED.md` | Deliberately not being built, with the reason |
| `NEXT-STEPS.md` | What remains, including what only a human can do |
| `SCHEMA.md` | The data model, as applied |
| `DEPLOY.md` | How to deploy both halves |
| `ml/tea/README.md` | The classifier: pipeline, results, and what went wrong |
| `models/tea/dataset-audit.md` | What is wrong with each public tea dataset |

---

## History

This started as an EUDR deforestation-evidence tool for cooperatives, pivoted
(D-014) to farmer-first direct export, and then had ML made its spine rather than
a notebook bolted to the side. Two things were deleted along the way for the same
reason — they could not be done honestly by one developer — and both are recorded
in `PARKED.md` rather than quietly dropped: an in-house satellite model and an
acoustic chainsaw classifier.

The EUDR work survives as one row in the documents checklist, backed by cited
public datasets rather than a verdict we invented. That is the right size for it.
