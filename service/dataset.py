"""Chip dataset, the 10-channel input assembly, and modality dropout.

The 10 channels (ML.md order): B02 B03 B04 B08 B11 B12  NDVI NDMI  VV VH.
The target is a per-pixel binary forest mask (forest OR mangrove = 1; EUDR counts
mangrove as forest). Modality dropout randomly blanks the whole optical group or the
whole radar group during training, so the network learns to cope when one is missing
— and the same mechanism, at inference, tells us which sensors actually contributed
to a prediction (recorded and carried to the PDF).

Expected chip layout on disk (produced by the chip builder once extended to 10-ch):
    <chip>/bands.npy   (6, H, W)  reflectance  B02,B03,B04,B08,B11,B12
    <chip>/radar.npy   (2, H, W)  Sentinel-1 dB  VV,VH
    <chip>/label.npy   (H, W)     uint8 class raster (see labels.py)
    <chip>/meta.json
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import Dataset

OPTICAL_BANDS = ["B02", "B03", "B04", "B08", "B11", "B12"]
CHANNELS = OPTICAL_BANDS + ["NDVI", "NDMI", "VV", "VH"]
OPTICAL_IDX = list(range(0, 8))   # 6 bands + 2 indices form the "optical" group
RADAR_IDX = [8, 9]                # VV, VH form the "radar" group
FOREST_LABEL_IDS = (1, 4)         # FOREST, MANGROVE (see labels.py) → forest = 1


def _norm_optical(a):        return np.clip(a, 0.0, 1.0)
def _norm_index(a):          return np.clip((a + 1.0) / 2.0, 0.0, 1.0)      # [-1,1] → [0,1]
def _norm_radar_db(a):       return np.clip((a + 30.0) / 30.0, 0.0, 1.0)    # ~[-30,0] dB → [0,1]


def assemble_input(bands6: np.ndarray, radar2: np.ndarray) -> np.ndarray:
    """(6,H,W) reflectance + (2,H,W) radar dB → (10,H,W) normalised input."""
    b = {n: bands6[i].astype("float32") for i, n in enumerate(OPTICAL_BANDS)}
    ndvi = (b["B08"] - b["B04"]) / (b["B08"] + b["B04"] + 1e-6)
    ndmi = (b["B08"] - b["B11"]) / (b["B08"] + b["B11"] + 1e-6)
    chans = [_norm_optical(bands6[i]) for i in range(6)]
    chans += [_norm_index(ndvi), _norm_index(ndmi),
              _norm_radar_db(radar2[0]), _norm_radar_db(radar2[1])]
    return np.stack(chans).astype("float32")


def apply_modality_dropout(x: np.ndarray, p_optical_only: float, p_radar_only: float, rng) -> tuple[np.ndarray, str]:
    """Blank one modality group at random. Returns (x, sensors_present)."""
    r = rng.random()
    if r < p_optical_only:            # keep optical only → radar missing
        x = x.copy(); x[RADAR_IDX] = 0.0; return x, "optical"
    if r < p_optical_only + p_radar_only:  # keep radar only → optical missing
        x = x.copy(); x[OPTICAL_IDX] = 0.0; return x, "radar"
    return x, "both"


def sensors_present(x: np.ndarray) -> str:
    """Inference-time provenance: which sensor groups carry signal."""
    opt = bool(np.any(x[OPTICAL_IDX] != 0))
    rad = bool(np.any(x[RADAR_IDX] != 0))
    return "both" if opt and rad else "optical" if opt else "radar" if rad else "none"


class ChipDataset(Dataset):
    def __init__(self, chip_dirs, modality_dropout=False, p_optical_only=0.15,
                 p_radar_only=0.15, seed=0):
        self.dirs = [Path(d) for d in chip_dirs]
        self.md = modality_dropout
        self.p_o, self.p_r = p_optical_only, p_radar_only
        self.rng = np.random.default_rng(seed)

    def __len__(self):
        return len(self.dirs)

    def __getitem__(self, i):
        d = self.dirs[i]
        meta = json.loads((d / "meta.json").read_text())
        x = assemble_input(np.load(d / "bands.npy"), np.load(d / "radar.npy"))
        present = "both"
        if self.md:
            x, present = apply_modality_dropout(x, self.p_o, self.p_r, self.rng)
        y = np.isin(np.load(d / "label.npy"), FOREST_LABEL_IDS).astype("float32")[None]
        return (torch.from_numpy(x), torch.from_numpy(y),
                {"present": present, "stratum": meta["stratum"], "region_id": meta["region_id"]})


def collate(batch):
    xs = torch.stack([b[0] for b in batch])
    ys = torch.stack([b[1] for b in batch])
    metas = [b[2] for b in batch]
    return xs, ys, metas


def split_by_region(chips_root) -> tuple[list[Path], list[Path]]:
    """Train/val chip dirs by the split recorded when the chip was built — whole
    regions are held out, never random chips."""
    train, val = [], []
    for meta_p in Path(chips_root).rglob("meta.json"):
        split = json.loads(meta_p.read_text())["split"]
        (val if split == "val" else train).append(meta_p.parent)
    return train, val
