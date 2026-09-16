"""
Pre-training leakage gate. Training MUST NOT start unless this exits 0.

    python ml/tea/check_leakage.py --csd <dir> --ewu <dir> --tld <dir>

Six checks, each of which has a real failure mode behind it rather than being
defensive box-ticking:

  1. GROUP OVERLAP     — the same source photograph in two splits. CS-D ships
                         9 near-identical copies of every photo; if a group
                         straddles train/test the test score is memorisation.
  2. PATH OVERLAP      — the same file in two splits. Cheap, catches loader bugs.
  3. NEAR-DUPLICATES   — images that are near-identical across train/val despite
                         being in different groups. Catches the case where the
                         recovered grouping rule is wrong, which no amount of
                         careful partitioning would save us from.
  4. CLASS MAPPING     — every folder resolves to a canonical class, CS-D maps
                         only to ACTIVE classes, and no inactive class leaked in.
  5. TRAIN PURITY      — only cs_d appears in train/val. EWU and TLD-BD are
                         test-only, and the whole value of their numbers depends
                         on that being true.
  6. DETERMINISM       — the split is reproducible and agrees with the
                         independent implementation in scripts/audit_tea_datasets.py.

Writes models/tea/leakage-report.json.
"""

from __future__ import annotations

import sys as _sys

# Windows consoles default to cp1252 and these scripts print em-dashes and
# arrows. A gate must not be able to fail because of a character in its own
# status line, so force UTF-8 on the streams before anything writes to them.
for _s in (_sys.stdout, _sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8")
    except Exception:
        pass

import argparse
import collections
import json
import random
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from teadata import Taxonomy, assign_split, load_csd, load_ewu, load_tld, summarise  # noqa: E402

REPO = Path(__file__).resolve().parents[2]


def colour_hist(path: str, size: int = 32, bins: int = 32) -> np.ndarray:
    with Image.open(path) as im:
        a = np.asarray(im.convert("RGB").resize((size, size)), dtype=np.float32)
    h = np.concatenate([np.histogram(a[:, :, c], bins=bins, range=(0, 255))[0] for c in range(3)])
    return h / (h.sum() + 1e-9)


def check_group_overlap(samples) -> dict:
    """A source group must live in exactly one split."""
    where = collections.defaultdict(set)
    for s in samples:
        if s.dataset != "cs_d":
            continue
        where[(s.source_label, s.group)].add(s.split)
        bad = {k: sorted(v) for k, v in where.items() if len(v) > 1}
    bad = {k: sorted(v) for k, v in where.items() if len(v) > 1}
    return {
        "name": "group_overlap",
        "passed": not bad,
        "groups_checked": len(where),
        "violations": len(bad),
        "examples": [f"{k[0]}/{k[1]} in {v}" for k, v in list(bad.items())[:5]],
    }


def check_path_overlap(samples) -> dict:
    where = collections.defaultdict(set)
    for s in samples:
        where[s.path].add(s.split)
    bad = [p for p, v in where.items() if len(v) > 1]
    return {
        "name": "path_overlap",
        "passed": not bad,
        "paths_checked": len(where),
        "violations": len(bad),
        "examples": bad[:5],
    }


def check_near_duplicates(samples, sample_n: int = 1200, threshold: float = 0.9999, seed: int = 1337) -> dict:
    """Hunt for near-identical images spanning train and val.

    This is the check that would catch a WRONG grouping rule. The stride rule was
    recovered empirically, so it deserves an independent test rather than trust.

    The threshold is deliberately extreme (0.9999). CS-D images are all tea
    leaves at 256x256, so ordinary cross-pair similarity is already ~0.96-0.99;
    flagging at 0.99 would report thousands of meaningless "duplicates". Only a
    near-exact match indicates the same photograph.
    """
    rng = random.Random(seed)
    tr = [s for s in samples if s.split == "train" and s.dataset == "cs_d"]
    va = [s for s in samples if s.split == "val" and s.dataset == "cs_d"]
    tr = rng.sample(tr, min(sample_n, len(tr)))
    va = rng.sample(va, min(sample_n, len(va)))

    A = np.stack([colour_hist(s.path) for s in tr])
    B = np.stack([colour_hist(s.path) for s in va])
    A /= np.linalg.norm(A, axis=1, keepdims=True)
    B /= np.linalg.norm(B, axis=1, keepdims=True)
    S = B @ A.T  # val x train

    nn = S.max(1)
    hits = int((nn >= threshold).sum())
    idx = S.argmax(1)
    examples = []
    for i in np.argsort(-nn)[:5]:
        examples.append(
            {
                "val": Path(va[int(i)].path).name,
                "train": Path(tr[int(idx[int(i)])].path).name,
                "similarity": round(float(nn[int(i)]), 6),
                "same_group": (va[int(i)].source_label, va[int(i)].group)
                == (tr[int(idx[int(i)])].source_label, tr[int(idx[int(i)])].group),
            }
        )
    return {
        "name": "near_duplicates_train_vs_val",
        "passed": hits == 0,
        "threshold": threshold,
        "val_sampled": len(va),
        "train_sampled": len(tr),
        "mean_nn_similarity": round(float(nn.mean()), 4),
        "max_nn_similarity": round(float(nn.max()), 6),
        "violations": hits,
        "closest_pairs": examples,
    }


def check_class_mapping(samples, tax: Taxonomy) -> dict:
    labels = collections.defaultdict(set)
    for s in samples:
        labels[s.dataset].add(s.source_label)
    problems = []
    for ds, ls in labels.items():
        for l in ls:
            c = tax.from_source_label(l)
            if c is None:
                problems.append(f"{ds}: '{l}' maps to nothing")
            elif not c.active:
                problems.append(f"{ds}: '{l}' maps to INACTIVE {c.key}")
    ids_used = sorted({s.class_id for s in samples})
    idx_ok = all(s.model_index == tax.model_index(s.class_id) for s in samples)
    return {
        "name": "class_mapping",
        "passed": not problems and idx_ok and set(ids_used).issubset(set(tax.active_ids)),
        "labels_by_dataset": {k: sorted(v) for k, v in labels.items()},
        "class_ids_used": ids_used,
        "active_class_ids": tax.active_ids,
        "model_index_consistent": idx_ok,
        "problems": problems,
    }


def check_train_purity(samples) -> dict:
    """EWU and TLD-BD must never appear in train or val."""
    contaminants = sorted({s.dataset for s in samples if s.split in ("train", "val") and s.dataset != "cs_d"})
    counts = collections.Counter(
        s.dataset for s in samples if s.split in ("train", "val")
    )
    return {
        "name": "train_purity",
        "passed": not contaminants,
        "datasets_in_train_val": dict(counts),
        "contaminants": contaminants,
    }


def check_determinism(samples) -> dict:
    """Recomputing the split must give the same answer, and must agree with the
    independent implementation used during the audit."""
    sys.path.insert(0, str(REPO / "scripts"))
    from audit_tea_datasets import assign_split as audit_assign  # noqa

    mismatches, recompute_fail = [], 0
    for s in samples:
        if s.dataset != "cs_d":
            continue
        again = assign_split("cs_d", s.source_label, s.group)
        if again != s.split:
            recompute_fail += 1
        if audit_assign("cs_d", s.source_label, s.group) != s.split:
            mismatches.append(f"{s.source_label}/{s.group}")
    return {
        "name": "split_determinism",
        "passed": recompute_fail == 0 and not mismatches,
        "recompute_mismatches": recompute_fail,
        "audit_script_mismatches": len(mismatches),
        "examples": mismatches[:5],
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csd", required=True)
    ap.add_argument("--ewu", required=True)
    ap.add_argument("--tld", required=True)
    ap.add_argument("--out", default=str(REPO / "models" / "tea" / "leakage-report.json"))
    a = ap.parse_args()

    tax = Taxonomy()
    csd = load_csd(a.csd, tax)
    ewu = load_ewu(a.ewu, tax)
    tld = load_tld(a.tld, tax)
    everything = csd + ewu + tld

    checks = [
        check_class_mapping(everything, tax),
        check_group_overlap(csd),
        check_path_overlap(everything),
        check_train_purity(everything),
        check_determinism(everything),
        check_near_duplicates(csd),
    ]

    report = {
        "taxonomy_version": tax.version,
        "active_classes": [{"classId": c.class_id, "key": c.key} for c in tax.active],
        "cs_d": summarise(csd, tax),
        "ewu": summarise(ewu, tax),
        "tld_bd": summarise(tld, tax),
        "checks": checks,
        "all_passed": all(c["passed"] for c in checks),
    }
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out).write_text(json.dumps(report, indent=2), encoding="utf-8")

    print("=" * 66)
    print("LEAKAGE GATE")
    print("=" * 66)
    for name, s in (("CS-D", report["cs_d"]), ("EWU", report["ewu"]), ("TLD-BD", report["tld_bd"])):
        print(f"\n{name}: {s['images_by_split']}  groups={s['groups_by_split']}")
        for sp, per in sorted(s["images_by_split_class"].items()):
            print(f"   {sp:<6} {per}")
    print()
    for c in checks:
        print(f"  {'PASS' if c['passed'] else 'FAIL'}  {c['name']}"
              + (f"   ({c['violations']} violations)" if c.get("violations") else ""))
        if not c["passed"]:
            for k in ("problems", "examples", "contaminants"):
                if c.get(k):
                    print(f"        {k}: {c[k]}")
    print(f"\n  → {'ALL CHECKS PASSED' if report['all_passed'] else 'LEAKAGE DETECTED — TRAINING MUST NOT START'}")
    print(f"  >> {a.out}")
    sys.exit(0 if report["all_passed"] else 1)


if __name__ == "__main__":
    main()
