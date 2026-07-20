"""Sample chip centres inside each region, pull the Sentinel-2 window, reject
cloudy chips, attach the WorldCover+Hansen label, and save each chip to disk as a
(bands, label, meta) triple. Sampling is seeded per region so re-runs are stable
and hit the cache.
"""
from __future__ import annotations

import json
import random
import zlib

import numpy as np

import config
import stac
from cache import Cache
from imagery import grid_from_center, load_scene_arrays, observe, to_reflectance
from labels import label_chip, worldcover_href


def _least_cloud_scene(bbox):
    """Least-cloudy S2 scene over a region across the sampling year (one clear
    scene per region is enough; per-chip cloud is checked from SCL below)."""
    scenes = stac.search_scenes(bbox, config.CHIP_S2_RANGE, config.CHIP_S2_CLOUD_LT)
    return min(scenes, key=lambda s: s.cloud_cover) if scenes else None


def _save_chip(chip_id, region, center, scene, arrays, label, stats, grid) -> dict:
    d = config.CHIPS_DIR / region["split"] / region["stratum"] / chip_id
    d.mkdir(parents=True, exist_ok=True)
    bands = np.stack([to_reflectance(arrays[b], scene.processing_baseline) for b in config.BANDS])
    np.save(d / "bands.npy", bands.astype("float32"))  # (len(BANDS), H, W) reflectance
    np.save(d / "label.npy", label)                    # (H, W) uint8 class raster
    meta = {
        "chip_id": chip_id,
        "stratum": region["stratum"],
        "split": region["split"],
        "region": region["name"],
        "region_id": region["id"],
        "center_lonlat": [round(center[0], 5), round(center[1], 5)],
        "crs": grid.crs,
        "s2_date": scene.date,
        "s2_item": scene.item_id,
        "bands": config.BANDS,
        "hansen_version": config.HANSEN_VERSION,
        "worldcover_year": config.WORLDCOVER_YEAR,
        **stats,
    }
    (d / "meta.json").write_text(json.dumps(meta, indent=2))
    return meta


def sample_region(region: dict, n: int, cache: Cache, wc_cache: dict) -> list[dict]:
    scene = _least_cloud_scene(region["bbox"])
    if scene is None:
        print(f"  {region['id']}: no S2 scene found")
        return []

    seed = config.CHIP_SAMPLE_SEED ^ zlib.crc32(region["id"].encode())
    rng = random.Random(seed)
    w, s, e, nn = region["bbox"]
    inset = 0.02  # keep the 2.56 km chip inside the region box

    recs: list[dict] = []
    tries = 0
    while len(recs) < n and tries < n * config.CHIP_CENTER_TRIES:
        tries += 1
        lon = rng.uniform(w + inset, e - inset)
        lat = rng.uniform(s + inset, nn - inset)
        grid = grid_from_center(lon, lat)
        arrays = load_scene_arrays(scene, grid, cache)
        obs = observe(scene, arrays, grid)
        if obs.valid_fraction < (1 - config.CHIP_MAX_CLOUD_FRACTION):
            continue  # too cloudy over the chip — try another centre

        if region["id"] not in wc_cache:
            wc_cache[region["id"]] = worldcover_href(region["bbox"])
        wc_href = wc_cache[region["id"]]
        if wc_href is None:
            print(f"  {region['id']}: no WorldCover coverage")
            break

        label, stats = label_chip(grid, (lon, lat), wc_href)
        chip_id = f"{region['id']}_{len(recs):02d}"
        meta = _save_chip(chip_id, region, (lon, lat), scene, arrays, label, stats, grid)
        recs.append({"meta": meta, "rgb": obs.rgb, "label": label,
                     "valid_fraction": obs.valid_fraction})
    return recs
