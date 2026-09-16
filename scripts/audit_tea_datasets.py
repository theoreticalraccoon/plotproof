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
    # Key must be the FOLDER name, because assign_split() hashes it. An
    # earlier version keyed this "Healthy", which produced a different (still
    # valid, but different) partition from ml/tea/teadata.py and made the
    # preview counts in manifest.json disagree with the loader by 11 groups.
    "Healthy_leaves": ("Healthy Leaves/Healthy_leaves", "Healthy_leaf"),
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
# TLD-BD
# --------------------------------------------------------------------------

def exif_summary(path: str) -> dict:
    """Pull the EXIF fields that could identify WHERE and WHEN a photo was taken.

    This is the decisive test for TLD-BD. Its Mendeley description says images
    are 'organized into folders according to its respective class label' -- i.e.
    by class, not by estate -- and names two estates with GPS coordinates. If
    EXIF GPSInfo survived the publisher's compression to 480x640, each image can
    be assigned to an estate and a genuine geographic hold-out is possible. If
    the re-encode stripped it, the estate labels exist only in prose and the
    dataset is in exactly the same position as CS-D.
    """
    out = {"gps": None, "datetime": None, "make": None, "model": None}
    try:
        with Image.open(path) as im:
            exif = im.getexif()
            if not exif:
                return out
            # 0x8825 GPSInfo, 0x9003 DateTimeOriginal, 0x0132 DateTime,
            # 0x010F Make, 0x0110 Model
            gps = exif.get_ifd(0x8825) if hasattr(exif, "get_ifd") else None
            if gps:
                out["gps"] = {str(k): str(v) for k, v in gps.items()}
            out["datetime"] = exif.get(0x9003) or exif.get(0x0132)
            out["make"] = exif.get(0x010F)
            out["model"] = exif.get(0x0110)
    except Exception:
        pass
    return out


def audit_tld(root: str, sample: int = 400, dup_sample: int = 2500) -> dict:
    """Audit TLD-BD: contents, EXIF provenance, near-duplicates."""
    rng = random.Random(0)
    classes = {}
    all_files = []
    for entry in sorted(os.listdir(root)):
        d = os.path.join(root, entry)
        if not os.path.isdir(d):
            continue
        files = [f for f in os.listdir(d) if f.lower().endswith((".jpg", ".jpeg", ".png"))]
        if not files:
            continue
        dims, modes, bad = collections.Counter(), collections.Counter(), []
        for f in files:
            p = os.path.join(d, f)
            all_files.append((entry, f, p))
            try:
                with Image.open(p) as im:
                    im.verify()
                with Image.open(p) as im:
                    dims[im.size] += 1
                    modes[im.mode] += 1
            except Exception as e:
                bad.append(f"{entry}/{f}: {e}")
        classes[entry] = {
            "images": len(files),
            "dimensions": {f"{w}x{h}": c for (w, h), c in dims.most_common()},
            "modes": dict(modes),
            "unreadable": bad,
            "example_filenames": sorted(files)[:4],
        }

    # --- EXIF provenance across a sample ---
    ex_sample = rng.sample(all_files, min(sample, len(all_files)))
    gps_present = 0
    dt_present = 0
    devices = collections.Counter()
    gps_values = collections.Counter()
    datetimes = []
    for cls, fn, p in ex_sample:
        e = exif_summary(p)
        if e["gps"]:
            gps_present += 1
            gps_values[json.dumps(e["gps"], sort_keys=True)[:120]] += 1
        if e["datetime"]:
            dt_present += 1
            datetimes.append(str(e["datetime"]))
        if e["make"] or e["model"]:
            devices[f"{e['make']} {e['model']}".strip()] += 1

    # --- near-duplicate / group structure ---
    dup = rng.sample(all_files, min(dup_sample, len(all_files)))
    feats, meta = [], []
    for cls, fn, p in dup:
        try:
            feats.append(colour_hist(p))
            meta.append((cls, fn))
        except Exception:
            pass
    F = np.stack(feats)
    F /= np.linalg.norm(F, axis=1, keepdims=True)
    S = F @ F.T
    np.fill_diagonal(S, -1.0)
    nn = S.max(1)
    nn_idx = S.argmax(1)
    same_class = sum(1 for i in range(len(meta)) if meta[i][0] == meta[int(nn_idx[i])][0])

    return {
        "total_images": sum(c["images"] for c in classes.values()),
        "classes": classes,
        "class_imbalance_ratio": round(
            max(c["images"] for c in classes.values()) / max(1, min(c["images"] for c in classes.values())), 2
        ),
        "exif": {
            "sampled": len(ex_sample),
            "with_gps": gps_present,
            "pct_with_gps": round(100 * gps_present / max(1, len(ex_sample)), 1),
            "with_datetime": dt_present,
            "pct_with_datetime": round(100 * dt_present / max(1, len(ex_sample)), 1),
            "distinct_gps_values": len(gps_values),
            "gps_value_counts": dict(gps_values.most_common(6)),
            "devices": dict(devices.most_common(6)),
            "datetime_range": [min(datetimes), max(datetimes)] if datetimes else None,
            "estate_split_possible": gps_present > 0,
        },
        "near_duplicates": {
            "sampled": len(meta),
            "mean_nn_similarity": round(float(nn.mean()), 4),
            "pct_nn_above_0_999": round(100 * float((nn >= 0.999).sum()) / len(meta), 1),
            "pct_nn_above_0_99": round(100 * float((nn >= 0.99).sum()) / len(meta), 1),
            "pct_nn_same_class": round(100 * same_class / len(meta), 1),
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
    ap.add_argument("--tld", help="TLD-BD extracted directory (the one holding per-class folders)")
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
    if a.tld:
        res["tld_bd"] = audit_tld(a.tld)

    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(res, f, indent=2)
    print(json.dumps(res, indent=2)[:4000])
    print(f"\nwritten to {a.out}")


if __name__ == "__main__":
    main()
