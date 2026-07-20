"""Analyse one plot end to end and return the ML.md contract payload (camelCase, as
the web app's AnalysisResult expects). Real imagery, real forest-fraction series, real
change detection (changedetect.py), real before/after tiles.

The ONE placeholder: the per-pixel forest classifier. The trained U-Net does not exist
yet, so `forest_prob_proxy` (a transparent NDVI mapping) stands in its slot, and
`MODEL_VERSION` says so plainly. When the U-Net is trained, only this function and the
version string change — the rest of the pipeline and the contract stay identical.
"""
from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import rasterio
from pyproj import Geod
from shapely.geometry import shape

import config
import render
import stac
from cache import Cache
from changedetect import FLAGGED, INSUFFICIENT, FfObs, detect_change, forest_fraction
from imagery import build_grid, load_scene_arrays, observe, to_reflectance
from profiles import get_profile

_GEOD = Geod(ellps="WGS84")
MODEL_VERSION = "ndvi-proxy-0.1"  # NOT the trained U-Net — a documented stand-in classifier


def _area_ha(geom: dict) -> float:
    """Geodesic plot area in hectares (correct on the ellipsoid, no projection choice)."""
    area_m2, _ = _GEOD.geometry_area_perimeter(shape(geom))
    return abs(area_m2) / 10_000.0


def forest_prob_proxy(arrays, baseline) -> np.ndarray:
    """PLACEHOLDER for the trained U-Net's per-pixel forest probability. A transparent
    NDVI mapping (~0.2 → 0, ~0.8 → 1) so the whole pipeline runs on real imagery. It is
    NOT plantation-aware and must not be read as the model output."""
    red = to_reflectance(arrays["B04"], baseline)
    nir = to_reflectance(arrays["B08"], baseline)
    ndvi = (nir - red) / (nir + red + 1e-6)
    return np.clip((ndvi - 0.2) / 0.6, 0.0, 1.0)


def _search_key(bbox) -> str:
    return "|".join([
        config.COLLECTION, config.DATE_RANGE, str(config.SCENE_CLOUD_LT),
        ",".join(str(round(c, 4)) for c in bbox),
        ",".join(config.BANDS + [config.SCL_BAND]),
    ])


def _get_scenes(cache: Cache, bbox):
    """Cache-first S2 search (warm plots touch no network)."""
    path = cache.search_path(_search_key(bbox))
    meta = cache.load_json(path)
    if meta:
        return [stac.Scene.from_meta(d) for d in meta["scenes"]], meta["ref_crs"]
    scenes = stac.search_scenes(bbox, config.DATE_RANGE, config.SCENE_CLOUD_LT)
    if not scenes:
        return [], None
    ref_crs = scenes[0].crs
    if not ref_crs:
        with rasterio.open(scenes[0].assets["B04"]) as src:
            ref_crs = str(src.crs)
    cache.save_json(path, {"ref_crs": ref_crs, "scenes": [s.meta() for s in scenes]})
    return scenes, ref_crs


def _pick_before_after(result, profile):
    """(before_date, after_date) as ISO strings, or None. Flagged → the clearing window
    (last still-forested → first cleared); otherwise first → last usable observation."""
    if result.verdict == FLAGGED and result.clearing_window:
        return result.clearing_window[0], result.clearing_window[1]
    usable = [o for o in result.series if o.valid_fraction >= profile.min_valid_fraction]
    if len(usable) < 2:
        return None
    return usable[0].date.isoformat(), usable[-1].date.isoformat()


def analyze_plot(plot_id, geometry, country_code, commodity, cutoff_date, job_id, tiles_root) -> dict:
    profile = get_profile(country_code)
    if cutoff_date:
        profile = replace(profile, deforestation_cutoff=cutoff_date)  # per-request override

    cache = Cache(config.CACHE_DIR)
    bbox = list(shape(geometry).bounds)
    area_ha = _area_ha(geometry)
    accessed_at = datetime.now(timezone.utc).isoformat()

    scenes, ref_crs = _get_scenes(cache, bbox)
    base = {"plotId": plot_id, "jobId": job_id, "modelVersion": MODEL_VERSION,
            "dataAccessedAt": accessed_at, "imagery": []}
    if not scenes:
        return {**base, "verdict": INSUFFICIENT, "confidence": 0.0, "forestFractionSeries": []}

    grid = build_grid(geometry, ref_crs)
    series, obs_by_date = [], {}
    for s in scenes:
        arrays = load_scene_arrays(s, grid, cache)
        o = observe(s, arrays, grid)
        prob = forest_prob_proxy(arrays, s.processing_baseline)
        ff, vf = forest_fraction(prob, grid.plot_mask, o.valid, profile)
        series.append(FfObs(date=s.date, forest_fraction=ff, valid_fraction=vf, sensor="S2"))
        obs_by_date[s.date] = o

    result = detect_change(series, profile, area_ha)

    imagery = []
    pick = _pick_before_after(result, profile)
    if result.verdict != INSUFFICIENT and pick:
        out_dir = Path(tiles_root) / job_id
        out_dir.mkdir(parents=True, exist_ok=True)
        for role, d in (("before", pick[0]), ("after", pick[1])):
            o = obs_by_date[d]
            render.before_after_tile(o.rgb, grid, d, o.cloud_fraction, "S2", role, out_dir / f"{role}.png")
            imagery.append({"role": role, "url": f"/tiles/{job_id}/{role}.png",
                            "acquisitionDate": d, "sensor": "S2", "cloudCover": round(o.cloud_fraction, 3)})

    payload = {
        **base,
        "verdict": result.verdict,
        "confidence": result.confidence,
        "forestFractionSeries": [
            {"date": o.date.isoformat(), "forestFraction": round(o.forest_fraction, 3),
             "sensor": o.sensor, "cloudCover": round(1 - o.valid_fraction, 3)}
            for o in result.series
        ],
        "imagery": imagery,
    }
    if result.verdict == FLAGGED and result.clearing_window:
        payload["clearingDateRange"] = {"earliest": result.clearing_window[0],
                                        "latest": result.clearing_window[1]}
        payload["clearedHectares"] = round(result.cleared_area_ha or 0.0, 3)
    return payload
