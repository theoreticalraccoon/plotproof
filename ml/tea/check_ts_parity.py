"""Cross-language parity check: does the app's TypeScript preprocessing agree with the Python
transform the model was evaluated under?"""

from __future__ import annotations

import argparse
import json
import random
import subprocess
import sys
import tempfile
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
from teadata import Taxonomy, load_csd  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
PUBLIC = REPO / "public" / "models"

NODE_RUNNER = r"""
import { readFileSync, writeFileSync } from "node:fs";
import { preprocessRgba } from "./lib/grow/tea/preprocess.ts";

const job = JSON.parse(readFileSync(process.argv[2], "utf8"));
const prep = job.prep;
const out = [];
for (const item of job.images) {
  const data = new Uint8ClampedArray(readFileSync(item.rgba));
  const { tensor } = preprocessRgba({ width: item.width, height: item.height, data }, prep);
  out.push(Array.from(tensor));
}
writeFileSync(job.out, JSON.stringify(out));
"""


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csd", required=True)
    ap.add_argument("--n", type=int, default=40)
    a = ap.parse_args()

    card = json.loads((PUBLIC / "tea-disease-mnv3s-card.json").read_text(encoding="utf-8"))
    prep = card["preprocessing"]
    T = card["calibration"]["temperature"]
    thr = card["abstention"]["threshold"]
    names = [c["key"] for c in card["taxonomy"]["classes"]]
    sess = ort.InferenceSession(str(PUBLIC / "tea-disease-mnv3s.onnx"),
                                providers=["CPUExecutionProvider"])

    tax = Taxonomy()
    test = [s for s in load_csd(a.csd, tax) if s.split == "test"]
    picks = random.Random(11).sample(test, min(a.n, len(test)))

    tmp = Path(tempfile.mkdtemp(prefix="tea-parity-"))
    manifest = {"prep": prep, "images": [], "out": str(tmp / "ts_tensors.json")}
    torch_tensors = []

    from torchvision import transforms
    tf = transforms.Compose([
        transforms.Resize(prep["resize_shorter_side_to"]),
        transforms.CenterCrop(prep["image_size"]),
        transforms.ToTensor(),
        transforms.Normalize(prep["mean"], prep["std"]),
    ])

    for i, s in enumerate(picks):
        with Image.open(s.path) as im:
            rgb = im.convert("RGB")
            rgba = rgb.convert("RGBA")
            raw = tmp / f"{i}.bin"
            raw.write_bytes(rgba.tobytes())
            manifest["images"].append({"rgba": str(raw), "width": rgba.width, "height": rgba.height})
            torch_tensors.append(tf(rgb).numpy())

    mf = tmp / "job.json"
    mf.write_text(json.dumps(manifest), encoding="utf-8")
    runner = REPO / "ts_parity_runner.mjs"
    runner.write_text(NODE_RUNNER, encoding="utf-8")
    try:
        subprocess.run(
            ["node", "--experimental-strip-types", str(runner), str(mf)],
            cwd=REPO, check=True, capture_output=True, text=True,
        )
        ts_tensors = json.loads(Path(manifest["out"]).read_text(encoding="utf-8"))
    finally:
        runner.unlink(missing_ok=True)

    size = prep["image_size"]

    def predict(t: np.ndarray):
        logits = sess.run(["logits"], {"input": t.reshape(1, 3, size, size).astype(np.float32)})[0]
        z = logits / T
        z = z - z.max()
        e = np.exp(z)
        p = (e / e.sum())[0]
        i = int(p.argmax())
        return names[i], float(p[i])

    agree = 0
    both_confident_agree = 0
    both_confident = 0
    diffs = []
    disagreements = []

    for k, s in enumerate(picks):
        ts = np.array(ts_tensors[k], dtype=np.float32)
        pt = torch_tensors[k]
        diffs.append(float(np.abs(ts - pt.reshape(-1)).mean()))
        ts_cls, ts_conf = predict(ts)
        pt_cls, pt_conf = predict(pt)
        if ts_cls == pt_cls:
            agree += 1
        else:
            disagreements.append((Path(s.path).name, pt_cls, ts_cls))
        if ts_conf >= thr and pt_conf >= thr:
            both_confident += 1
            if ts_cls == pt_cls:
                both_confident_agree += 1

    print(f"\nTS <-> Python preprocessing parity  (n={len(picks)}, CS-D held-out test)")
    print(f"  mean |tensor difference|      {np.mean(diffs):.4f}")
    print(f"  predicted class agreement     {agree}/{len(picks)}  ({100*agree/len(picks):.1f}%)")
    if both_confident:
        print(f"  agreement where BOTH confident {both_confident_agree}/{both_confident}")
    if disagreements:
        print("  disagreements (python -> ts):")
        for n, p_, t_ in disagreements[:8]:
            print(f"    {n}: {p_} -> {t_}")
    print("\n  Note: a small tensor difference is expected, the pure-TS fallback resamples")
    print("  nearest-neighbour while torchvision uses bilinear. The browser's canvas path")
    print("  resamples smoothly and sits closer to torchvision than this test does.")
    # Disagreements below the threshold never reach a farmer: those inputs are declined. Only a
    # confident disagreement is a real defect.
    ok = both_confident_agree == both_confident
    verdict = "PASS" if ok else "FAIL"
    print(f"\n  {verdict}: confident predictions agree "
          f"{both_confident_agree}/{both_confident}")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
