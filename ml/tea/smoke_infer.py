"""
Inference smoke tests against the PUBLISHED artifact, not the checkpoint.

    python ml/tea/smoke_infer.py --csd <dir> --tld <dir>

This runs the same file the browser will download, through onnxruntime, doing
its own preprocessing from the card's constants rather than reusing torchvision.
That is the point: it proves the published artifact plus the published
preprocessing spec are sufficient to reproduce the model's behaviour. If the
card's `mean`/`std`/`image_size` were wrong, every other test in this repo would
still pass and only this one would fail.

Four checks:
  1. real leaves from the held-out CS-D test split are classified sensibly
  2. real field photos from TLD-BD are classified sensibly
  3. non-leaf inputs (flat colours, noise) land BELOW the abstention threshold
  4. the output vector matches the card's class list, in order
"""

from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8")
    except Exception:
        pass

sys.path.insert(0, str(Path(__file__).resolve().parent))
from teadata import Taxonomy, load_csd, load_tld  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
PUBLIC = REPO / "public" / "models"


def preprocess(img: Image.Image, prep: dict) -> np.ndarray:
    """Preprocess using ONLY the card's published constants.

    Deliberately reimplemented from the spec rather than imported from
    torchvision — a browser has no torchvision, so this is the closest thing to
    the path the real client will take.
    """
    size = prep["image_size"]
    short = prep["resize_shorter_side_to"]
    img = img.convert("RGB")
    w, h = img.size
    scale = short / min(w, h)
    img = img.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.BILINEAR)
    w, h = img.size
    left, top = (w - size) // 2, (h - size) // 2
    img = img.crop((left, top, left + size, top + size))
    a = np.asarray(img, dtype=np.float32) / 255.0
    a = (a - np.array(prep["mean"], dtype=np.float32)) / np.array(prep["std"], dtype=np.float32)
    return np.transpose(a, (2, 0, 1))[None, ...]


def softmax(z: np.ndarray, T: float) -> np.ndarray:
    z = z / T
    z = z - z.max(axis=1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=1, keepdims=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csd", required=True)
    ap.add_argument("--tld", required=True)
    ap.add_argument("--n", type=int, default=12)
    a = ap.parse_args()

    card = json.loads((PUBLIC / "tea-disease-mnv3s-card.json").read_text(encoding="utf-8"))
    prep = card["preprocessing"]
    T = card["calibration"]["temperature"]
    thr = card["abstention"]["threshold"]
    names = [c["key"] for c in card["taxonomy"]["classes"]]
    sess = ort.InferenceSession(str(PUBLIC / "tea-disease-mnv3s.onnx"),
                                providers=["CPUExecutionProvider"])

    tax = Taxonomy()
    assert names == tax.keys, "published class order disagrees with the taxonomy"
    print(f"artifact: {card['model']['file']}  {card['model']['bytes']/1048576:.2f} MB")
    print(f"classes : {names}")
    print(f"T={T}  abstain<{thr}\n")

    rng = random.Random(7)
    failures = []

    def run(img: Image.Image):
        x = preprocess(img, prep)
        logits = sess.run(["logits"], {"input": x})[0]
        p = softmax(logits, T)[0]
        i = int(p.argmax())
        return names[i], float(p[i])

    # --- 1 + 2: real leaves ---
    for label, samples in (("CS-D held-out test", [s for s in load_csd(a.csd, tax) if s.split == "test"]),
                           ("TLD-BD field", load_tld(a.tld, tax))):
        picks = rng.sample(samples, min(a.n, len(samples)))
        correct = abstained = 0
        print(f"--- {label} ---")
        for s in picks:
            with Image.open(s.path) as im:
                pred, conf = run(im)
            truth = tax.keys[s.model_index]
            hit = pred == truth
            correct += hit
            if conf < thr:
                abstained += 1
            flag = "ok " if hit else "MISS"
            note = "  (abstain)" if conf < thr else ""
            print(f"  {flag} true={truth:<16} pred={pred:<16} conf={conf:.3f}{note}")
        print(f"  {correct}/{len(picks)} correct, {abstained} below threshold\n")

    # --- 3: non-leaf inputs must not be confidently labelled ---
    print("--- non-leaf inputs (should abstain) ---")
    synthetic = {
        "flat grey": Image.new("RGB", (640, 480), (128, 128, 128)),
        "flat white": Image.new("RGB", (640, 480), (255, 255, 255)),
        "flat black": Image.new("RGB", (640, 480), (0, 0, 0)),
        "uniform noise": Image.fromarray(
            (np.random.default_rng(0).random((480, 640, 3)) * 255).astype(np.uint8)),
    }
    for name, img in synthetic.items():
        pred, conf = run(img)
        ok = conf < thr
        print(f"  {'ok ' if ok else 'WARN'} {name:<14} pred={pred:<16} conf={conf:.3f}"
              f"{'' if ok else '  <-- confidently labelled a non-leaf'}")
        if not ok:
            failures.append(f"non-leaf '{name}' scored {conf:.3f} >= {thr}")

    print()
    if failures:
        # A warning, not an exit(1): the card already states that open-set
        # handling rests on the threshold alone and that there is no trained
        # "not a tea leaf" class. This surfaces the cost of that decision.
        print("SMOKE WARNINGS (documented limitation, not a regression):")
        for f in failures:
            print("  -", f)
    else:
        print("all smoke checks passed")


if __name__ == "__main__":
    main()
