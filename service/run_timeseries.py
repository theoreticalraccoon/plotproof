"""End-to-end entry point for Step 1: one plot, one country, rendered so you can
look at it. Run from the service directory:

    ./.venv/Scripts/python.exe run_timeseries.py          (Windows)
    .venv/bin/python run_timeseries.py                    (Linux/macOS)

It searches Sentinel-2 L2A over the configured plot, reads only the plot window
from each scene, masks cloud/shadow from SCL, caches every downloaded array, and
writes a contact-sheet PNG plus an NDVI trace to ./output. A second run is served
entirely from ./ .cache and touches the network zero times.
"""
from __future__ import annotations

from collections import defaultdict

import numpy as np
import rasterio
from shapely.geometry import shape

import config
import render
import stac
from cache import Cache
from imagery import build_grid, load_scene_arrays, observe


def _bbox(geom: dict) -> list[float]:
    minx, miny, maxx, maxy = shape(geom).bounds
    return [minx, miny, maxx, maxy]


def _search_key(bbox) -> str:
    return "|".join([
        config.COLLECTION,
        config.DATE_RANGE,
        str(config.SCENE_CLOUD_LT),
        ",".join(str(round(c, 4)) for c in bbox),
        ",".join(config.BANDS + [config.SCL_BAND]),
    ])


def _resolve_ref_crs(scenes: list[stac.Scene]) -> str:
    """Reference CRS for the fixed grid: the first scene's proj:epsg, or read it
    from the first scene's B04 asset if the property is missing."""
    for s in scenes:
        if s.crs:
            return s.crs
    href = scenes[0].assets.get("B04")
    if not href:
        raise RuntimeError("cannot resolve a reference CRS (no proj:epsg, no B04 href)")
    with rasterio.open(href) as src:
        return str(src.crs)


def _all_arrays_cached(cache: Cache, scenes, grid_key: str) -> bool:
    for s in scenes:
        for asset in config.BANDS + [config.SCL_BAND]:
            if not cache.array_path(s.item_id, asset, grid_key).exists():
                return False
    return True


def main() -> None:
    config.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    cache = Cache(config.CACHE_DIR)
    bbox = _bbox(config.PLOT_GEOMETRY)

    # --- decide the scene set: warm cache (no network) vs live search ---
    search_path = cache.search_path(_search_key(bbox))
    meta = cache.load_json(search_path)
    scenes = None
    if meta:
        cached_scenes = [stac.Scene.from_meta(d) for d in meta["scenes"]]
        # We can rebuild the exact grid from the cached ref CRS to check the arrays.
        probe_grid = build_grid(config.PLOT_GEOMETRY, meta["ref_crs"])
        if _all_arrays_cached(cache, cached_scenes, probe_grid.key):
            print(f"warm cache: {len(cached_scenes)} scenes, no network needed")
            scenes = cached_scenes
            ref_crs = meta["ref_crs"]

    if scenes is None:
        print("searching Planetary Computer (Sentinel-2 L2A) ...")
        scenes = stac.search_scenes(bbox, config.DATE_RANGE, config.SCENE_CLOUD_LT)
        if not scenes:
            print("no scenes found for this AOI / date range / cloud filter.")
            return
        ref_crs = _resolve_ref_crs(scenes)
        cache.save_json(search_path, {"ref_crs": ref_crs, "scenes": [s.meta() for s in scenes]})
        print(f"found {len(scenes)} scenes; reference CRS {ref_crs}")

    grid = build_grid(config.PLOT_GEOMETRY, ref_crs)
    print(f"grid: {grid.width}x{grid.height} px @ {config.GRID_RES_M:.0f} m in {ref_crs}\n")

    # --- read (cache-first), mask, measure ---
    observations = []
    print(f"{'date':<12}{'scene cloud':>12}{'plot valid':>12}{'NDVI':>8}  use")
    for s in scenes:
        arrays = load_scene_arrays(s, grid, cache)
        obs = observe(s, arrays, grid)
        observations.append(obs)
        ndvi = "nan" if np.isnan(obs.ndvi_mean) else f"{obs.ndvi_mean:.2f}"
        print(f"{s.date:<12}{s.cloud_cover:>11.0f}%{obs.valid_fraction * 100:>11.0f}%"
              f"{ndvi:>8}  {'yes' if obs.usable else 'no'}")

    usable = [o for o in observations if o.usable]
    print(f"\n{len(usable)}/{len(observations)} dates usable "
          f"(>= {config.MIN_VALID_FRACTION * 100:.0f}% valid over the plot)")
    if not usable:
        print("nothing usable to render — try widening the date range or cloud filter.")
        return

    # --- contact sheet: best (least cloudy) usable scene per month, capped ---
    by_month = defaultdict(list)
    for o in usable:
        by_month[o.scene.date[:7]].append(o)
    sheet = [max(v, key=lambda o: o.valid_fraction) for v in by_month.values()]
    sheet.sort(key=lambda o: o.scene.datetime)
    if len(sheet) > config.CONTACT_SHEET_MAX:
        idx = sorted(set(np.linspace(0, len(sheet) - 1, config.CONTACT_SHEET_MAX).round().astype(int)))
        sheet = [sheet[i] for i in idx]

    out_path = config.OUTPUT_DIR / f"{config.PLOT_ID}_timeseries.png"
    render.contact_sheet(sheet, usable, grid, config.PLOT_ID, out_path)
    print(f"\nwrote {out_path}  ({len(sheet)} chips on the sheet)")


if __name__ == "__main__":
    main()
