"""
Reproducible audit of the tea-leaf datasets, run BEFORE any training.

    python scripts/audit_tea_datasets.py --csd <dir> --ewu <dir> [--out models/tea/audit-results.json]

Why this exists as a script rather than a one-off: every number in
models/tea/dataset-audit.md comes from here, so a reviewer can re-derive them
instead of trusting them, and a dataset revision can be re-audited in one command.

The load-bearing finding it produces is the SOURCE GROUP structure. CS-D ships
only its augmented form -- 80,329 images generated from 9,000 originals that are
not themselves published. Splitting those 80,329 at random would put eight
near-identical siblings of every test image into training, and the resulting
accuracy would be a memorisation score wearing a generalisation label.

Requires: Pillow, numpy.
"""

import argparse, collections, hashlib, json, os, random, re, sys

try:
    import numpy as np
    from PIL import Image
except ImportError:
    sys.exit("pip install Pillow numpy")


# --------------------------------------------------------------------------
# CS-D
# --------------------------------------------------------------------------

CSD_CLASSES = {
    "Blister_Blight": ("Diseased Leaves/Blister_Blight", "Blister_Blight"),
    "Brown_Blight": ("Diseased Leaves/Brown_Blight", "Brown_Blight"),
    "Leaf_Red_Rust": ("Diseased Leaves/Leaf_Red_Rust", "Leaf_Red_Rust"),
    "Red_Spider_Mite": ("Diseased Leaves/Red_Spider_Mite", "Red_Spider_Mite"),
    "Tea_Mosquito_Bug": ("Diseased Leaves/Tea_Mosquito_Bug", "Tea_Mosquito_Bug"),
    "Healthy": ("Healthy Leaves/Healthy_leaves", "Healthy_leaf"),
}

# Established empirically by `verify_stride` below: for every class, ~97% of
# images have their nearest neighbour at exactly index delta 1500, and almost
# all of the rest at 3000 (= 2 x 1500). So the publisher wrote all 1,500 source
# images, then all 1,500 first-augmentations, and so on -- nine passes.
CSD_STRIDE = 1500


def csd_group_id(index: int) -> int:
    """Which original leaf an augmented CS-D image came from."""
    return ((index - 1) % CSD_STRIDE) + 1


def colour_hist(path: str, size: int = 64, bins: int = 48) -> np.ndarray:
    """Per-channel colour histogram.

    Deliberately NOT a perceptual hash: CS-D's augmentations include flips and
    rotations, which change a pHash completely while leaving the colour
    distribution nearly untouched. A descriptor that survives the augmentation
    is exactly what is needed to detect it.
    """
    with Image.open(path) as im:
        a = np.asarray(im.convert("RGB").resize((size, size)), dtype=np.float32)
    h = np.concatenate([np.histogram(a[:, :, c], bins=bins, range=(0, 255))[0] for c in range(3)])
    return h / (h.sum() + 1e-9)


def verify_stride(root: str, window: int = 3100) -> dict:
    """Confirm the stride empirically, per class.

    The window must EXCEED the stride, or the sibling is outside the sample and
    the nearest neighbour falls to an unrelated image -- an easy way to talk
    yourself out of a real finding.
    """
    out = {}
    for name, (sub, prefix) in CSD_CLASSES.items():
        d = os.path.join(root, sub)
        feats, idx = [], []
        for i in range(1, window + 1):
            p = os.path.join(d, f"{prefix}{i}.jpg")
            if os.path.exists(p):
                feats.append(colour_hist(p))
                idx.append(i)
        F = np.stack(feats)
        F /= np.linalg.norm(F, axis=1, keepdims=True)
        S = F @ F.T
        np.fill_diagonal(S, -1.0)
        nn = S.argmax(1)
        deltas = collections.Counter(abs(idx[int(nn[k])] - idx[k]) for k in range(len(idx)))
        n = len(idx)
        out[name] = {
            "sampled": n,
            "pct_nn_at_stride": round(100 * deltas.get(CSD_STRIDE, 0) / n, 1),
            "pct_nn_at_multiple_of_stride": round(
                100 * sum(c for d, c in deltas.items() if d and d % CSD_STRIDE == 0) / n, 1
            ),
            "mean_nn_similarity": round(float(S.max(1).mean()), 4),
            "top_deltas": deltas.most_common(3),
        }
    return out


def audit_csd(root: str, sample: int = 300) -> dict:
    rng = random.Random(0)
    classes = {}
    total = 0
    for name, (sub, prefix) in CSD_CLASSES.items():
        d = os.path.join(root, sub)
        files = os.listdir(d)
        n = len(files)
        total += n
        groups = collections.Counter(
            csd_group_id(int(re.sub(r"\D", "", f) or 0)) for f in files
        )
        dims, modes, bad = collections.Counter(), collections.Counter(), 0
        for f in rng.sample(files, min(sample, n)):
            p = os.path.join(d, f)
            try:
                with Image.open(p) as im:
                    im.verify()
                with Image.open(p) as im:
                    dims[im.size] += 1
                    modes[im.mode] += 1
            except Exception:
                bad += 1
        classes[name] = {
            "images": n,
            "source_groups": len(groups),
            "group_size_distribution": dict(sorted(collections.Counter(groups.values()).items())),
            "dimensions_sampled": {f"{w}x{h}": c for (w, h), c in dims.items()},
            "modes_sampled": dict(modes),
            "unreadable_in_sample": bad,
            "sample_size": min(sample, n),
        }
    return {
        "total_images": total,
        "total_source_groups": sum(c["source_groups"] for c in classes.values()),
        "inflation_factor": round(total / max(1, sum(c["source_groups"] for c in classes.values())), 2),
        "classes": classes,
    }


# --------------------------------------------------------------------------
# EWU (Roboflow YOLO export)
# --------------------------------------------------------------------------

EWU_NAMES = ["Algal Leaf Spot", "Brown Blight", "Gray Blight", "Healthy", "Helopeltis", "Red Leaf Spot"]


def ewu_stem(filename: str) -> str:
    """Roboflow writes <sourceStem>_jpg.rf.<hash>.jpg, so the stem identifies
    the original photo that the augmented copies were generated from."""
    m = re.match(r"^(.*?)[._]jpg\.rf\.[0-9a-f]+\.jpg$", filename, re.I)
    return m.group(1) if m else filename


def audit_ewu(root: str) -> dict:
    splits = {sp: os.listdir(os.path.join(root, sp, "images")) for sp in ("train", "valid", "test")}
    groups, gcount = collections.defaultdict(set), collections.Counter()
    for sp, files in splits.items():
        for f in files:
            s = ewu_stem(f)
            groups[s].add(sp)
            gcount[s] += 1

    per_class, empty, multi = collections.Counter(), 0, 0
    for sp in splits:
        ld = os.path.join(root, sp, "labels")
        for lf in os.listdir(ld):
            cls = set()
            for line in open(os.path.join(ld, lf)):
                if line.strip():
                    cls.add(int(line.split()[0]))
            if not cls:
                empty += 1
            if len(cls) > 1:
                multi += 1
            for c in cls:
                per_class[c] += 1

    total = sum(len(v) for v in splits.values())
    straddling = {s: v for s, v in groups.items() if len(v) > 1}
    return {
        "total_images": total,
        "split_sizes": {k: len(v) for k, v in splits.items()},
        "distinct_source_stems": len(groups),
        "images_per_source_mean": round(total / max(1, len(groups)), 2),
        "class_counts": {EWU_NAMES[i]: per_class.get(i, 0) for i in range(len(EWU_NAMES))},
        "images_with_no_boxes": empty,
        "images_with_multiple_classes": multi,
        "shipped_split_leakage": {
            "source_stems_in_more_than_one_split": len(straddling),
            "pct_of_stems": round(100 * len(straddling) / max(1, len(groups)), 1),
            "affected_images": sum(gcount[s] for s in straddling),
            "pct_of_images": round(100 * sum(gcount[s] for s in straddling) / max(1, total), 1),
        },
    }


# --------------------------------------------------------------------------
# Deterministic, leakage-resistant split
# --------------------------------------------------------------------------

def assign_split(dataset: str, class_name: str, group_id, train=70, val=15) -> str:
    """Assign a whole SOURCE GROUP to one split.

    Deterministic and content-free: the bucket is a hash of the group's
    identity, so it needs no stored split file, it is identical on every
    machine, and adding a class or more images never reshuffles the images
    already assigned. The unit is the group, never the image -- that is the
    single property that keeps augmented siblings from straddling a boundary.
    """
    key = f"{dataset}|{class_name}|{group_id}".encode()
    bucket = int.from_bytes(hashlib.sha256(key).digest()[:4], "big") % 100
    return "train" if bucket < train else ("val" if bucket < train + val else "test")


def split_preview(csd: dict) -> dict:
    out = {}
    for name, info in csd["classes"].items():
        counts = collections.Counter(
            assign_split("cs_d", name, g) for g in range(1, info["source_groups"] + 1)
        )
        out[name] = {k: counts.get(k, 0) for k in ("train", "val", "test")}
    tot = collections.Counter()
    for v in out.values():
        tot.update(v)
    out["_total_groups"] = dict(tot)
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csd", help="CS-D 'Tea Leaf Dataset' directory")
    ap.add_argument("--ewu", help="EWU extracted Roboflow export directory")
    ap.add_argument("--out", default="models/tea/audit-results.json")
    ap.add_argument("--skip-stride", action="store_true", help="skip the slow stride verification")
    a = ap.parse_args()

    res = {"stride_assumed": CSD_STRIDE}
    if a.csd:
        res["cs_d"] = audit_csd(a.csd)
        if not a.skip_stride:
            res["cs_d"]["stride_verification"] = verify_stride(a.csd)
        res["cs_d"]["split_preview_groups"] = split_preview(res["cs_d"])
    if a.ewu:
        res["ewu"] = audit_ewu(a.ewu)

    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(res, f, indent=2)
    print(json.dumps(res, indent=2)[:4000])
    print(f"\nwritten to {a.out}")


if __name__ == "__main__":
    main()
