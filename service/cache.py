"""Aggressive on-disk cache. The brief's hardest rule for this phase: never
download the same pixels twice. Every downloaded band — already clipped to the
plot grid and resampled — is written under CACHE_DIR keyed by content, and reads
check the disk first. The STAC search result is cached too, so a fully warm run
touches the network zero times. Deleting CACHE_DIR is the only way to force a
refetch.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import numpy as np


def key_hash(*parts: str) -> str:
    """Short stable hash of the identifying parts (not security-sensitive)."""
    return hashlib.sha1("|".join(parts).encode()).hexdigest()[:16]


class Cache:
    def __init__(self, root: Path):
        self.root = Path(root)
        (self.root / "stac").mkdir(parents=True, exist_ok=True)
        (self.root / "scenes").mkdir(parents=True, exist_ok=True)

    # --- STAC search results (metadata only; signed hrefs are never cached
    #     because their SAS tokens expire — the arrays they point to are what we
    #     actually keep) ---------------------------------------------------------
    def search_path(self, key: str) -> Path:
        return self.root / "stac" / f"{key_hash(key)}.json"

    def load_json(self, path: Path):
        return json.loads(path.read_text()) if path.exists() else None

    def save_json(self, path: Path, obj) -> None:
        path.write_text(json.dumps(obj, indent=2, default=str))

    # --- per-scene, per-band clipped arrays -----------------------------------
    def array_path(self, item_id: str, asset: str, grid_key: str) -> Path:
        d = self.root / "scenes" / item_id
        d.mkdir(parents=True, exist_ok=True)
        # grid_key changes if the AOI or reference CRS changes, so arrays from a
        # different plot/grid never collide.
        return d / f"{asset}_{key_hash(grid_key)}.npy"

    def load_array(self, path: Path):
        return np.load(path) if path.exists() else None

    def save_array(self, path: Path, arr: np.ndarray) -> None:
        np.save(path, arr)
