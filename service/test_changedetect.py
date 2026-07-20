"""Change-detection logic — the auditable core, so it is tested hard. Run:
    ./.venv/Scripts/python.exe test_changedetect.py
"""
from datetime import date, timedelta

from changedetect import CLEAR, FLAGGED, INSUFFICIENT, FfObs, detect_change
from profiles import get_profile

P = get_profile("LK")  # cutoff 2020-12-31, drop 0.25, persistence 3, min_area 0.5, min_plot 0.2

passed = 0
def test(name, fn):
    global passed
    try:
        fn(); passed += 1; print(f"  ok  {name}")
    except Exception as e:
        print(f"FAIL  {name}\n      {e}")
        raise SystemExit(1)


def mkseries(fracs, start=date(2021, 1, 1), step=30, valid=0.9, sensor="S2", dates=None):
    return [FfObs(dates[i] if dates else start + timedelta(days=step * i), f, valid, sensor)
            for i, f in enumerate(fracs)]


def _eq(a, b):
    assert a == b, f"{a!r} != {b!r}"


test("stable forest -> clear", lambda: (
    _eq(detect_change(mkseries([0.95] * 8), P, 5.0).verdict, CLEAR)))

def _flagged():
    r = detect_change(mkseries([0.95, 0.95, 0.95, 0.95, 0.2, 0.2, 0.2, 0.2]), P, 5.0)
    _eq(r.verdict, FLAGGED)
    assert r.clearing_window is not None, "expected a clearing window"
    assert r.cleared_area_ha and r.cleared_area_ha > 0.5, r.cleared_area_ha
    # window: last clear-forest before the drop, first cleared after
    assert r.clearing_window[0] < r.clearing_window[1], r.clearing_window
test("sustained drop after cutoff -> flagged, with window + area", _flagged)

test("single hazy dip does NOT flag (persistence)", lambda: (
    _eq(detect_change(mkseries([0.95, 0.95, 0.2, 0.95, 0.95, 0.95, 0.95, 0.95]), P, 5.0).verdict, CLEAR)))

def _small_area():
    r = detect_change(mkseries([0.95, 0.95, 0.95, 0.68, 0.68, 0.68, 0.68]), P, 0.6)
    _eq(r.verdict, CLEAR)
    assert "mapping unit" in r.reason, r.reason
test("real drop but below min mapping unit -> clear", _small_area)

def _tiny_plot():
    r = detect_change(mkseries([0.95] * 8), P, 0.1)
    _eq(r.verdict, INSUFFICIENT)
    assert "0.2" in r.reason or "resolve" in r.reason, r.reason
test("plot under ~0.2 ha -> insufficient_data", _tiny_plot)

def _big_gap():
    r = detect_change(mkseries([0.95] * 6, step=90), P, 5.0)  # 90-day gaps
    _eq(r.verdict, INSUFFICIENT)
    assert "gap" in r.reason, r.reason
test("cloud gap too large to bridge -> insufficient_data", _big_gap)

def _radar_bridged():
    # same wide optical spacing, but S1 fills the midpoints so no gap exceeds the limit
    opt = mkseries([0.95] * 6, start=date(2021, 1, 1), step=90, sensor="S2")
    s1 = mkseries([0.95] * 5, start=date(2021, 1, 1) + timedelta(days=45), step=90, sensor="S1")
    r = detect_change(opt + s1, P, 5.0)
    _eq(r.verdict, CLEAR)  # gaps now bridged; stable forest
    assert r.max_gap_days is not None and r.max_gap_days <= P.max_bridge_gap_days
test("radar bridges the optical gap -> not insufficient", _radar_bridged)

def _pre_cutoff():
    r = detect_change(mkseries([0.95, 0.95, 0.95, 0.95, 0.2, 0.2, 0.2, 0.2],
                               start=date(2019, 6, 1)), P, 5.0)
    _eq(r.verdict, CLEAR)
    assert "cutoff" in r.reason, r.reason
test("clearing before the cutoff -> clear (not a violation)", _pre_cutoff)


print(f"\n{passed} passed")
