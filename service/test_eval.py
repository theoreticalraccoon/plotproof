"""Metric-math + grouping correctness for the eval harness. Run:
    ./.venv/Scripts/python.exe test_eval.py
"""
import numpy as np

from eval import (Metrics, Sample, by_country, by_country_type, pixel_counts,
                  plantation_confusion, size_bucket_metrics)

passed = 0
def test(name, fn):
    global passed
    try:
        fn(); passed += 1; print(f"  ok  {name}")
    except Exception as e:
        print(f"FAIL  {name}\n      {e}"); raise SystemExit(1)


def _close(a, b, t=1e-9):
    assert abs(a - b) < t, f"{a} != {b}"


def _known():
    pred = np.array([[1, 1], [1, 1]], bool)
    truth = np.array([[1, 0], [1, 0]], bool)          # 2 forest px, 2 non-forest
    m = pixel_counts(pred, truth)
    assert (m.tp, m.fp, m.fn, m.tn) == (2, 2, 0, 0), (m.tp, m.fp, m.fn, m.tn)
    _close(m.precision, 0.5); _close(m.recall, 1.0); _close(m.f1, 2 / 3); _close(m.iou, 0.5)
    assert m.support == 2
test("precision/recall/F1/IoU on a known 2x2", _known)

def _perfect():
    t = np.array([[1, 0], [0, 1]], bool)
    m = pixel_counts(t, t)
    _close(m.precision, 1.0); _close(m.recall, 1.0); _close(m.f1, 1.0)
test("perfect prediction -> P=R=F1=1", _perfect)

def _empty_group():
    m = Metrics()  # no data
    assert m.precision != m.precision  # nan
    assert m.support == 0
test("empty group yields nan metrics + zero support (shows as a gap)", _empty_group)

def _grouping():
    z = np.zeros((4, 4), bool); o = np.ones((4, 4), bool)
    samples = [
        Sample(o, o, "LK", "tropical_moist", 1.0, "fused"),
        Sample(z, o, "LK", "plantation", 1.0, "fused"),
        Sample(o, o, "ID", "tropical_moist", 1.0, "optical"),
    ]
    bc = by_country(samples)
    assert set(bc) == {"LK", "ID"}
    _close(bc["ID"].recall, 1.0)
    _close(bc["LK"].recall, 16 / 32)  # one all-hit chip, one all-miss chip (16 forest px each)
    assert set(by_country_type(samples)) == {("LK", "tropical_moist"), ("LK", "plantation"), ("ID", "tropical_moist")}
test("grouping partitions by country and country x type", _grouping)

def _sizes():
    plots = [(True, True, 0.15), (True, True, 0.3), (False, True, 0.3), (True, True, 8.0)]
    b = size_bucket_metrics(plots)
    assert b["0.2-0.5 ha"].tp == 1 and b["0.2-0.5 ha"].fn == 1     # one hit, one miss
    assert b["0.0-0.2 ha"].tp == 1
    _close(b["0.2-0.5 ha"].recall, 0.5)
test("plot-size buckets assign and score correctly", _sizes)

def _plant():
    z = np.zeros((8, 8), bool); o = np.ones((8, 8), bool)
    samples = [
        Sample(o, o, "ID", "plantation", 1.0, "fused"),       # predicts forest on plantation
        Sample(o, o, "ID", "plantation", 1.0, "fused"),
        Sample(o, o, "LK", "tropical_moist", 1.0, "fused"),   # predicts forest on natural
        Sample(z, o, "LK", "montane", 1.0, "fused"),          # predicts non-forest on natural
    ]
    r = plantation_confusion(samples)
    assert r["plantation"] == [2, 0], r["plantation"]         # both plantation chips -> forest
    assert r["natural_forest"] == [1, 1], r["natural_forest"]
test("plantation confusion tallies region-tag level", _plant)


print(f"\n{passed} passed")
