"""Evaluation harness - precision/recall against Hansen, broken out and NEVER as one
global average. A single headline number hides the regional weakness a judge will
probe, and a suspiciously uniform score reads as untested (ML.md).

This is the reporting code only. It consumes predictions + Hansen-derived truth and
emits the tables. It produces real numbers ONLY when fed a real trained model's
predictions on held-out regions - which do not exist yet. `demo()` runs it on
clearly-labelled SYNTHETIC predictions purely to show the shape of the output.

Positive class for the pixel metrics is "forest" (the network's per-pixel job).
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

SIZE_BUCKETS = [(0.0, 0.2), (0.2, 0.5), (0.5, 1.0), (1.0, 5.0), (5.0, 1e9)]
NATURAL_STRATA = {"tropical_moist", "dry_deciduous", "montane", "mangrove"}
LOW_SUPPORT = 5000  # pixels; cells below this are flagged as thin, not trusted


@dataclass
class Metrics:
    tp: int = 0
    fp: int = 0
    fn: int = 0
    tn: int = 0

    def add(self, other: "Metrics") -> "Metrics":
        return Metrics(self.tp + other.tp, self.fp + other.fp, self.fn + other.fn, self.tn + other.tn)

    @property
    def precision(self):
        d = self.tp + self.fp
        return self.tp / d if d else float("nan")

    @property
    def recall(self):
        d = self.tp + self.fn
        return self.tp / d if d else float("nan")

    @property
    def f1(self):
        p, r = self.precision, self.recall
        return 2 * p * r / (p + r) if (p == p and r == r and (p + r) > 0) else float("nan")

    @property
    def iou(self):
        d = self.tp + self.fp + self.fn
        return self.tp / d if d else float("nan")

    @property
    def support(self):        # actual positive (forest) pixels - the "how much to trust this row"
        return self.tp + self.fn

    @property
    def n(self):
        return self.tp + self.fp + self.fn + self.tn


def pixel_counts(pred_forest: np.ndarray, truth_forest: np.ndarray) -> Metrics:
    p = np.asarray(pred_forest, bool)
    t = np.asarray(truth_forest, bool)
    return Metrics(int((p & t).sum()), int((p & ~t).sum()),
                   int((~p & t).sum()), int((~p & ~t).sum()))


# --- a sample = one chip's prediction + Hansen truth + metadata ---------------
@dataclass
class Sample:
    pred_forest: np.ndarray   # (H,W) bool: model forest at threshold
    truth_forest: np.ndarray  # (H,W) bool: Hansen-derived forest
    country: str
    forest_type: str          # stratum
    plot_area_ha: float
    modality: str             # "fused" | "optical" | "radar"


def group_metrics(samples: list[Sample], key) -> dict:
    out: dict = {}
    for s in samples:
        k = key(s)
        out[k] = out.get(k, Metrics()).add(pixel_counts(s.pred_forest, s.truth_forest))
    return out


def by_country(samples):     return group_metrics(samples, lambda s: s.country)
def by_forest_type(samples): return group_metrics(samples, lambda s: s.forest_type)
def by_country_type(samples): return group_metrics(samples, lambda s: (s.country, s.forest_type))


def fused_vs_optical(samples) -> dict:
    """Overall metrics for each modality present, side by side (ML.md)."""
    out: dict = {}
    for s in samples:
        out[s.modality] = out.get(s.modality, Metrics()).add(pixel_counts(s.pred_forest, s.truth_forest))
    return out


def size_bucket_metrics(plot_samples) -> dict:
    """Per-plot verdict quality by plot-size bucket. plot_samples: iterable of
    (pred_flagged: bool, truth_flagged: bool, area_ha: float). Positive = flagged."""
    out = {f"{lo}-{hi if hi < 1e9 else '+'} ha": Metrics() for lo, hi in SIZE_BUCKETS}
    labels = list(out.keys())
    for pred, truth, area in plot_samples:
        for i, (lo, hi) in enumerate(SIZE_BUCKETS):
            if lo <= area < hi:
                m = out[labels[i]]
                out[labels[i]] = m.add(Metrics(int(pred and truth), int(pred and not truth),
                                               int(not pred and truth), int(not pred and not truth)))
                break
    return out


def plantation_confusion(samples) -> dict:
    """Region-tag-level indicator of the plantation-vs-natural-forest confusion.

    HONEST LIMITATION: we have no per-pixel plantation ground truth (WorldCover and
    Hansen both call mature plantation 'forest'), so this cannot be a pixel confusion
    matrix. It measures, per chip, how often the model calls the chip 'forest' -
    split by whether the chip is from a plantation region or a natural-forest region.
    A model that cannot tell them apart shows a HIGH forest rate for BOTH rows; that
    equality is the failure the regulation cares about.
    """
    rows = {"plantation": [0, 0], "natural_forest": [0, 0]}  # [predicted_forest, predicted_nonforest]
    for s in samples:
        group = "plantation" if s.forest_type == "plantation" else (
            "natural_forest" if s.forest_type in NATURAL_STRATA else None)
        if group is None:
            continue
        pred_forest_chip = s.pred_forest.mean() > 0.5
        rows[group][0 if pred_forest_chip else 1] += 1
    return rows


# --- formatting --------------------------------------------------------------
def format_metric_table(title: str, groups: dict) -> str:
    lines = [title, f"  {'group':<28}{'prec':>7}{'recall':>8}{'F1':>7}{'support':>10}  note"]
    for k in sorted(groups, key=lambda x: str(x)):
        m = groups[k]
        note = "LOW SUPPORT - do not trust" if m.support < LOW_SUPPORT else ""
        name = k if isinstance(k, str) else " / ".join(map(str, k))
        lines.append(f"  {name:<28}{m.precision:>7.2f}{m.recall:>8.2f}{m.f1:>7.2f}{m.support:>10}  {note}")
    return "\n".join(lines)


def format_plantation(rows: dict) -> str:
    def rate(r):
        tot = r[0] + r[1]
        return r[0] / tot if tot else float("nan")
    return ("plantation vs natural forest (region-tag level; no per-pixel plantation truth)\n"
            f"  {'true class':<18}{'pred forest':>12}{'pred non-forest':>16}{'forest-rate':>13}\n"
            f"  {'plantation':<18}{rows['plantation'][0]:>12}{rows['plantation'][1]:>16}{rate(rows['plantation']):>13.2f}\n"
            f"  {'natural_forest':<18}{rows['natural_forest'][0]:>12}{rows['natural_forest'][1]:>16}{rate(rows['natural_forest']):>13.2f}\n"
            "  (if the two forest-rates are both high and close, the model cannot separate them)")


def demo():
    """Runs the harness on SYNTHETIC predictions to show the OUTPUT SHAPE ONLY.
    These are NOT model results - the model is not trained."""
    rng = np.random.default_rng(0)
    samples = []
    # deliberately uneven: strong tropical truth, noisy dry-deciduous, plantation
    # 'predicted forest' like natural forest (the confusion), one country thin.
    specs = [
        ("LK", "tropical_moist", 0.95, 0.93, "fused", 6),
        ("LK", "dry_deciduous", 0.80, 0.55, "fused", 4),
        ("LK", "montane", 0.90, 0.85, "fused", 3),
        ("LK", "mangrove", 0.88, 0.80, "fused", 3),
        ("LK", "plantation", 0.92, 0.90, "fused", 6),   # plantation scored as 'forest'
        ("ID", "tropical_moist", 0.94, 0.60, "optical", 5),  # optical-only weaker
        ("ID", "plantation", 0.93, 0.91, "fused", 4),
        ("VN", "tropical_moist", 0.90, 0.88, "fused", 1),    # thin support
    ]
    for country, ft, prec_like, rec_like, mod, nchips in specs:
        for _ in range(nchips):
            truth = rng.random((64, 64)) < (0.85 if ft != "dry_deciduous" else 0.5)
            pred = truth.copy()
            flip = rng.random((64, 64)) < (1 - rec_like)   # misses
            pred[truth & flip] = False
            add = rng.random((64, 64)) < (1 - prec_like) * 0.3
            pred[~truth & add] = True
            samples.append(Sample(pred, truth, country, ft, plot_area_ha=1.0, modality=mod))

    print("=" * 78)
    print("SYNTHETIC DEMONSTRATION - SHOWS THE TABLE SHAPE ONLY.")
    print("These numbers are random placeholders, NOT model performance (no trained model).")
    print("=" * 78)
    print(format_metric_table("\nprecision/recall vs Hansen - per country", by_country(samples)))
    print(format_metric_table("\nper forest type", by_forest_type(samples)))
    print(format_metric_table("\nper country x forest type (note the gaps + thin cells)", by_country_type(samples)))
    print(format_metric_table("\nfused vs optical-only", fused_vs_optical(samples)))
    plots = [(True, True, a) for a in (0.15, 0.3, 0.7, 2.0, 8.0)] + [(True, False, 0.18), (False, True, 0.6)]
    print(format_metric_table("\nby plot-size bucket (verdict-level; positive = flagged)",
                              size_bucket_metrics(plots)))
    print("\n" + format_plantation(plantation_confusion(samples)))


if __name__ == "__main__":
    demo()
