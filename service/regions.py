"""Curated, globally-distributed sampling regions, each tagged with its ecoregion
stratum and a train/val split. This is the pragmatic stand-in for a random draw
over a global ecoregion polygon layer (see DECISIONS.md S-010): it gives real
per-stratum volume, lets us oversample plantation, and lets us hold out ENTIRE
regions for validation — with the honesty that a region's stratum is curated, not
read from a raster.

Each region is a small bbox [west, south, east, north] (WGS84) inside a known area
of that stratum, chosen away from Hansen 10-degree granule seams where possible.
The plantation regions are real rubber / oil-palm areas; their pixels label as
"forest" in WorldCover/Hansen — that is the point (see the plantation caveat).
"""
from __future__ import annotations

# stratum, split, name, bbox [W, S, E, N]
SAMPLE_REGIONS: list[dict] = [
    # --- tropical moist ---
    {"id": "amazon_br", "stratum": "tropical_moist", "split": "train", "name": "Amazon, Brazil", "bbox": [-60.60, -3.60, -60.40, -3.40]},
    {"id": "congo_cd", "stratum": "tropical_moist", "split": "train", "name": "Congo Basin, DRC", "bbox": [23.05, 0.25, 23.25, 0.45]},
    {"id": "sinharaja_lk", "stratum": "tropical_moist", "split": "train", "name": "Sinharaja, Sri Lanka", "bbox": [80.42, 6.38, 80.52, 6.48]},
    {"id": "borneo_id", "stratum": "tropical_moist", "split": "val", "name": "Kalimantan interior, Borneo", "bbox": [113.55, 0.05, 113.75, 0.25]},

    # --- dry deciduous ---
    {"id": "india_mp", "stratum": "dry_deciduous", "split": "train", "name": "Madhya Pradesh, India", "bbox": [78.05, 22.05, 78.25, 22.25]},
    {"id": "dryzone_lk", "stratum": "dry_deciduous", "split": "train", "name": "Dry zone, Sri Lanka", "bbox": [80.92, 8.22, 81.08, 8.38]},
    {"id": "cerrado_br", "stratum": "dry_deciduous", "split": "val", "name": "Cerrado edge, Brazil", "bbox": [-47.60, -15.55, -47.40, -15.35]},

    # --- mangrove ---
    {"id": "sundarbans", "stratum": "mangrove", "split": "train", "name": "Sundarbans, Bangladesh", "bbox": [89.05, 21.95, 89.25, 22.15]},
    {"id": "puttalam_lk", "stratum": "mangrove", "split": "train", "name": "Puttalam lagoon, Sri Lanka", "bbox": [79.72, 8.20, 79.86, 8.34]},
    {"id": "niger_delta", "stratum": "mangrove", "split": "val", "name": "Niger Delta, Nigeria", "bbox": [6.05, 4.42, 6.25, 4.62]},

    # --- montane ---
    {"id": "highlands_lk", "stratum": "montane", "split": "train", "name": "Central Highlands, Sri Lanka", "bbox": [80.75, 6.80, 80.88, 6.93]},
    {"id": "andes_pe", "stratum": "montane", "split": "train", "name": "Andean cloud forest, Peru", "bbox": [-72.55, -13.20, -72.40, -13.05]},
    {"id": "ethiopia_hl", "stratum": "montane", "split": "val", "name": "Ethiopian Highlands", "bbox": [38.05, 7.05, 38.25, 7.25]},

    # --- plantation (deliberately oversampled) ---
    {"id": "riau_palm", "stratum": "plantation", "split": "train", "name": "Riau oil palm, Sumatra", "bbox": [101.55, 0.35, 101.72, 0.52]},
    {"id": "malaysia_palm", "stratum": "plantation", "split": "train", "name": "Peninsular Malaysia oil palm", "bbox": [101.05, 3.55, 101.22, 3.72]},
    {"id": "kegalle_rubber", "stratum": "plantation", "split": "train", "name": "Kegalle rubber belt, Sri Lanka", "bbox": [80.30, 7.05, 80.46, 7.22]},
    {"id": "thai_rubber", "stratum": "plantation", "split": "train", "name": "Southern Thailand rubber", "bbox": [99.55, 7.55, 99.72, 7.72]},
    {"id": "kalimantan_palm", "stratum": "plantation", "split": "val", "name": "Kalimantan oil palm", "bbox": [111.55, -2.55, 111.72, -2.38]},
]
