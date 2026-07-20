"""Configuration for the Sentinel-2 access service — Step 1 (imagery + cloud/
shadow masking + cached, rendered time series). Only the knobs a returning
developer actually touches live here; downstream modules import from this file so
there are no magic constants buried elsewhere.
"""
from __future__ import annotations

from pathlib import Path

# --- paths -------------------------------------------------------------------
SERVICE_DIR = Path(__file__).resolve().parent
CACHE_DIR = SERVICE_DIR / ".cache"      # every downloaded pixel lands here, once
OUTPUT_DIR = SERVICE_DIR / "output"     # rendered contact sheets

# --- STAC source (swappable) -------------------------------------------------
# Planetary Computer today (anonymous, we sign asset URLs). Copernicus Data Space
# later is a change to stac.py only — nothing else knows the source.
STAC_ENDPOINT = "https://planetarycomputer.microsoft.com/api/stac/v1"
COLLECTION = "sentinel-2-l2a"

# --- the test plot -----------------------------------------------------------
# PUBLIC test AOI near Ratnapura, Sri Lanka. This is NOT a farmer's plot: it is a
# demonstration polygon used only to validate the pipeline end to end. To run on a
# real plot, replace PLOT_GEOMETRY with a real WGS84 polygon (and PLOT_ID /
# PLOT_COUNTRY) — nothing else in the service changes. Coordinates are [lon, lat]
# (WGS84 / EPSG:4326); the ring is closed (first point repeated last).
PLOT_ID = "TEST-RATNAPURA-01"
PLOT_COUNTRY = "LK"
PLOT_GEOMETRY = {
    "type": "Polygon",
    "coordinates": [[
        [80.3855, 6.6915],
        [80.3905, 6.6915],
        [80.3905, 6.6960],
        [80.3855, 6.6960],
        [80.3855, 6.6915],
    ]],
}

# --- observation window ------------------------------------------------------
# Spans the EUDR assessment cutoff (2020-12-31) so the series shows before/after.
DATE_RANGE = "2020-06-01/2022-06-30"
SCENE_CLOUD_LT = 60      # scene-level prefilter; real quality is judged per-plot below

# --- bands -------------------------------------------------------------------
# Step 1 needs true colour + NIR (for NDVI) at 10 m, plus SCL (20 m) for masking.
# The SWIR bands B11/B12 (20 m, for NDMI and the model) are intentionally NOT
# pulled yet — add them to BANDS when the model step needs them; the read/cache
# path already handles the 20 m -> 10 m resample.
BANDS = ["B04", "B03", "B02", "B08"]   # red, green, blue, nir
SCL_BAND = "SCL"

# --- masking (Sentinel-2 Scene Classification Layer) -------------------------
# Drop these SCL classes as unusable:
#   0 no-data, 1 saturated/defective, 2 dark-area/topographic shadow,
#   3 cloud shadow, 8 cloud medium prob, 9 cloud high prob, 10 thin cirrus,
#   11 snow/ice. Kept valid: 4 vegetation, 5 not-vegetated, 6 water, 7 unclassified.
SCL_INVALID = {0, 1, 2, 3, 8, 9, 10, 11}

# --- grid + quality ----------------------------------------------------------
GRID_RES_M = 10.0        # output pixel size (metres); B11/B12/SCL resampled to this
AOI_BUFFER_M = 60.0      # margin around the plot so it isn't rendered edge-to-edge
MIN_VALID_FRACTION = 0.35  # below this valid-pixel fraction over the plot, the date
                           # is treated as too cloudy to use (flagged, not silently kept)
CONTACT_SHEET_MAX = 12     # thumbnails on the contact sheet (monthly-best selection)

# --- Sentinel-1 (radar) ------------------------------------------------------
# We use the Planetary Computer sentinel-1-rtc product (already terrain corrected,
# UTM, 10 m) and warp it onto the same grid as the optical stack.
SPECKLE_WINDOW = 7         # Lee speckle-filter window (pixels)
N_ALIGN_PAIRS = 3          # optical/radar date pairs on the alignment figure

# --- alignment-check AOI (Step 2 verification over a crisp shared feature) ----
# A separate AOI over open water (Udawalawe reservoir, southern Sri Lanka). Water
# is very dark in radar (specular reflection away from the sensor) and dark in
# optical — an unambiguous edge in BOTH modalities, so any misregistration is
# obvious. This is a public geographic feature, not a farmer's plot. Deliberately
# a few km across so the shoreline is comfortably in frame.
ALIGNMENT_ID = "ALIGN-UDAWALAWE"
ALIGNMENT_AOI = {
    "type": "Polygon",
    "coordinates": [[
        [80.780, 6.420],
        [80.830, 6.420],
        [80.830, 6.470],
        [80.780, 6.470],
        [80.780, 6.420],
    ]],
}
ALIGN_DATE_RANGE = "2021-01-01/2021-04-30"  # dry season → clear optical dates
ALIGN_CLOUD_LT = 30

# --- training-chip sampling (Step 3) -----------------------------------------
CHIPS_DIR = SERVICE_DIR / "chips"    # saved labelled chips (bands + label + meta)
CHIP_PX = 256                        # ML.md: 256 px @ 10 m = 2.56 km of context
CHIP_SAMPLE_SEED = 42                # deterministic sampling → stable cache hits
CHIP_S2_RANGE = "2021-01-01/2021-12-31"  # a year, so every region has a clear scene
CHIP_S2_CLOUD_LT = 40                # scene-level prefilter; per-chip cloud checked below
CHIP_MAX_CLOUD_FRACTION = 0.30       # reject a sampled chip cloudier than this
CHIP_CENTER_TRIES = 6                # resample up to this many centers to dodge cloud

# Per-region chip counts by stratum. Plantation is deliberately oversampled: rubber
# and oil palm reading as natural forest is the failure mode that would invalidate
# every verdict over Indonesian and Sri Lankan smallholdings. Crank these to scale
# the set — the only cost is (cached) download time.
CHIPS_PER_REGION = {
    "tropical_moist": 1,
    "dry_deciduous": 1,
    "mangrove": 1,
    "montane": 1,
    "plantation": 2,
}

# Label sources
CANOPY_THRESHOLD = 30                # Hansen treecover2000 %% counted as forest (baseline)
WORLDCOVER_YEAR = 2021
HANSEN_VERSION = "GFC-2023-v1.11"

