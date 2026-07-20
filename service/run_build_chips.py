"""Build the labelled training set: sample chips across the curated regions,
label each from WorldCover + Hansen, save them, and render a QA grid to eyeball
the labelling before any training.

    ./.venv/Scripts/python.exe run_build_chips.py

Chips are written under ./chips/<split>/<stratum>/<chip_id>/ as bands.npy (S2
reflectance), label.npy (class raster), meta.json. The QA grid goes to
./output/chips_qa_grid.png. Scale the set by raising config.CHIPS_PER_REGION.
"""
from __future__ import annotations

from collections import defaultdict

import chips as chipmod
import config
import regions
import render
from cache import Cache

STRATA = ["tropical_moist", "dry_deciduous", "mangrove", "montane", "plantation"]


def main() -> None:
    config.CHIPS_DIR.mkdir(parents=True, exist_ok=True)
    config.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    cache = Cache(config.CACHE_DIR)
    wc_cache: dict = {}

    records: list[dict] = []
    for region in regions.SAMPLE_REGIONS:
        n = config.CHIPS_PER_REGION.get(region["stratum"], 1)
        print(f"{region['id']:<16} {region['stratum']:<14} {region['split']:<5} x{n}")
        records.extend(chipmod.sample_region(region, n, cache, wc_cache))

    # stratum x split summary — confirms plantation is oversampled and each
    # stratum has a held-out (val) region.
    counts: dict = defaultdict(lambda: defaultdict(int))
    for r in records:
        counts[r["meta"]["stratum"]][r["meta"]["split"]] += 1
    print(f"\n{'stratum':<16}{'train':>6}{'val':>6}")
    for st in STRATA:
        print(f"{st:<16}{counts[st]['train']:>6}{counts[st]['val']:>6}")
    print(f"\ntotal chips: {len(records)}")

    if not records:
        print("no chips built.")
        return
    out = config.OUTPUT_DIR / "chips_qa_grid.png"
    render.chip_qa_grid(records, out)
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
