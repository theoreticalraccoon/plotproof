"""Sentinel-1 onto the same grid as the optical stack.

Terrain correction is NOT done here: we use the Planetary Computer
`sentinel-1-rtc` product, which is already radiometrically terrain-corrected
(gamma-0) and gridded in UTM at 10 m using a DEM. We warp it onto the identical
optical grid, so radar and optical are co-registered by construction. What this
module does add is the honest per-pixel processing the RTC product leaves to us:
nodata cleaning, a Lee speckle filter (in linear power), and dB conversion.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from numpy.lib.stride_tricks import sliding_window_view
from rasterio.warp import Resampling

import config
from cache import Cache
from imagery import Grid, _read_to_grid
from stac import S1Scene

S1_NODATA = -32768.0  # RTC nodata; also guards any non-physical (<= 0) linear power


def load_s1_arrays(scene: S1Scene, grid: Grid, cache: Cache) -> dict[str, np.ndarray]:
    """{vv, vh} warped onto the optical grid, cache-first (a warm run does no I/O).
    Shares the optical read path, so radar and optical are the same grid exactly."""
    out: dict[str, np.ndarray] = {}
    for asset in ("vv", "vh"):
        path = cache.array_path(scene.item_id, asset, grid.key)
        arr = cache.load_array(path)
        if arr is None:
            href = scene.assets.get(asset)
            if href is None:
                raise RuntimeError(
                    f"{scene.item_id}: asset {asset} not cached and no signed href "
                    f"(a live search is needed to refresh it)."
                )
            arr = _read_to_grid(href, grid, Resampling.bilinear)
            cache.save_array(path, arr)
        out[asset] = arr
    return out


def _clean(linear: np.ndarray) -> np.ndarray:
    """RTC gamma-0 is linear power (small positives). Mark nodata and any
    non-physical <= 0 (including bilinear-blended edges) as NaN."""
    x = linear.astype(np.float32).copy()
    x[~np.isfinite(x)] = np.nan
    x[x <= 0] = np.nan
    return x


def lee_filter(linear: np.ndarray, size: int = config.SPECKLE_WINDOW) -> np.ndarray:
    """Classic Lee speckle filter on linear power. SAR speckle is multiplicative,
    so we adapt to local statistics: keep detail where local variance is high
    (edges), smooth where it's low (homogeneous forest). Done in linear, not dB.
    """
    valid = np.isfinite(linear)
    fill = float(np.nanmean(linear)) if valid.any() else 0.0
    x = np.where(valid, linear, fill).astype(np.float32)

    pad = size // 2
    p = np.pad(x, pad, mode="reflect")
    win = sliding_window_view(p, (size, size))      # (H, W, size, size)
    local_mean = win.mean(axis=(-1, -2))
    local_var = win.var(axis=(-1, -2))
    noise_var = float(np.mean(local_var))           # scene noise estimate
    weight = local_var / (local_var + noise_var + 1e-12)

    out = local_mean + weight * (x - local_mean)
    out[~valid] = np.nan                             # preserve nodata as NaN
    return out


def to_db(linear: np.ndarray) -> np.ndarray:
    with np.errstate(divide="ignore", invalid="ignore"):
        return 10.0 * np.log10(linear)


@dataclass
class S1Observation:
    scene: S1Scene
    vv_db: np.ndarray
    vh_db: np.ndarray
    valid: np.ndarray  # bool grid, True where radar has usable data


def observe_s1(scene: S1Scene, arrays: dict[str, np.ndarray], grid: Grid) -> S1Observation:
    vv = lee_filter(_clean(arrays["vv"]))
    vh = lee_filter(_clean(arrays["vh"]))
    valid = np.isfinite(vv)
    return S1Observation(scene=scene, vv_db=to_db(vv), vh_db=to_db(vh), valid=valid)
