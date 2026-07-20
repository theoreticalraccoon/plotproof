"""Per-pixel labels for a chip, from two independent sources warped onto the chip
grid: ESA WorldCover (10 m land cover, Planetary Computer) and Hansen Global Forest
Change (treecover2000 + lossyear, UMD public GeoTIFF granules). Keeping both lets
the QA grid show where they disagree — Hansen is 30 m, its "loss" includes legal
harvest and fire, and its timing is annual, so the labels are noisy by nature and
that should be visible, not hidden (ML.md).
"""
from __future__ import annotations

import math

import numpy as np
import planetary_computer as pc
from pystac_client import Client
from rasterio.warp import Resampling

import config
from imagery import Grid, _read_to_grid

# --- label classes (also the QA colour order) --------------------------------
NONFOREST, FOREST, LOSS, WATER, MANGROVE, CROP, BUILT = range(7)
CLASS_NAMES = ["non-forest", "forest", "forest loss", "water", "mangrove", "cropland", "built"]
CLASS_COLORS = [
    (0.85, 0.80, 0.65),  # non-forest  tan
    (0.00, 0.40, 0.00),  # forest      dark green
    (0.90, 0.10, 0.10),  # forest loss red
    (0.10, 0.30, 0.90),  # water       blue
    (0.00, 0.80, 0.80),  # mangrove    cyan
    (0.95, 0.80, 0.20),  # cropland    gold
    (0.90, 0.10, 0.90),  # built       magenta
]


def _client() -> Client:
    return Client.open(config.STAC_ENDPOINT, modifier=pc.sign_inplace)


def worldcover_href(bbox) -> str | None:
    """Signed href of the WorldCover `map` covering bbox, preferring the configured
    year (WorldCover items carry no single datetime, so we read the year from the id)."""
    items = list(_client().search(collections=["esa-worldcover"], bbox=bbox).items())
    if not items:
        return None
    items.sort(key=lambda it: 0 if str(config.WORLDCOVER_YEAR) in it.id else 1)
    return items[0].assets["map"].href


def hansen_url(lat: float, lon: float, layer: str) -> str:
    """URL of the 10x10-degree Hansen granule containing (lat, lon). Granules are
    named by their NORTH-WEST corner, e.g. '10N_080E'."""
    lat_tile = int(math.ceil(lat / 10.0) * 10)   # north edge of the tile
    lon_tile = int(math.floor(lon / 10.0) * 10)  # west edge of the tile
    ns = f"{abs(lat_tile):02d}{'N' if lat_tile >= 0 else 'S'}"
    ew = f"{abs(lon_tile):03d}{'E' if lon_tile >= 0 else 'W'}"
    v = config.HANSEN_VERSION
    return (
        f"https://storage.googleapis.com/earthenginepartners-hansen/"
        f"{v}/Hansen_{v}_{layer}_{ns}_{ew}.tif"
    )


def label_chip(grid: Grid, center_lonlat, wc_href: str):
    """Build the multiclass label for a chip. WorldCover (categorical → nearest),
    Hansen treecover2000 (continuous → bilinear), Hansen lossyear (categorical →
    nearest). Precedence is applied so the confident special covers (water, mangrove,
    built, cropland) and Hansen loss override the forest/non-forest base."""
    lon, lat = center_lonlat
    wc = _read_to_grid(wc_href, grid, Resampling.nearest).astype(np.int16)
    tc = _read_to_grid(hansen_url(lat, lon, "treecover2000"), grid, Resampling.bilinear)
    loss = _read_to_grid(hansen_url(lat, lon, "lossyear"), grid, Resampling.nearest).astype(np.int16)

    label = np.full((grid.height, grid.width), NONFOREST, np.uint8)
    # base forest: either source calls it tree — union is deliberate so plantation
    # (WorldCover tree, high Hansen canopy) lands as "forest", the whole point.
    forest = (tc >= config.CANOPY_THRESHOLD) | (wc == 10)
    label[forest] = FOREST
    label[wc == 40] = CROP
    label[wc == 50] = BUILT
    label[(wc == 80) | (wc == 90)] = WATER
    label[wc == 95] = MANGROVE
    label[loss > 0] = LOSS  # was forest in 2000, cleared since → overrides

    n = label.size
    stats = {
        "forest_fraction": round(float((label == FOREST).sum()) / n, 4),
        "loss_fraction": round(float((label == LOSS).sum()) / n, 4),
        "mangrove_fraction": round(float((label == MANGROVE).sum()) / n, 4),
        # source agreement on "is this pixel forest?" — a label-noise indicator
        "source_agreement": round(float(np.mean((tc >= config.CANOPY_THRESHOLD) == (wc == 10))), 4),
    }
    return label, stats
