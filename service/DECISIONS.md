# DECISIONS.md — Sentinel-2 access service (ML half)

Decision log for the imagery/model service, separate from the web app's
DECISIONS.md at the repo root. Newest at the bottom. Read this first after a gap.

Scope so far: **Step 1 of ML.md's order of work** — STAC query, download, cache,
cloud mask, one plot, one country, verified visually. Nothing is built on top of
the rendered series yet.

---

## S-001 — Imagery source: Microsoft Planetary Computer (swappable)
Chosen for Step 1 because it needs no account and signs asset URLs anonymously —
fastest path to a rendered series and to iterate/cache against. MPC has had recent
access-policy churn (ML.md flags this), so the source is isolated in `stac.py`
behind a `Scene` interface; moving to Copernicus Data Space later is a change to
that one file. Confirmed with the user.

## S-002 — Python 3.13 venv (not 3.12, not 3.14)
The user picked "new 3.12 venv", but 3.12 isn't installed on this machine (only
3.14 default and 3.13). 3.14 is too new for geospatial binary wheels; 3.13 is
present and installed the whole stack **wheels-only, no source builds**
(rasterio 1.5.0 / GDAL 3.12.1, numpy 2.5.1, pyproj 3.7.2, matplotlib 3.11.1). 3.13
satisfies the actual intent (a boring, wheel-reliable env). Recorded as a
deviation from the literal choice.

## S-003 — Test AOI is public, not a farmer's plot
`config.PLOT_GEOMETRY` is a ~500 m box near Ratnapura, Sri Lanka, used only to
validate the pipeline. No farmer coordinates are fabricated (the standing rule).
Swapping in a real WGS84 polygon is a one-field edit; nothing else changes.

## S-004 — One fixed grid per run, warp every scene onto it
The output grid is built once, in a single reference CRS (the first scene's
`proj:epsg`), and each scene is warped onto it with a `WarpedVRT`. This keeps all
dates pixel-aligned so before/after chips are directly comparable, and it
transparently handles scenes that arrive in different UTM zones/MGRS tiles. Reads
are windowed — only the plot's footprint is fetched, not the whole COG.

## S-005 — SCL masking + make the mask visible
Cloud/shadow removal uses the L2A Scene Classification Layer. Dropped classes:
0,1 (nodata/defective), 2 (dark/topographic shadow), 3 (cloud shadow), 8,9 (cloud
med/high), 10 (thin cirrus), 11 (snow). Kept: 4,5,6,7. The renderer tints removed
pixels **magenta** so the masking can be confirmed by eye — that visual check is
the entire deliverable of this step. Per-plot valid-fraction (not the scene-level
`eo:cloud_cover`) decides whether a date is usable; scene cloud % is only a
prefilter, since a scene can be 40% cloudy overall but clear right over the plot.

## S-006 — L2A radiometric offset across processing baseline 04.00
Scenes from 2022-01-25 (baseline ≥ 04.00) carry a BOA_ADD_OFFSET of −1000, so
reflectance = (DN − 1000)/10000; earlier scenes have no offset. The observation
window spans that change, so `to_reflectance()` applies it per-scene from
`s2:processing_baseline`. Skipping it would step NDVI across the cutoff for a
non-physical reason — exactly the kind of silent error to avoid on a legal series.

## S-007 — Aggressive content-addressed cache; warm run = zero network
Every downloaded band is clipped to the grid and saved as `.npy` keyed by
(item, band, grid-hash); the STAC search result is cached too. Reads check disk
first; a fully warm run makes no network calls. This directly serves the brief's
"never download the same pixels twice", the biggest time-sink in the three weeks.

## S-008 — Step-1 band set only
Pulling B04/B03/B02/B08 (10 m) + SCL (20 m) — enough for true-colour + NDVI +
masking. SWIR B11/B12 (for NDMI and the model) are deferred; the read/cache path
already resamples 20 m → 10 m, so adding them is a one-line `config.BANDS` change.

---

## S-009 — Sentinel-1: use the RTC product, don't hand-roll terrain correction
The overrun risk in this step is terrain correction. Rather than run Range-Doppler
correction on raw GRD (needs ESA SNAP, a DEM, orbit files — multi-day, error-prone
for a solo build), we use Planetary Computer's **`sentinel-1-rtc`**: gamma-0 that is
**already radiometrically terrain corrected**, gridded in UTM at 10 m. Confirmed
readable anonymously here (once the vsicurl extension filter was widened from `.tif`
to also allow `.tiff` — S1 RTC assets are `iw-vv.rtc.tiff`; that one line silently
blocked all radar reads).

- **"Terrain correction" therefore means the RTC product's, not our own** — the
  honest framing to give a judge, and the finishable/defensible choice ML.md's
  "finish, validate, explain" mandate asks for. If a reviewer needs bespoke RTC
  later, that's a SNAP/pyroSAR pipeline and a separate budget.
- **Same grid as optical, so co-registration is by construction.** S1 RTC is warped
  onto the identical grid built from the optical reference CRS (EPSG:32644, 10 m)
  via the shared `WarpedVRT` path. Radar and optical share pixels exactly.
- **Speckle:** Lee filter (7×7) in **linear power** (`radar.lee_filter`), then dB for
  display only. Nodata (-32768) and any non-physical ≤ 0 (incl. bilinear-blended
  edges) → NaN before filtering.
- **Orbit:** each optical date is paired with the nearest S1 date; all three pairs
  landed on the **descending** orbit (2–4 day gaps). Keep orbit direction consistent
  when the model consumes the full S1 series — ascending/descending differ in geometry.
- **Alignment verified visually** (`run_radar_alignment.py` → `_s1_alignment.png`):
  optical RGB | radar VV dB | optical edges (red) drawn on the radar.
  - First over the forest plot: persistent bright bare/built patches co-register,
    no systematic offset — but homogeneous forest gives radar few sharp edges, so
    it was decent evidence, not decisive.
  - **Hardened over a water AOI** (Udawalawe reservoir, `config.ALIGNMENT_AOI`): the
    reservoir's intricate **dendritic shoreline** is razor-sharp in radar (water is
    dark/specular) and the red optical shoreline edges trace it exactly, across
    three dates — a shape that complex only matches when registration is right to
    ~1 px (10 m). **Decisive: no misregistration.** Residual slivers are real
    dry-season water-level change between the 3–6-day-apart optical/radar dates,
    not a geometric offset.
  - `run_radar_alignment.py` defaults to the water AOI; `--plot` runs the farmer plot.

Only a handful of S1 dates were pulled (enough for the alignment figure); the full
S1 series over the window is downloaded the same way when the model needs it.

---

## S-010 — Labelled training set: curated stratified sampling + Hansen/WorldCover labels
The ideal ("sample globally, stratified by ecoregion") needs a global ecoregion
polygon layer + a global plantation raster + balanced volumes — multi-day, and the
plantation piece has no clean global raster. Built the finishable version instead,
with the simplifications stated plainly:

- **Curated, globally-distributed regions** (`regions.py`), each tagged with its
  stratum (tropical_moist / dry_deciduous / mangrove / montane / plantation) and a
  train/val split — Amazon, Congo, Borneo, Sumatra, Malaysia, India, Sri Lanka,
  Sundarbans, Niger Delta, Andes, Ethiopia, Thailand. Chips are sampled at seeded
  random centres inside each region. **Honest difference from the brief:** stratum
  comes from a curated region, not a draw over an ecoregion raster.
- **Plantation oversampled** (`CHIPS_PER_REGION`): 5 plantation regions at 2 chips
  each vs 1 for others.
- **THE plantation caveat (most important).** WorldCover and Hansen both label mature
  rubber/oil-palm as tree cover / forest — the exact confusion the model must later
  break. So a plantation chip's pixels label as **forest**, and its "plantation"
  identity is the **region tag only**, not a per-pixel plantation mask. A true
  per-pixel plantation label needs an extra dataset (e.g. Descals global oil-palm) —
  flagged as the next add. Until then, plantation is a *stratum for sampling/eval*,
  not a pixel label.
- **Labels** (`labels.py`): ESA WorldCover 10 m (MPC) + Hansen treecover2000 +
  lossyear (UMD `/vsicurl` granules), warped onto each chip's UTM grid. Multiclass
  raster: non-forest / forest / loss / water / mangrove / cropland / built. Forest =
  Hansen tc2000 ≥ 30% OR WorldCover tree; Hansen loss overrides. Both sources kept
  and a `source_agreement` stat recorded, because Hansen is 30 m, its "loss" includes
  legal harvest/fire, and its timing is annual — the label noise ML.md warns about
  should be visible, not hidden.
- **Region hold-out for validation** — one whole region per stratum is `split:"val"`
  (incl. a plantation region, Kalimantan). No chip from a val region is in train;
  never a random-chip split (adjacent pixels are near-identical and would flatter the
  score). Enforced by construction: the split is a region attribute.
- **Chips saved** under `chips/<split>/<stratum>/<id>/` as `bands.npy` (S2
  reflectance), `label.npy`, `meta.json`. **Scope note:** bands are the 4 in
  `config.BANDS` (RGB+NIR) for now; SWIR B11/B12 (model input) are a one-line add to
  `BANDS` when training starts. Volume is modest and scales via `CHIPS_PER_REGION`.
- **QA grid** (`run_build_chips.py` → `output/chips_qa_grid.png`): S2 true colour over
  its label per chip, for eyeballing before any training.

---

## S-011 — The model + training pipeline (Step 4)

Built the training pipeline to ML.md's spec; deliberately boring so it's defensible.

- **Model** (`model.py`): `segmentation-models-pytorch` U-Net, **ResNet-34 encoder,
  ImageNet weights**, `in_channels=10`, `classes=1` (forest logit). One sentence for a
  judge: "a U-Net with an ImageNet-pretrained ResNet-34 encoder that outputs, per
  10 m pixel, the probability it was forest." No attention/fusion tricks. smp adapts
  the 3-channel pretrained stem to 10 channels — the "pretrained where the channel
  count allows" compromise.
- **10 channels** (`dataset.py`): B02 B03 B04 B08 B11 B12, NDVI, NDMI, VV, VH.
  Target = per-pixel forest (FOREST ∪ MANGROVE, since EUDR counts mangrove as forest).
- **Modality dropout**: blanks the whole optical OR whole radar group at random in
  training, so the net degrades gracefully when a date has one sensor; the same check
  (`sensors_present`) records provenance at inference. Training prints the
  fused / optical-only / radar-only IoU as the honest degradation report.
- **Region-held-out validation**: `split_by_region` uses the split baked into each
  chip's meta — whole regions, never a random chip split.
- **Loss** BCE + soft Dice, Adam, AMP on CUDA. **Runs on a single GPU / free Colab**
  (T4 fits ResNet-34 @ 256²). NOT trainable in this sandbox (no GPU); `--smoke` proves
  the plumbing on CPU with synthetic data. `TRAIN.md` has the Colab steps.

**Honest training-readiness — the QA gate did its job and it is NOT ready to fit yet:**
1. **Chips are 4-channel, not 10.** The builder saves RGB+NIR; it must also save the
   two SWIR bands and `radar.npy` (S1 VV/VH, already co-registered by Step 2) before
   the dataset can feed the model.
2. **Cloud leakage + label noise (seen in `chips_qa_grid.png`).** Amazon/Borneo chips
   are hazy but passed (thin cloud SCL misses); dry-zone Sri Lanka is 87% "forest" at
   only **13% Hansen/WorldCover agreement**. Two regions (Cerrado, Andes) yielded 0
   chips (cloud retries exhausted). Fix: tighten the cloud gate, and require source
   agreement (or a higher dry-biome canopy threshold) before scaling.
3. **Volume.** 19 chips is a plumbing sample, not a training set — scale via
   `CHIPS_PER_REGION` + more regions.
4. **Plantation is a sampling stratum, not a pixel label** — the QA grid shows Malaysia
   oil palm labelled "forest". Breaking that confusion needs a per-pixel plantation
   dataset (e.g. Descals oil-palm), still outstanding.

---

## S-012 — Forest-fraction series + change detection (Step 5), outside the network

Built the verdict logic as plain, testable Python (`changedetect.py`, `profiles.py`)
— deliberately NOT in the model, because this is the part an auditor questions and it
must be readable, not buried in weights. It needs only the numeric series, so it is
fully tested without any trained model.

- **The model plugs in at one point:** `forest_fraction(prob_map, plot_mask, valid_mask,
  profile)` reduces a per-pixel forest-probability map to (forest_fraction,
  valid_fraction) per date, applying the country's per-pixel threshold. Everything
  after that is model-agnostic arithmetic. Until the U-Net is trained this reduction
  is inert; the decision logic below is complete and verified now.
- **Country profile drives the forest definition** (`profiles.py`) — canopy cover,
  min mapping unit, min tree height, cutoff, plus detection knobs — as immutable
  CONFIG, never global constants. Values are marked **VERIFY against the national
  definition** (the app never invents law). `min_tree_height_m` is recorded for the
  PDF but **not enforceable from S2/S1** — stated plainly rather than faked.
- **`detect_change`:** robust "forested" baseline (median of the upper half of the
  record); a date is "cleared" if it drops `forest_fraction_drop` below baseline; a
  flag requires **persistence** — `persistence_obs` consecutive confirming observations
  — so one hazy scene can't trigger a false positive. **Clearing window** = last
  still-forested date → first cleared date. **Cleared area** is filtered by the min
  mapping unit. **Cutoff:** clearing before the country's cutoff is not a violation
  (returns clear). Confidence is a transparent documented formula, not a model score.
- **`insufficient_data` (honest non-answers):** plot below ~0.2 ha (edge of 10 m
  resolution); too few usable observations; or a cloud gap larger than
  `max_bridge_gap_days` **even counting radar** — S1 observations are cloud-free and
  count as usable, so they bridge optical gaps just by being present; if a gap still
  exceeds the limit, we say so rather than guess.
- **Tested:** `test_changedetect.py`, 8 cases — stable→clear, sustained-drop→flagged
  (with window+area), single-dip→clear (persistence), drop-below-MMU→clear,
  <0.2 ha→insufficient, big-gap→insufficient, radar-bridged→proceeds,
  pre-cutoff→clear. All pass.

Also: Step 4's training pipeline **smoke-passed** on CPU once torch installed (loop,
per-stratum + per-modality metrics, checkpoint all run) — it's verified to run; the
real fit is still a Colab/GPU job on 10-channel chips.

---

## S-013 — Evaluation harness (Step 7) + honest weakness assessment

Built the reporting harness (`eval.py`, tested `test_eval.py` 6 cases). It breaks out
precision/recall/F1 **per country, per forest type, and per country x forest type**,
plus **plot-size buckets**, **fused vs optical-only**, and a **plantation-vs-natural**
indicator — never a single global number. Every row shows **support** and flags
**LOW SUPPORT** cells so thin/empty cells read as gaps, not as trustworthy scores.

**Hard honesty (the whole point of this step):** there is **no trained model**, so
the harness has **no real predictions to score** — any performance table right now
would be fabricated. `eval.py demo()` runs it on **clearly-labelled SYNTHETIC**
predictions ONLY to show the output shape; those numbers are random placeholders.
Real numbers come only from a trained model's predictions on the held-out regions.

**Evaluating "against Hansen" has a built-in ceiling** (recorded so no one over-reads
the eventual table): Hansen is 30 m and we predict at 10 m; its "loss" includes legal
harvest and fire; its timing is annual. So model/Hansen disagreement is not
necessarily model error — it is "vs Hansen", not "vs ground truth" (ML.md).

**Where the model will be weak — from evidence I actually have, not invented metrics:**
1. **Plantation vs natural forest — the load-bearing weakness.** The QA grid showed
   oil palm labelling as "forest" at 95–100% source agreement. The training labels
   themselves cannot separate plantation from natural forest, so a model fit on them
   will call mature rubber/oil-palm "forest" — exactly what EUDR targets. No metric
   will fix this; a per-pixel plantation dataset (e.g. Descals oil-palm) is required.
2. **Dry deciduous** — QA showed 13% Hansen/WorldCover agreement in the dry zone.
   Label noise is worst here, so both the labels and any dry-forest score are the
   least trustworthy; the model will be weakest and the eval cell should be read with
   suspicion, not confidence.
3. **Persistently cloudy tropics** — thin cloud leaks past SCL (seen in the Amazon/
   Borneo chips), so optical degrades and the model leans on radar, which is less
   discriminating for canopy; expect fused >> optical-only recall there.
4. **Small plots (<0.2 ha)** — at the edge of 10 m resolution; handled by
   `insufficient_data`, but per-pixel accuracy near small-plot boundaries is weakest.
5. **Thin/absent validation** — only a handful of held-out regions, and some strata
   have 0–1 val chips (dry_deciduous val=0, montane val=1). The real eval table will
   have empty and low-support cells — an honest uneven table, by construction.
6. **Curated, not random-global sampling** — generalisation to unsampled ecoregions
   is unproven; the per-country rows only cover sampled countries.

---

## S-014 — Before/after tiles (Step 6) + HTTP service, stub replaced (Step 8)

- **Before/after tiles** (`render.before_after_tile`): full-bleed true colour, plot
  outlined in yellow, acquisition date / role / sensor / cloud burned in, and — the
  point — BOTH tiles use the same fixed reflectance stretch (`_REFL_SCALE`) so a reader
  can actually compare them (auto-scaling each to itself would fake a change). Verified
  by eye on the Ratnapura plot (before 2021-11-21 / after 2022-04-30).
- **HTTP service** (`server.py`, stdlib only — no framework, "resist cleverness"): the
  queued-job contract the web app already speaks. `POST /jobs` → JobHandle;
  `GET /jobs/<id>` → JobPoll (queued/running/succeeded/failed); `GET /tiles/<job>/<role>.png`
  serves the rendered tiles; a background worker runs the analysis. Queued because a
  real analysis downloads scenes (minutes).
- **`analyze.py`** runs the real pipeline (cache-first S2 search → grid → per-date
  forest fraction → `detect_change` → before/after tiles) and returns the exact
  camelCase `AnalysisResult`. **The one placeholder is the per-pixel forest classifier:
  a documented NDVI proxy (`forest_prob_proxy`), and `modelVersion="ndvi-proxy-0.1"`
  says so.** Everything else in the payload is real. When the U-Net trains, only that
  function + the version string change.
- **Stub replaced by env, not code** (`lib/analysis/index.ts` already switches on it):
  set `ANALYSIS_SERVICE_URL` + `ANALYSIS_STUB=0`. `.env.example` updated to match.
- **Verified live end to end:** submit → queued → succeeded. On the full 2-year window
  the service honestly returns **insufficient_data** — a >45-day monsoon cloud gap the
  optical-only proxy can't bridge, exactly the documented condition. On a dense
  dry-season window it returns **clear** (confidence 0.85) with two tiles rendered and
  served over HTTP. Both are correct, honest outcomes — proxy forest fraction is
  0.93–0.99 on clear dates, so the pipeline is sound.

---

## Where I left off / next concrete step
Steps 1–8 now all have working, verified code. Steps 6 (before/after tiles) and 8
(HTTP service; stub replaced by the `ANALYSIS_SERVICE_URL`/`ANALYSIS_STUB=0` env
switch) done this session. **The one remaining real gap is the trained model** — the
service fills the classifier slot with an honest NDVI proxy (`modelVersion` says so).
**Next concrete step (unblocks everything real):** extend the chip builder to 10
channels + fix the cloud/label gate + scale the set, then train the U-Net on Colab.
That single step swaps the proxy for the real classifier AND produces the real eval
table (`eval.py` on the held-out regions). Smaller follow-up: add S1 radar
observations into `analyze.py`'s series to bridge cloud gaps (fewer `insufficient_data`
over cloudy plots). Pending the user's go.
