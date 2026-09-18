"""
Calibrate on validation, freeze, then evaluate the three test sets exactly once.

    python ml/tea/evaluate.py --csd <dir> --ewu <dir> --tld <dir>

Order is load-bearing and enforced by the structure of this file:

  1. Validation logits  -> temperature scaling, and the abstention threshold.
  2. Model frozen.
  3. Test 1 / 2 / 3 scored, each once, with no parameter chosen from them.

The test sets are NEVER combined into a headline metric. They measure different
things and averaging them would produce a number that describes none of them.

A CORRECTION THAT MATTERS. An earlier version of this file called TLD-BD a
"field" test set. It is not. Every image in CS-D, EWU and TLD-BD alike is a
detached leaf on white paper or cloth, evenly lit, filling the frame. There is
no field imagery in the audited corpus at all, so until this run the model had
never seen the thing it is deployed to see — a leaf on a bush, among other
leaves, under dappled light — and abstained on most real photographs for the
honest reason that they were unlike anything it had been trained on. Test 4 is a
SIMULATED field set (ml/tea/fieldsim.py). It measures the gap; it is labelled
synthetic everywhere it is reported, and it is not evidence about real
photographs.

Two classes carry a permanent caveat: blister_blight and red_rust appear in NO
external dataset in the audited corpus, so they have no cross-dataset evidence
at all. Their only numbers come from Test 1, which shares CS-D's domain. The
report states this rather than letting a strong Test 1 figure imply otherwise.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8")
    except Exception:
        pass

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fieldsim import SPEC as FIELD_SPEC, FieldSimulator  # noqa: E402
from teadata import Taxonomy, load_csd, load_ewu, load_tld  # noqa: E402
from train import TeaDataset, build_model, build_transforms, seed_everything  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
OUT = REPO / "models" / "tea"


# --------------------------------------------------------------------------
# inference
# --------------------------------------------------------------------------

@torch.no_grad()
def collect_logits(model, samples, tf, batch_size=64, workers=4, field_sim=None, field_prob=0.0):
    ds = TeaDataset(samples, tf, samples_per_group=None,
                    field_sim=field_sim, field_prob=field_prob)
    ld = DataLoader(ds, batch_size=batch_size, shuffle=False, num_workers=workers)
    model.eval()
    L, Y = [], []
    for x, y in ld:
        L.append(model(x).numpy())
        Y.append(y.numpy())
    return np.concatenate(L), np.concatenate(Y)


# --------------------------------------------------------------------------
# calibration
# --------------------------------------------------------------------------

def fit_temperature(logits: np.ndarray, y: np.ndarray) -> float:
    """Temperature scaling (Guo et al. 2017), fitted on VALIDATION ONLY.

    One parameter, fitted by minimising NLL. Chosen over Platt scaling or
    isotonic regression because it cannot change the argmax — so accuracy is
    untouched and only the confidence is corrected. That property matters here:
    the abstention threshold is applied to the calibrated confidence, and a
    calibration that reshuffled predictions would make the two interact.
    """
    lg = torch.tensor(logits, dtype=torch.float32)
    yy = torch.tensor(y, dtype=torch.long)
    log_T = torch.zeros(1, requires_grad=True)  # optimise log T to keep T > 0
    opt = torch.optim.LBFGS([log_T], lr=0.1, max_iter=200)

    def closure():
        opt.zero_grad()
        loss = F.cross_entropy(lg / torch.exp(log_T), yy)
        loss.backward()
        return loss

    opt.step(closure)
    return float(torch.exp(log_T).item())


def softmax(logits: np.ndarray, T: float = 1.0) -> np.ndarray:
    z = logits / T
    z = z - z.max(axis=1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=1, keepdims=True)


def expected_calibration_error(conf: np.ndarray, correct: np.ndarray, bins: int = 15) -> tuple[float, list]:
    """Standard binned ECE, plus the per-bin rows a reliability diagram needs."""
    edges = np.linspace(0.0, 1.0, bins + 1)
    ece, rows = 0.0, []
    n = len(conf)
    for i in range(bins):
        lo, hi = edges[i], edges[i + 1]
        m = (conf > lo) & (conf <= hi) if i > 0 else (conf >= lo) & (conf <= hi)
        cnt = int(m.sum())
        if cnt == 0:
            rows.append({"bin_lo": round(lo, 3), "bin_hi": round(hi, 3), "count": 0,
                         "avg_confidence": None, "accuracy": None})
            continue
        acc = float(correct[m].mean())
        avg = float(conf[m].mean())
        ece += (cnt / n) * abs(acc - avg)
        rows.append({"bin_lo": round(lo, 3), "bin_hi": round(hi, 3), "count": cnt,
                     "avg_confidence": round(avg, 4), "accuracy": round(acc, 4)})
    return float(ece), rows


# --------------------------------------------------------------------------
# abstention
# --------------------------------------------------------------------------

def choose_abstention_threshold(conf: np.ndarray, correct: np.ndarray,
                                abstain_rate: float = 0.05,
                                target_accuracy: float = 0.90,
                                selected_on: str = "CS-D validation split only") -> dict:
    """Pick the confidence floor below which the app says "retake the photo".

    SELECTION RULE: the lowest threshold whose accuracy-on-accepted reaches
    `target_accuracy` on validation, floored by a small quantile of validation
    confidence.

    This rule was tried once before and abandoned, for a reason that has since
    been fixed rather than argued away. It degenerated: validation accuracy was
    0.9964 at threshold 0.0, so the rule chose 0.0 and the mechanism could never
    fire. The cause was that validation contained nothing hard — every image in
    it was a studio photograph of a detached leaf, so there was no confidence at
    which the model became unreliable, and the question had no answer.

    Validation now contains simulated field photographs at the same rate as
    training (ml/tea/fieldsim.py), so the question has an answer: there IS a
    confidence below which this model gets field-like inputs wrong. Asking where
    accuracy falls below target is now the right question, and it produces a
    floor that admits far more real photographs than a quantile of studio-image
    confidence ever could.

    The quantile is retained as a FLOOR, so a run whose validation happened to
    be easy cannot produce a threshold of 0 and silently disable abstention.

    Coverage on the test sets is REPORTED as an outcome; it is never used to
    choose the threshold.
    """
    # A fine grid over the top of the range: up there a hundredth of confidence
    # is the difference between answering a farmer and telling them to take the
    # photograph again.
    grid = np.unique(np.concatenate([
        np.arange(0.0, 1.0, 0.01),
        np.linspace(0.90, 0.9999, 200),
    ]))
    curve = []
    for t in grid:
        m = conf >= t
        curve.append({"threshold": round(float(t), 4), "coverage": round(float(m.mean()), 4),
                      "accuracy_on_accepted": round(float(correct[m].mean()), 4) if m.any() else None})

    # `coverage >= 0.02` stops the rule picking a threshold so high that it is
    # satisfied by a handful of images and answers nobody.
    acc_rule = next((r["threshold"] for r in curve
                     if r["accuracy_on_accepted"] is not None
                     and r["coverage"] >= 0.02
                     and r["accuracy_on_accepted"] >= target_accuracy), None)
    quantile_floor = float(np.quantile(conf, abstain_rate / 4))
    thr = max(acc_rule if acc_rule is not None else 0.0, quantile_floor)

    acc_mask = conf >= thr
    return {
        "threshold": round(float(thr), 4),
        "selection_rule": (
            f"Lowest threshold whose accuracy-on-accepted reaches {target_accuracy:.0%} on a "
            f"validation set that includes simulated field photographs, floored at the "
            f"{abstain_rate / 4:.2%} quantile of validation confidence so abstention can never "
            f"be disabled outright."),
        "selected_on": selected_on,
        "target_accuracy": target_accuracy,
        "accuracy_rule_chose": acc_rule,
        "quantile_floor": round(quantile_floor, 4),
        "validation_coverage": round(float(acc_mask.mean()), 4),
        "validation_accuracy_on_accepted": round(float(correct[acc_mask].mean()), 4),
        "validation_accuracy_on_abstained": (
            round(float(correct[~acc_mask].mean()), 4) if (~acc_mask).any() else None),
        "superseded_rule": {
            "rule": f"the {abstain_rate:.0%} quantile of in-distribution validation confidence",
            "why_superseded": (
                "It was chosen when validation contained only studio photographs, where the "
                "accuracy-target rule degenerated to 0. It answers 'how confident is this model "
                "normally?' rather than 'when is this model wrong?'. On studio confidences it "
                "produced a floor of 0.9976, which rejected roughly two thirds of both "
                "cross-dataset sets, including images the model had in fact classified "
                "correctly."),
        },
        "risk_coverage_curve": curve,
    }


# --------------------------------------------------------------------------
# metrics
# --------------------------------------------------------------------------

def evaluate_set(name: str, logits: np.ndarray, y: np.ndarray, T: float,
                 tax: Taxonomy, abstain_threshold: float) -> dict:
    from sklearn.metrics import (confusion_matrix, f1_score, precision_recall_fscore_support,
                                 precision_score, recall_score)

    keys = tax.keys
    probs = softmax(logits, T)
    pred = probs.argmax(1)
    conf = probs.max(1)
    correct = (pred == y).astype(float)

    present = sorted(set(int(v) for v in np.unique(y)))
    absent = [i for i in range(len(keys)) if i not in present]

    # Macro metrics are computed over the classes PRESENT in this test set.
    # Averaging in classes with zero support would silently drag the macro
    # figure toward zero and make two test sets look incomparable for a reason
    # that has nothing to do with the model.
    p, r, f1, sup = precision_recall_fscore_support(
        y, pred, labels=present, zero_division=0)

    per_class = {}
    for idx, ci in enumerate(present):
        m = y == ci
        c_conf, c_corr = conf[m], correct[m]
        c_ece, _ = expected_calibration_error(c_conf, c_corr)
        per_class[keys[ci]] = {
            "support": int(sup[idx]),
            "precision": round(float(p[idx]), 4),
            "recall": round(float(r[idx]), 4),
            "f1": round(float(f1[idx]), 4),
            "mean_confidence": round(float(c_conf.mean()), 4),
            "ece": round(c_ece, 4),
        }

    ece, bins = expected_calibration_error(conf, correct)
    acc_mask = conf >= abstain_threshold
    return {
        "test_set": name,
        "samples": int(len(y)),
        "classes_present": [keys[i] for i in present],
        "classes_absent": [keys[i] for i in absent],
        "accuracy": round(float(correct.mean()), 4),
        "macro_precision": round(float(precision_score(y, pred, labels=present, average="macro", zero_division=0)), 4),
        "macro_recall": round(float(recall_score(y, pred, labels=present, average="macro", zero_division=0)), 4),
        "macro_f1": round(float(f1_score(y, pred, labels=present, average="macro", zero_division=0)), 4),
        "per_class": per_class,
        # Full 6x6 so predictions INTO absent classes are visible rather than dropped.
        "confusion_matrix": {
            "labels": keys,
            "rows_true_cols_pred": confusion_matrix(y, pred, labels=list(range(len(keys)))).tolist(),
        },
        "calibration": {"temperature": round(T, 4), "ece": round(ece, 4),
                        "reliability_bins": bins, "mean_confidence": round(float(conf.mean()), 4)},
        "abstention": {
            "threshold": abstain_threshold,
            "coverage": round(float(acc_mask.mean()), 4),
            "accuracy_on_accepted": round(float(correct[acc_mask].mean()), 4) if acc_mask.any() else None,
            "abstained": int((~acc_mask).sum()),
        },
    }


def reliability_plot(results: list[dict], path: Path) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, axes = plt.subplots(1, len(results), figsize=(5 * len(results), 4.6), squeeze=False)
    for ax, res in zip(axes[0], results):
        rows = [b for b in res["calibration"]["reliability_bins"] if b["count"] > 0]
        xs = [b["avg_confidence"] for b in rows]
        ys = [b["accuracy"] for b in rows]
        ws = [b["count"] for b in rows]
        ax.plot([0, 1], [0, 1], "--", color="#999", lw=1, label="perfect calibration")
        ax.scatter(xs, ys, s=[12 + 200 * w / max(ws) for w in ws], color="#0f6b46", alpha=0.8, zorder=3)
        ax.plot(xs, ys, color="#0f6b46", lw=1.2, alpha=0.7)
        ax.set_title(f"{res['test_set']}\nECE={res['calibration']['ece']:.4f}  n={res['samples']}", fontsize=10)
        ax.set_xlabel("mean predicted confidence")
        ax.set_ylabel("observed accuracy")
        ax.set_xlim(0, 1); ax.set_ylim(0, 1)
        ax.grid(alpha=0.25)
        ax.legend(fontsize=7, loc="upper left")
    fig.suptitle("Reliability — each test set separately, never pooled", fontsize=11)
    fig.tight_layout()
    fig.savefig(path, dpi=130)
    plt.close(fig)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csd", required=True)
    ap.add_argument("--ewu", required=True)
    ap.add_argument("--tld", required=True)
    ap.add_argument("--checkpoint", default=str(OUT / "tea-mnv3s-best.pt"))
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--target-accuracy", type=float, default=0.95)
    ap.add_argument("--abstain-rate", type=float, default=0.05,
                    help="Sets the quantile FLOOR under the accuracy-target rule.")
    ap.add_argument("--field-prob", type=float, default=1.0,
                    help="Fraction of the simulated sets rendered as field photographs. "
                         "1.0 means the simulated validation/test sets are entirely simulated; "
                         "they are separate sets, not a replacement for the clean ones.")
    ap.add_argument("--field-backgrounds", type=int, default=192)
    ap.add_argument("--field-donors", type=int, default=160)
    a = ap.parse_args()

    seed_everything()
    tax = Taxonomy()
    ck = torch.load(a.checkpoint, map_location="cpu", weights_only=False)
    img_size = ck["preprocessing"]["image_size"]
    _, eval_tf, _ = build_transforms(img_size)

    model = build_model(len(tax.active))
    model.load_state_dict(ck["model"])
    model.eval()
    print(f"loaded {a.checkpoint} (epoch {ck['epoch']}, val_macro_f1={ck['val_macro_f1']:.4f}, {img_size}px)")

    csd = load_csd(a.csd, tax)
    val = [s for s in csd if s.split == "val"]
    test1 = [s for s in csd if s.split == "test"]

    # Donors for a simulated set always come from the SAME split as the images
    # being simulated, so no validation or test leaf can appear in a background
    # behind another split's image.
    val_sim = test_sim = None
    if a.field_prob > 0:
        val_sim = FieldSimulator([x.path for x in val], size=img_size,
                                 backgrounds=max(32, a.field_backgrounds // 3),
                                 donors=max(32, a.field_donors // 3), seed=101)
        test_sim = FieldSimulator([x.path for x in test1], size=img_size,
                                  backgrounds=a.field_backgrounds, donors=a.field_donors, seed=202)

    # ---- STEP 1: calibration + abstention, VALIDATION ONLY -----------------
    print(f"\ncalibrating on {len(val)} validation images (no test data touched)…")
    vlog, vy = collect_logits(model, val, eval_tf, workers=a.workers)
    T = fit_temperature(vlog, vy)
    vprobs = softmax(vlog, T)
    vconf, vcorrect = vprobs.max(1), (vprobs.argmax(1) == vy).astype(float)
    v_ece_before, _ = expected_calibration_error(softmax(vlog, 1.0).max(1), vcorrect)
    v_ece_after, v_bins = expected_calibration_error(vconf, vcorrect)

    # The threshold is chosen on clean AND simulated-field validation together.
    # Choosing it on clean validation alone is what produced 0.9976 and an app
    # that refused to answer two photographs in three: a floor set by how
    # confident the model is on studio images says nothing about when it is
    # WRONG on the images it will actually be shown.
    if val_sim is not None:
        print(f"  + {len(val)} simulated-field validation images for the abstention rule…")
        fvlog, fvy = collect_logits(model, val, eval_tf, workers=a.workers,
                                    field_sim=val_sim, field_prob=a.field_prob)
        fvprobs = softmax(fvlog, T)
        sel_conf = np.concatenate([vconf, fvprobs.max(1)])
        sel_correct = np.concatenate([vcorrect, (fvprobs.argmax(1) == fvy).astype(float)])
        selected_on = "CS-D validation split, clean and simulated-field (50/50)"
    else:
        sel_conf, sel_correct = vconf, vcorrect
        selected_on = "CS-D validation split only (clean)"
    abst = choose_abstention_threshold(sel_conf, sel_correct, a.abstain_rate,
                                       a.target_accuracy, selected_on)
    print(f"  temperature T={T:.4f}   val ECE {v_ece_before:.4f} -> {v_ece_after:.4f}")
    print(f"  abstention threshold={abst['threshold']}  ({abst['selection_rule']})")
    print(f"  validation coverage={abst['validation_coverage']:.4f} "
          f"acc@accepted={abst['validation_accuracy_on_accepted']:.4f} "
          f"acc@abstained={abst['validation_accuracy_on_abstained']}")

    # ---- STEP 2: model frozen. Each test set scored exactly once. ----------
    results = []
    suites = [
        ("Test 1 — CS-D internal (in-distribution, studio)", test1, None),
        ("Test 2 — EWU cross-dataset (studio, detached leaf)", load_ewu(a.ewu, tax), None),
        ("Test 3 — TLD-BD cross-dataset (studio, detached leaf)", load_tld(a.tld, tax), None),
    ]
    if test_sim is not None:
        # Held-out CS-D groups, rendered as field photographs with donors drawn
        # only from those same held-out groups.
        suites.append(("Test 4 — CS-D test groups, SIMULATED field conditions", test1, test_sim))

    for name, samples, sim in suites:
        print(f"\nscoring: {name}  ({len(samples)} images)")
        lg, yy = collect_logits(model, samples, eval_tf, workers=a.workers,
                                field_sim=sim, field_prob=a.field_prob if sim else 0.0)
        res = evaluate_set(name, lg, yy, T, tax, abst["threshold"])
        results.append(res)
        print(f"  acc={res['accuracy']:.4f} macroF1={res['macro_f1']:.4f} "
              f"ECE={res['calibration']['ece']:.4f} "
              f"coverage={res['abstention']['coverage']:.3f} "
              f"acc@accepted={res['abstention']['accuracy_on_accepted']}")
        if res["classes_absent"]:
            print(f"  classes ABSENT from this test set: {res['classes_absent']}")

    reliability_plot(results, OUT / "reliability.png")

    report = {
        "checkpoint": Path(a.checkpoint).name,
        "selected_epoch": ck["epoch"],
        "selection_metric": "validation macro-F1",
        "validation": {
            "samples": int(len(vy)),
            "accuracy": round(float(vcorrect.mean()), 4),
            "ece_before_calibration": round(v_ece_before, 4),
            "ece_after_calibration": round(v_ece_after, 4),
            "reliability_bins": v_bins,
        },
        "calibration": {"method": "temperature scaling (Guo et al. 2017)",
                        "temperature": round(T, 4),
                        "fitted_on": "CS-D validation split only",
                        "note": "Does not change argmax, so accuracy is unaffected and only confidence is corrected."},
        "abstention": abst,
        "tests": results,
        "no_cross_dataset_evidence_for": ["blister_blight", "red_rust"],
        "no_cross_dataset_evidence_note": (
            "Neither class appears in any external dataset in the audited corpus. Their only "
            "numbers come from Test 1, which shares CS-D's domain, preprocessing and capture "
            "conditions. They are NOT cross-dataset validated and must not be described as such."),
        "field_simulation": ({"probability": a.field_prob, "steps": FIELD_SPEC}
                             if a.field_prob > 0 else None),
        "domain_note": (
            "CS-D, EWU and TLD-BD are all studio sets: a detached leaf on white paper or cloth, "
            "evenly lit, filling the frame. None of them is field imagery, and an earlier version "
            "of this report described TLD-BD as a field set, which was wrong. Test 4 is simulated "
            "and is not evidence about real photographs; the real-field number is unmeasured."),
        "never_pool_note": (
            "The test sets measure different things and are never combined into a single "
            "headline metric."),
    }
    (OUT / "evaluation.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"\nwrote {OUT / 'evaluation.json'} and reliability.png")


if __name__ == "__main__":
    main()
