"""
Export the frozen model to ONNX and write the published artifact + model card.

    python ml/tea/export.py

Follows the pattern already proven by ml/prices: a notebook/script produces a
static artifact under public/models/, a typed loader reads it, and the component
renders it OR RENDERS NOTHING. No inference server, no new API route — the model
runs in the browser via onnxruntime-web.

Everything the UI needs to describe the model lives in the card, never in the
UI. Class names, preprocessing constants, the abstention threshold, metrics and
caveats are all data, so correcting a caveat is a JSON edit rather than a
component change.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import torch

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8")
    except Exception:
        pass

sys.path.insert(0, str(Path(__file__).resolve().parent))
from teadata import Taxonomy  # noqa: E402
from train import build_model, seed_everything  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
OUT = REPO / "models" / "tea"
PUBLIC = REPO / "public" / "models"

MODEL_NAME = "tea-disease-mnv3s"
MODEL_VERSION = "1.1.0"


def git_rev() -> str | None:
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"],
                                       cwd=REPO, text=True).strip()
    except Exception:
        return None


def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--checkpoint", default=str(OUT / "tea-mnv3s-best.pt"))
    ap.add_argument("--opset", type=int, default=17)
    a = ap.parse_args()

    seed_everything()
    tax = Taxonomy()
    ck = torch.load(a.checkpoint, map_location="cpu", weights_only=False)
    prep = ck["preprocessing"]
    size = prep["image_size"]

    model = build_model(len(tax.active))
    model.load_state_dict(ck["model"])
    model.eval()

    # ---- ONNX export ----
    onnx_path = OUT / f"{MODEL_NAME}-{MODEL_VERSION}.onnx"
    dummy = torch.randn(1, 3, size, size)
    # external_data=False is NOT optional here. torch 2.14's exporter defaults to
    # writing weights into a sibling .onnx.data file, which produced a 0.29 MB
    # "model" that was really just a graph stub -- it loaded fine next to its
    # sidecar and failed the moment the .onnx was published on its own. The
    # browser fetches ONE file, so the weights must live inside it.
    torch.onnx.export(
        model, dummy, str(onnx_path),
        input_names=["input"], output_names=["logits"],
        # Dynamic batch so the same artifact serves a single photo in the browser
        # and a batched check in CI without re-exporting.
        dynamic_axes={"input": {0: "batch"}, "logits": {0: "batch"}},
        opset_version=a.opset,
        external_data=False,
    )
    for stray in onnx_path.parent.glob(onnx_path.name + ".data"):
        stray.unlink()

    # A graph stub is ~0.3 MB; the real model is several MB. Refuse to publish
    # something too small to contain 1.5M float32 parameters.
    min_bytes = int(sum(p.numel() for p in model.parameters()) * 3)
    if onnx_path.stat().st_size < min_bytes:
        sys.exit(f"ONNX file is {onnx_path.stat().st_size} bytes, too small to hold the weights "
                 f"(expected >= {min_bytes}). Weights were probably externalised.")

    # ---- verify the export actually matches the model it claims to be ----
    import onnxruntime as ort
    sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    rng = np.random.default_rng(0)
    x = rng.standard_normal((4, 3, size, size)).astype(np.float32)
    with torch.no_grad():
        torch_out = model(torch.from_numpy(x)).numpy()
    onnx_out = sess.run(["logits"], {"input": x})[0]
    max_abs = float(np.abs(torch_out - onnx_out).max())
    agree = bool((torch_out.argmax(1) == onnx_out.argmax(1)).all())
    print(f"ONNX parity: max|Δlogit|={max_abs:.3e}  argmax agrees={agree}")
    if not agree or max_abs > 1e-3:
        sys.exit("ONNX export does not match the PyTorch model — refusing to publish")

    # ---- assemble the card from the artifacts, never by hand ----
    ev = json.loads((OUT / "evaluation.json").read_text(encoding="utf-8"))
    hist = json.loads((OUT / "train-history.json").read_text(encoding="utf-8"))
    prov = json.loads((OUT / "provenance.json").read_text(encoding="utf-8"))
    manifest = json.loads((OUT / "manifest.json").read_text(encoding="utf-8"))

    def prov_ref(ds_id: str) -> dict:
        d = next((x for x in prov["datasets"] if x["id"] == ds_id), {})
        return {"id": ds_id, "name": d.get("name"), "doi": d.get("doi"),
                "licence": d.get("licence"), "licence_url": d.get("licence_url"),
                "source_url": d.get("source_url")}

    tests = {t["test_set"]: t for t in ev["tests"]}
    key_metrics = {
        name: {"samples": t["samples"], "accuracy": t["accuracy"], "macro_f1": t["macro_f1"],
               "ece": t["calibration"]["ece"], "classes_present": t["classes_present"],
               "classes_absent": t["classes_absent"]}
        for name, t in tests.items()
    }

    card = {
        "$comment": [
            "Published model card for the PlotProof tea classifier. The app reads this file;",
            "nothing here is duplicated in the UI. No artifact -> the feature renders nothing,",
            "the same contract public/models/prices.json follows.",
        ],
        "schemaVersion": 1,
        "model": {
            "name": MODEL_NAME,
            "version": MODEL_VERSION,
            "architecture": "MobileNetV3-Small (ImageNet-pretrained backbone, new 6-class head)",
            "why_this_architecture": (
                "Chosen for the deployment target, not the leaderboard: it runs in a browser on a "
                "mid-range Android phone, so ~2.5M parameters matter more than a point of accuracy."),
            "framework": f"PyTorch {torch.__version__}",
            "export_format": f"ONNX opset {a.opset}, dynamic batch",
            "file": f"{MODEL_NAME}-{MODEL_VERSION}.onnx",
            "bytes": onnx_path.stat().st_size,
            "sha256": sha256_file(onnx_path),
            "parameters": int(sum(p.numel() for p in model.parameters())),
            "trained_at": datetime.now(timezone.utc).isoformat(),
            "git_rev": git_rev(),
            "seed": ck["seed"],
            "onnx_parity_max_abs_logit_delta": max_abs,
        },
        "taxonomy": {
            "taxonomy_version": tax.version,
            "source_of_truth": "models/tea/taxonomy.json (mirrored in lib/grow/teaClasses.ts)",
            "classes": [
                {"outputIndex": i, "classId": c.class_id, "key": c.key,
                 "displayName": c.display_name, "kind": c.kind}
                for i, c in enumerate(tax.active)
            ],
            "inactive_classes_not_predicted": [
                {"classId": c.class_id, "key": c.key} for c in tax.classes if not c.active
            ],
        },
        "preprocessing": prep,
        "training": {
            "dataset": "CS-D only",
            "dataset_ref": prov_ref("cs_d"),
            "split_rule": manifest["split"]["method"],
            "split_unit": manifest["split"]["unit"],
            "groups": {"train": 6259, "val": 1351, "test": 1390},
            "images": {"train_pool": 55861, "val": 12058, "test": 12410},
            "samples_per_group_per_epoch": hist["config"]["samples_per_group"],
            "samples_per_group_rationale": (
                "CS-D's nine augmentations per photograph have nearest-neighbour similarity 0.9988. "
                "Each epoch draws a different member per group, so the full set is seen over "
                "training without paying 9x the compute for near-identical images."),
            "class_weighting": "none",
            "class_weighting_rationale": (
                "Training counts run 8,881-9,504 per class (max/min = 1.07). Weighting a "
                "distribution this balanced adds a knob without addressing a problem."),
            "config": hist["config"],
            "field_simulation": hist.get("field_simulation"),
            "field_simulation_rationale": (
                "Every image in every dataset in the audited corpus is a detached leaf on white "
                "paper or cloth, evenly lit, filling the frame. A farmer photographs a leaf on the "
                "bush, among other leaves, under dappled light. Half of each training epoch is "
                "therefore rendered into field conditions by ml/tea/fieldsim.py: the leaf is matted "
                "off its studio background and composited onto an out-of-focus canopy built from "
                "other leaves of the same split, then relit and passed through a simulated phone "
                "camera. This is a simulation and is not evidence about real photographs."),
            "epochs_run": len(hist["history"]),
            "selection_metric": "validation macro-F1",
            "selected_epoch": ev["selected_epoch"],
            "history": hist["history"],
        },
        "evaluation": {
            "datasets": {"test_1": prov_ref("cs_d"), "test_2": prov_ref("ewu_tea_leaf_disease"),
                         "test_3": prov_ref("tld_bd"), "test_4": prov_ref("cs_d")},
            "key_metrics": key_metrics,
            "domain_note": ev.get("domain_note"),
            "field_simulation": ev.get("field_simulation"),
            "never_pool_note": ev["never_pool_note"],
            "full_report": "models/tea/evaluation.json",
            "reliability_diagram": "models/tea/reliability.png",
        },
        "calibration": ev["calibration"],
        "abstention": {
            "threshold": ev["abstention"]["threshold"],
            "selection_rule": ev["abstention"]["selection_rule"],
            "selected_on": ev["abstention"]["selected_on"],
            "validation_coverage": ev["abstention"]["validation_coverage"],
            "validation_accuracy_on_accepted": ev["abstention"]["validation_accuracy_on_accepted"],
            "target_accuracy": ev["abstention"].get("target_accuracy"),
            "quantile_floor": ev["abstention"].get("quantile_floor"),
            "superseded_rule": ev["abstention"].get("superseded_rule") or ev["abstention"].get("rejected_rule"),
            "coverage_by_test_set": {
                t["test_set"]: {"coverage": t["abstention"]["coverage"],
                                "accuracy_on_accepted": t["abstention"]["accuracy_on_accepted"]}
                for t in ev["tests"]},
            "behaviour": (
                "Below the threshold the app must show 'uncertain — retake the photo' rather than "
                "a class. A farmer photographing a hand, a shoe or a badly-lit leaf should get an "
                "abstention, never a confident wrong label."),
        },
        "known_limitations": [
            "TRAINED ENTIRELY ON ASSAM IMAGERY. No Sri Lankan tea appears in any training image.",
            "NO CROSS-DATASET EVIDENCE FOR BLISTER BLIGHT OR RED RUST. Neither class appears in any "
            "external dataset in the audited corpus, so their only numbers come from Test 1, which "
            "shares CS-D's domain. They are not cross-dataset validated.",
            "Blister blight is simultaneously the most important class in the product (it is the "
            "disease lib/grow/risk.ts models) and the least externally verifiable.",
            "Training images are 256x256, publisher-resized and median-filtered. The model inherits "
            "that preprocessing and has never seen a full-resolution photograph.",
            "NO DATASET IN THE CORPUS CONTAINS FIELD IMAGERY. CS-D, EWU and TLD-BD are all "
            "detached leaves on white paper or cloth, evenly lit, filling the frame. An earlier "
            "version of this card described TLD-BD as a field set; that was wrong and is corrected "
            "here. Test 4 substitutes a SIMULATED field domain (ml/tea/fieldsim.py) so the gap can "
            "be measured and trained against at all.",
            "THE REAL-FIELD ACCURACY IS UNMEASURED. Test 4 says the model handles synthetic "
            "canopy, occlusion and dappled light; it does not say the simulation resembles a Sri "
            "Lankan tea field. Only photographs from one would show that, and there are none.",
            "Trained from 9,000 distinct photographs, not 80,329 images — the published set is "
            "8.93x augmented.",
            "Two of the six classes are PESTS (red spider mite, tea mosquito bug), not pathogens. "
            "lib/grow/risk.ts has no weather-driven infection window for them, so fusion must not "
            "attach an environmental prior to those predictions.",
            "Open-set behaviour is handled by the abstention threshold only. There is no trained "
            "'not a tea leaf' class, so a confident-looking non-leaf photo may still be labelled.",
            "Red rust, algal leaf spot and red leaf spot are deliberately unmerged in the taxonomy; "
            "the literature and the dataset annotators disagree about whether they are one condition.",
        ],
        "provenance": {
            "training_data": prov_ref("cs_d"),
            "evaluation_data": [prov_ref("ewu_tea_leaf_disease"), prov_ref("tld_bd")],
            "licence_note": (
                "All source datasets are CC BY 4.0, which permits commercial use and derivative "
                "works including trained weights, subject to attribution and a statement of "
                "modification. Images were de-duplicated, re-split and augmented."),
            "records": ["models/tea/provenance.json", "models/tea/manifest.json",
                        "models/tea/dataset-audit.md", "models/tea/leakage-report.json"],
        },
        "attribution": [
            "CS-D tea leaf disease dataset — DOI 10.17632/94fzcdz8gz.1, CC BY 4.0. Images modified "
            "(de-duplicated, re-split, augmented).",
            "Tea leaf disease Dataset (East West University) — DOI 10.17632/mz598gxfw9.1, CC BY 4.0.",
            "TLD-BD / GreenPulse-T — DOI 10.17632/d2xybhfw59.2, CC BY 4.0.",
        ],
    }

    card_path = OUT / f"{MODEL_NAME}-card.json"
    card_path.write_text(json.dumps(card, indent=2), encoding="utf-8")

    PUBLIC.mkdir(parents=True, exist_ok=True)
    shutil.copy2(onnx_path, PUBLIC / f"{MODEL_NAME}.onnx")
    shutil.copy2(card_path, PUBLIC / f"{MODEL_NAME}-card.json")

    mb = onnx_path.stat().st_size / 1_048_576
    print(f"\n{MODEL_NAME} v{MODEL_VERSION}  {mb:.2f} MB  {card['model']['parameters']:,} params")
    print(f"  {card_path}")
    print(f"  published -> public/models/{MODEL_NAME}.onnx + -card.json")


if __name__ == "__main__":
    main()
