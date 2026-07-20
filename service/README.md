# Sentinel-2 access service — Step 1

The imagery half of the project (ML.md). **This is Step 1 only**: STAC search →
windowed download → aggressive cache → cloud/shadow mask from SCL → a rendered
time series you can look at. No model, no change-detection logic yet — those get
built on top *after* the rendered series is confirmed correct by eye.

## Setup

Python **3.13** (3.12 was the request but isn't installed here; 3.13 is present and
has mature geospatial wheels — avoid 3.14, which doesn't yet). No system GDAL is
needed; `rasterio` bundles it.

```bash
cd service
py -3.13 -m venv .venv                     # Windows (py launcher)
./.venv/Scripts/python.exe -m pip install -r requirements.txt --only-binary=:all:
```

## Run

```bash
./.venv/Scripts/python.exe run_timeseries.py     # Windows
# .venv/bin/python run_timeseries.py             # Linux/macOS
```

Outputs `output/TEST-RATNAPURA-01_timeseries.png`:

- one masked true-colour chip per date (best-per-month), plot outlined in yellow,
  acquisition date + cloud/valid % on each, **all chips on the same fixed scale**;
- **magenta = pixels SCL flagged as cloud/shadow and we removed** — this is the
  masking made visible, so you can confirm it by looking;
- an NDVI-over-plot trace beneath, with the EUDR cutoff (2020-12-31) marked.

It also prints a per-date table (scene cloud %, valid-over-plot %, mean NDVI, usable).

## Caching (the important part)

Everything downloaded is clipped to the plot grid and written under `.cache/`,
keyed by content:

- `.cache/stac/*.json` — the STAC search result (so re-runs don't re-query);
- `.cache/scenes/<item-id>/<band>_<gridhash>.npy` — each clipped, resampled band.

Reads hit disk first. **A second run touches the network zero times.** To force a
refetch, delete `.cache/`. Changing the plot AOI or reference CRS changes the
grid hash, so old and new arrays never collide.

## Sentinel-1 radar alignment (Step 2)

```bash
./.venv/Scripts/python.exe run_radar_alignment.py            # water AOI (default)
./.venv/Scripts/python.exe run_radar_alignment.py --plot     # the farmer test plot
```

Self-contained (fetches its own few clear optical dates — no prior run needed).
Writes `output/<aoi>_s1_alignment.png`: for a few clear optical dates paired with
the nearest Sentinel-1 date, three panels each — optical true colour, radar VV in
dB, and the radar with optical edges drawn on top in red. If aligned, the red edges
sit on the matching radar features.

The **default AOI is a reservoir** (Udawalawe): its dendritic shoreline is a
razor-sharp edge in both radar and optical, so any misregistration is obvious. That
check passed decisively (see `DECISIONS.md` S-009).

Radar comes from the **`sentinel-1-rtc`** product (already terrain corrected, UTM,
10 m); we warp it onto the *same* grid as the optical, apply a Lee speckle filter in
linear power, and convert to dB. We do **not** run our own Range-Doppler terrain
correction — see `DECISIONS.md` S-009 for why.

## Labelled training set (Step 3)

```bash
./.venv/Scripts/python.exe run_build_chips.py
```

Samples chips across curated, globally-distributed regions (`regions.py`), each
tagged with an ecoregion stratum and a train/val split, labels every chip from
**ESA WorldCover** + **Hansen GFC**, saves them under
`chips/<split>/<stratum>/<id>/` (`bands.npy`, `label.npy`, `meta.json`), and writes
a QA grid to `output/chips_qa_grid.png` — S2 true colour over its label, to eyeball
before training. Scale the set by raising `config.CHIPS_PER_REGION`.

Two things to keep in mind (both in `DECISIONS.md` S-010):
- **Plantation is a sampling stratum, not a pixel label.** WorldCover and Hansen
  label mature rubber/oil-palm as *forest* — the very confusion the model must break.
  A plantation chip's identity is its region tag; a per-pixel plantation mask needs an
  extra dataset (e.g. Descals oil-palm) and is the next add.
- **Validation holds out whole regions**, never random chips (adjacent pixels are
  near-identical and would inflate the score).

## Change detection (Step 5) — outside the network

`changedetect.py` + `profiles.py` turn a per-plot forest-fraction time series into a
verdict (`clear` / `flagged` / `insufficient_data`), as plain readable Python — this
is the part an auditor questions, so it is arithmetic, not weights.

```bash
./.venv/Scripts/python.exe test_changedetect.py    # 8 tests, no GPU/model needed
```

- The **model plugs in at one function** — `forest_fraction()` reduces a per-pixel
  forest-probability map to one number per date, applying the country's forest
  definition. Everything after is model-agnostic.
- Flags only on a **sustained drop** (persistence across several observations, so one
  hazy scene can't false-positive), estimates the **clearing window**, filters by the
  **min mapping unit**, and respects the **cutoff** (pre-cutoff clearing isn't a
  violation).
- Returns **`insufficient_data`** for plots under ~0.2 ha and for cloud gaps too large
  to bridge with radar — honest non-answers, not confident guesses.
- Forest definitions in `profiles.py` are **placeholders marked VERIFY** against each
  country's official definition — the service never invents law.

## Evaluation (Step 7)

`eval.py` reports precision/recall/F1 **per country, per forest type, and per
country x forest type**, plus **plot-size buckets**, **fused vs optical-only**, and a
**plantation-vs-natural** indicator — never one global average, with `support` and a
`LOW SUPPORT` flag on every row so thin cells read as gaps.

```bash
./.venv/Scripts/python.exe test_eval.py    # 6 tests: metric math + grouping
./.venv/Scripts/python.exe eval.py         # SYNTHETIC demo — shows table shape ONLY
```

**It has no real numbers yet** — there is no trained model, so the demo runs on
labelled synthetic predictions purely to show the output shape. Real numbers come
from running it on a trained model's predictions over the held-out regions.
Remember: "vs Hansen" is not "vs ground truth" — Hansen is 30 m, its loss includes
legal harvest/fire, so disagreement is not automatically model error. See
`DECISIONS.md` S-013 for the honest per-weakness assessment.

## HTTP analysis service + before/after tiles (Steps 6 & 8)

```bash
./.venv/Scripts/python.exe server.py     # serves the queued-job contract on :8000
```

Implements the contract the web app already speaks (`lib/analysis/client.ts`):

- `POST /jobs` (body = AnalysisRequest) → `{jobId, plotId, status}`
- `GET /jobs/<jobId>` → JobPoll (`queued` | `running` | `succeeded` + result | `failed`)
- `GET /tiles/<jobId>/<role>.png` → the rendered **before/after** tile (true colour,
  plot outlined, date burned in, SAME stretch across the pair — for the PDF)

`analyze.py` runs the real pipeline (S2 search → grid → forest-fraction series →
`changedetect.detect_change` → tiles) and returns the exact `AnalysisResult`.

**One honest placeholder:** the per-pixel forest classifier is a documented **NDVI
proxy** (`forest_prob_proxy`), and `modelVersion` is `ndvi-proxy-0.1` — NOT the trained
U-Net. Everything else in the payload is real. Training the U-Net swaps only that
function + the version string.

**Point the web app at it:** in `.env.local`, set `ANALYSIS_SERVICE_URL=http://localhost:8000`
and `ANALYSIS_STUB=0`. No web-app code changes — `getAnalysisClient()` switches on the env.

## Point it at a real plot

Edit `config.py`: replace `PLOT_GEOMETRY` with a real WGS84 polygon (and
`PLOT_ID` / `PLOT_COUNTRY`). The current AOI near Ratnapura, Sri Lanka is a
**public test polygon, not a farmer's plot** — used only to validate the pipeline.

## Swap the imagery source

`stac.py` is the only file that knows the source (Planetary Computer today). A
Copernicus Data Space backend is a change there alone; nothing downstream cares.

## Not in scope yet (deliberately)

SWIR bands B11/B12 (add to `config.BANDS`), a per-pixel **plantation** label
(needs an extra dataset — the key next add), the **full** Sentinel-1 time series
(only a few dates are pulled now, for the alignment check), the U-Net, change
detection, and the HTTP contract. See `DECISIONS.md` for the order of work.
