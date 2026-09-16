"""
Dataset loading, splitting and label mapping for the tea classifier.

Shared by check_leakage.py, train.py and evaluate.py so that all three see
exactly the same splits. That is the point of putting it here rather than
letting each script build its own view: two scripts that disagree about which
group is in the test set produce numbers nobody can defend.

Three rules this module exists to enforce:

1. **Classes come from models/tea/taxonomy.json.** Never hardcoded here, never
   read from directory names. The taxonomy is the contract, it carries the
   evidence for every merge, and lib/grow/teaClasses.ts mirrors it.

2. **The split unit is the source GROUP, never the image.** CS-D publishes
   80,329 images generated from 9,000 photographs; EWU ships ~1.7 augmented
   copies per photo. Splitting on images puts near-identical siblings on both
   sides of the boundary and inflates every downstream number.

3. **The split is a pure function of identity.** sha256(dataset|class|group)
   mod 100, matching assign_split() in scripts/audit_tea_datasets.py exactly.
   No stored split file to lose, identical on every machine, and stable when
   data is added.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from dataclasses import dataclass
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
TAXONOMY_PATH = REPO / "models" / "tea" / "taxonomy.json"

CSD_STRIDE = 1500  # recovered empirically; see models/tea/dataset-audit.md finding 1

TRAIN_PCT = 70
VAL_PCT = 15  # test gets the remaining 15


# --------------------------------------------------------------------------
# taxonomy
# --------------------------------------------------------------------------

@dataclass(frozen=True)
class TeaClass:
    class_id: int
    key: str
    display_name: str
    kind: str
    active: bool
    source_labels: tuple[str, ...]


def _norm(s: str) -> str:
    return re.sub(r"[\s_-]+", " ", s.lower()).strip()


class Taxonomy:
    def __init__(self, path: Path = TAXONOMY_PATH):
        raw = json.loads(path.read_text(encoding="utf-8"))
        self.version: int = raw["taxonomy_version"]
        self.classes: list[TeaClass] = []
        for c in raw["classes"]:
            labels = tuple(l for group in c.get("sourceLabels", {}).values() for l in group)
            self.classes.append(
                TeaClass(c["classId"], c["key"], c["displayName"], c["kind"], c["active"], labels)
            )
        self.active = [c for c in self.classes if c.active]
        # The model's output vector is defined by this order, and by nothing else.
        self.active_ids: list[int] = list(raw["active_class_ids"])
        assert [c.class_id for c in self.active] == self.active_ids, (
            "taxonomy.json active_class_ids disagrees with the per-class active flags"
        )
        self._by_label = {}
        for c in self.classes:
            for l in c.source_labels:
                self._by_label.setdefault(_norm(l), c)

    def from_source_label(self, label: str) -> TeaClass | None:
        """Map a dataset folder name to a canonical class, or None.

        Returns None rather than guessing. An unmapped folder means the dataset
        changed and a human should look, not that it should be silently binned.
        """
        return self._by_label.get(_norm(label))

    def model_index(self, class_id: int) -> int:
        """Position of a class in the model's output vector."""
        return self.active_ids.index(class_id)

    @property
    def names(self) -> list[str]:
        return [c.display_name for c in self.active]

    @property
    def keys(self) -> list[str]:
        return [c.key for c in self.active]


# --------------------------------------------------------------------------
# deterministic split
# --------------------------------------------------------------------------

def assign_split(dataset: str, class_name: str, group_id, train=TRAIN_PCT, val=VAL_PCT) -> str:
    """Assign a whole source group to one split. Must match the audit script."""
    key = f"{dataset}|{class_name}|{group_id}".encode()
    bucket = int.from_bytes(hashlib.sha256(key).digest()[:4], "big") % 100
    return "train" if bucket < train else ("val" if bucket < train + val else "test")


# --------------------------------------------------------------------------
# samples
# --------------------------------------------------------------------------

@dataclass(frozen=True)
class Sample:
    path: str
    class_id: int
    model_index: int
    dataset: str
    source_label: str
    group: str
    split: str


CSD_DIRS = {
    "Blister_Blight": "Diseased Leaves/Blister_Blight",
    "Brown_Blight": "Diseased Leaves/Brown_Blight",
    "Leaf_Red_Rust": "Diseased Leaves/Leaf_Red_Rust",
    "Red_Spider_Mite": "Diseased Leaves/Red_Spider_Mite",
    "Tea_Mosquito_Bug": "Diseased Leaves/Tea_Mosquito_Bug",
    "Healthy_leaves": "Healthy Leaves/Healthy_leaves",
}


def load_csd(root: str, tax: Taxonomy) -> list[Sample]:
    """CS-D: the only training source. Group = the original photograph."""
    out: list[Sample] = []
    for label, sub in CSD_DIRS.items():
        d = Path(root) / sub
        cls = tax.from_source_label(label)
        if cls is None:
            raise ValueError(f"CS-D folder '{label}' does not map to any canonical class")
        if not cls.active:
            raise ValueError(f"CS-D folder '{label}' maps to INACTIVE class {cls.key}")
        for f in os.listdir(d):
            if not f.lower().endswith(".jpg"):
                continue
            digits = re.sub(r"\D", "", f)
            if not digits:
                continue
            group = str(((int(digits) - 1) % CSD_STRIDE) + 1)
            out.append(
                Sample(
                    path=str(d / f),
                    class_id=cls.class_id,
                    model_index=tax.model_index(cls.class_id),
                    dataset="cs_d",
                    source_label=label,
                    group=group,
                    split=assign_split("cs_d", label, group),
                )
            )
    return out


_RF_STEM = re.compile(r"^(.*?)[._]jpg\.rf\.[0-9a-f]+\.jpg$", re.I)

EWU_NAMES = ["Algal Leaf Spot", "Brown Blight", "Gray Blight", "Healthy", "Helopeltis", "Red Leaf Spot"]


def load_ewu(root: str, tax: Taxonomy) -> list[Sample]:
    """EWU: cross-dataset TEST only.

    Ships a Roboflow YOLO export whose own split leaks (101 source stems span
    splits), so the shipped split is discarded entirely and everything is
    re-derived from the source stem. Every sample is marked split='test'
    because this dataset is never trained on — the grouping is retained for
    duplicate reporting, not for partitioning.
    """
    out: list[Sample] = []
    for sp in ("train", "valid", "test"):
        img_dir = Path(root) / sp / "images"
        lbl_dir = Path(root) / sp / "labels"
        if not img_dir.is_dir():
            continue
        for f in os.listdir(img_dir):
            lf = lbl_dir / (Path(f).stem + ".txt")
            if not lf.exists():
                continue
            ids = set()
            for line in lf.read_text().splitlines():
                if line.strip():
                    ids.add(int(line.split()[0]))
            # 79 images carry no box, and a handful could in principle carry two
            # classes. Neither has a usable single label, so both are skipped.
            if len(ids) != 1:
                continue
            cls = tax.from_source_label(EWU_NAMES[next(iter(ids))])
            if cls is None or not cls.active:
                continue  # grey blight / algal leaf spot / red leaf spot stay inactive
            m = _RF_STEM.match(f)
            out.append(
                Sample(
                    path=str(img_dir / f),
                    class_id=cls.class_id,
                    model_index=tax.model_index(cls.class_id),
                    dataset="ewu",
                    source_label=EWU_NAMES[next(iter(ids))],
                    group=m.group(1) if m else f,
                    split="test",
                )
            )
    return out


def _tld_group(filename: str) -> str:
    """TLD-BD group = camera shutter number.

    iOS writes the edited copy of IMG_1234.JPG as IMG_E1234.JPG, so the 'E' is
    stripped to put an edited image in the same group as its original — 38 such
    pairs exist. Consecutive shutter numbers are bursts of the same leaf, but we
    group per-number rather than per-run: TLD-BD is test-only, so grouping
    serves duplicate reporting, and per-number is the conservative choice.
    """
    m = re.match(r"^IMG_E?(\d+)", filename, re.I)
    return m.group(1) if m else filename


def load_tld(root: str, tax: Taxonomy) -> list[Sample]:
    """TLD-BD: cross-dataset field TEST only. Never training, never selection.

    Only the three folders overlapping the active classes are loaded. The other
    three (gray_blight, algal_leaf, looper_infested) map to inactive reserved
    IDs and are skipped — presence in a test set is not a reason to activate a
    class.
    """
    out: list[Sample] = []
    for label in sorted(os.listdir(root)):
        d = Path(root) / label
        if not d.is_dir():
            continue
        cls = tax.from_source_label(label)
        if cls is None:
            raise ValueError(f"TLD-BD folder '{label}' does not map to any canonical class")
        if not cls.active:
            continue
        for f in os.listdir(d):
            if not f.lower().endswith((".jpg", ".jpeg", ".png")):
                continue
            out.append(
                Sample(
                    path=str(d / f),
                    class_id=cls.class_id,
                    model_index=tax.model_index(cls.class_id),
                    dataset="tld_bd",
                    source_label=label,
                    group=_tld_group(f),
                    split="test",
                )
            )
    return out


def summarise(samples: list[Sample], tax: Taxonomy) -> dict:
    """Counts by split and class, for the leakage report and the model card."""
    import collections

    by_split = collections.Counter(s.split for s in samples)
    groups = collections.defaultdict(set)
    per_class = collections.defaultdict(collections.Counter)
    for s in samples:
        groups[s.split].add((s.source_label, s.group))
        per_class[s.split][s.class_id] += 1
    id_to_key = {c.class_id: c.key for c in tax.classes}
    return {
        "images_by_split": dict(by_split),
        "groups_by_split": {k: len(v) for k, v in groups.items()},
        "images_by_split_class": {
            sp: {id_to_key[cid]: n for cid, n in sorted(cnt.items())} for sp, cnt in per_class.items()
        },
    }
