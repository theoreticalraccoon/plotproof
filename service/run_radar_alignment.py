"""Step 2 verification: Sentinel-1 RTC warped onto the optical grid, compared to
Sentinel-2 in an alignment figure. Self-contained and AOI-driven — it fetches its
own handful of clear optical dates, so it needs no prior run_timeseries run.

    ./.venv/Scripts/python.exe run_radar_alignment.py            # water AOI (default)
    ./.venv/Scripts/python.exe run_radar_alignment.py --plot     # the farmer test plot

Writes output/<aoi>_s1_alignment.png. A warm run touches the network zero times.
By default it uses the reservoir AOI (config.ALIGNMENT_AOI) — a crisp water edge in
both radar and optical, so misregistration is obvious.
"""
from __future__ import annotations

import sys
from datetime import date

import numpy as np
from shapely.geometry import shape

import config
import render
import stac
from cache import Cache
from imagery import build_grid, load_scene_arrays, observe
from radar import load_s1_arrays, observe_s1


def _bbox(geom: dict) -> list[float]:
    minx, miny, maxx, maxy = shape(geom).bounds
    return [minx, miny, maxx, maxy]


def _bbox_key(bbox) -> str:
    return ",".join(str(round(c, 4)) for c in bbox)


def _pick_clear_optical(observations, k):
    """k clearest usable optical dates, spread across the time range."""
    usable = [o for o in observations if o.usable and o.valid_fraction >= 0.98]
    if len(usable) < k:
        usable = sorted((o for o in observations if o.usable),
                        key=lambda o: o.valid_fraction, reverse=True)[:k]
    usable.sort(key=lambda o: o.scene.datetime)
    if len(usable) <= k:
        return usable
    idx = np.linspace(0, len(usable) - 1, k).round().astype(int)
    return [usable[i] for i in sorted(set(idx))]


def _nearest_s1(opt_date: str, s1_scenes):
    d0 = date.fromisoformat(opt_date)
    return min(s1_scenes, key=lambda s: abs((date.fromisoformat(s.date) - d0).days))


def _get_optical(cache, bbox, date_range, cloud_lt, tag):
    """Optical scenes + reference CRS, search cached under an AOI-specific key."""
    path = cache.search_path(f"align-s2|{tag}|{date_range}|{cloud_lt}|{_bbox_key(bbox)}")
    meta = cache.load_json(path)
    if meta:
        return [stac.Scene.from_meta(d) for d in meta["scenes"]], meta["ref_crs"]
    print("searching Planetary Computer (Sentinel-2 L2A) for the alignment AOI ...")
    scenes = stac.search_scenes(bbox, date_range, cloud_lt)
    if not scenes:
        return [], None
    ref_crs = scenes[0].crs
    if not ref_crs:  # RTC-style missing proj:epsg — read it from the first asset
        import rasterio
        with rasterio.open(scenes[0].assets["B04"]) as src:
            ref_crs = str(src.crs)
    cache.save_json(path, {"ref_crs": ref_crs, "scenes": [s.meta() for s in scenes]})
    print(f"found {len(scenes)} optical scenes; reference CRS {ref_crs}")
    return scenes, ref_crs


def _get_s1(cache, bbox, date_range, tag):
    path = cache.search_path(f"align-s1|{tag}|{date_range}|{_bbox_key(bbox)}")
    meta = cache.load_json(path)
    if meta:
        return [stac.S1Scene.from_meta(d) for d in meta["scenes"]]
    print("searching Planetary Computer (sentinel-1-rtc) ...")
    scenes = stac.search_s1_rtc(bbox, date_range)
    cache.save_json(path, {"scenes": [s.meta() for s in scenes]})
    print(f"found {len(scenes)} S1 RTC scenes")
    return scenes


def main() -> None:
    use_plot = "--plot" in sys.argv
    aoi = config.PLOT_GEOMETRY if use_plot else config.ALIGNMENT_AOI
    aoi_id = config.PLOT_ID if use_plot else config.ALIGNMENT_ID
    date_range = config.DATE_RANGE if use_plot else config.ALIGN_DATE_RANGE
    cloud_lt = config.SCENE_CLOUD_LT if use_plot else config.ALIGN_CLOUD_LT

    config.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    cache = Cache(config.CACHE_DIR)
    bbox = _bbox(aoi)

    s2_scenes, ref_crs = _get_optical(cache, bbox, date_range, cloud_lt, aoi_id)
    if not s2_scenes:
        print("no optical scenes for this AOI / range.")
        return
    grid = build_grid(aoi, ref_crs)
    print(f"grid: {grid.width}x{grid.height} px @ {config.GRID_RES_M:.0f} m in {ref_crs}")

    obs = [observe(s, load_scene_arrays(s, grid, cache), grid) for s in s2_scenes]
    chosen_opt = _pick_clear_optical(obs, config.N_ALIGN_PAIRS)
    if not chosen_opt:
        print("no clear optical dates for the alignment check.")
        return

    s1_scenes = _get_s1(cache, bbox, date_range, aoi_id)
    if not s1_scenes:
        print("no Sentinel-1 RTC scenes for this AOI / range.")
        return

    pairs = []
    print(f"\n{'optical':<12}{'radar':<12}{'orbit':<12}{'delta_d':>8}")
    for o in chosen_opt:
        s1 = _nearest_s1(o.scene.date, s1_scenes)
        s1obs = observe_s1(s1, load_s1_arrays(s1, grid, cache), grid)
        gap = abs((date.fromisoformat(s1.date) - date.fromisoformat(o.scene.date)).days)
        print(f"{o.scene.date:<12}{s1.date:<12}{s1.orbit_state:<12}{gap:>8}")
        pairs.append({
            "opt_date": o.scene.date, "opt_rgb": o.rgb,
            "rad_date": s1.date, "rad_orbit": s1.orbit_state,
            "vv_db": s1obs.vv_db, "day_gap": gap,
        })

    out_path = config.OUTPUT_DIR / f"{aoi_id}_s1_alignment.png"
    render.alignment_figure(pairs, grid, out_path)
    print(f"\nwrote {out_path}")


if __name__ == "__main__":
    main()
