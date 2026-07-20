"""Forest-fraction time series + change detection — deliberately OUTSIDE the network,
as ordinary readable Python. This is the part an auditor will question, so it is plain
arithmetic over a per-plot time series, not weights: apply the country's forest
definition, require a sustained drop across several observations before flagging,
estimate the clearing window, and return `insufficient_data` honestly.

The network's only job is to turn each date's imagery into a per-pixel forest
probability; `forest_fraction()` reduces that to one number per date, and
`detect_change()` decides. `detect_change` needs only the numeric series, so it is
fully testable without any trained model.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

import numpy as np

from profiles import CountryProfile

CLEAR, FLAGGED, INSUFFICIENT = "clear", "flagged", "insufficient_data"


# --- per-date reduction (the one place the model plugs in) -------------------
def forest_fraction(prob_map: np.ndarray, plot_mask: np.ndarray,
                    valid_mask: np.ndarray, profile: CountryProfile) -> tuple[float, float]:
    """Reduce a per-pixel forest-probability map to (forest_fraction, valid_fraction)
    over the plot, applying the country's per-pixel forest threshold. valid_fraction
    is the cloud-free fraction of the plot on this date."""
    in_plot = plot_mask
    n_plot = int(in_plot.sum())
    if n_plot == 0:
        return 0.0, 0.0
    usable = valid_mask & in_plot
    n_usable = int(usable.sum())
    if n_usable == 0:
        return 0.0, 0.0
    forest = (prob_map >= profile.forest_prob_threshold) & usable
    return float(forest.sum()) / n_usable, float(n_usable) / n_plot


@dataclass
class FfObs:
    """One entry of the forest-fraction time series."""
    date: date
    forest_fraction: float
    valid_fraction: float          # cloud-free fraction of the plot on this date
    sensor: str                    # "S2" (optical) or "S1" (radar) — radar bridges cloud gaps


@dataclass
class ChangeResult:
    verdict: str
    confidence: float
    reason: str
    clearing_window: tuple[str, str] | None = None   # (last clear-forest date, first clear-cleared date)
    cleared_area_ha: float | None = None
    baseline_fraction: float | None = None
    post_fraction: float | None = None
    n_usable: int = 0
    max_gap_days: int | None = None
    observed_through: str | None = None              # latest usable acquisition date
    series: list[FfObs] = field(default_factory=list)


def _as_date(d) -> date:
    return d if isinstance(d, date) else date.fromisoformat(str(d))


def _max_gap_days(dates: list[date]) -> int:
    if len(dates) < 2:
        return 0
    return max((dates[i + 1] - dates[i]).days for i in range(len(dates) - 1))


def detect_change(series: list[FfObs], profile: CountryProfile, plot_area_ha: float) -> ChangeResult:
    """Decide clear / flagged / insufficient_data from the forest-fraction series."""
    obs = sorted(series, key=lambda o: _as_date(o.date))
    for o in obs:
        o.date = _as_date(o.date)
    cutoff = _as_date(profile.deforestation_cutoff)

    # (A) plot too small for 10 m imagery to resolve honestly
    if plot_area_ha < profile.min_plot_area_ha:
        return ChangeResult(INSUFFICIENT, 0.0,
                            f"plot {plot_area_ha:.2f} ha is below ~{profile.min_plot_area_ha} ha, "
                            f"the edge of what 10 m imagery resolves", series=obs)

    # usable dates: enough of the plot cloud-free. Radar (S1) is inherently cloud-free,
    # so its observations bridge optical gaps here just by being usable.
    usable = [o for o in obs if o.valid_fraction >= profile.min_valid_fraction]
    observed_through = usable[-1].date.isoformat() if usable else None

    # (B) too few usable observations to establish a baseline and a confirmed run
    need = profile.persistence_obs + 2
    if len(usable) < need:
        return ChangeResult(INSUFFICIENT, 0.0,
                            f"only {len(usable)} usable observations (need >= {need})",
                            n_usable=len(usable), observed_through=observed_through, series=obs)

    # (C) cloud gap too large to bridge — even counting radar. If radar filled the gap
    # it would appear as a usable observation and shrink this number.
    gap = _max_gap_days([o.date for o in usable])
    if gap > profile.max_bridge_gap_days:
        return ChangeResult(INSUFFICIENT, 0.0,
                            f"a {gap}-day gap between usable observations exceeds the "
                            f"{profile.max_bridge_gap_days}-day limit and radar did not bridge it",
                            n_usable=len(usable), max_gap_days=gap,
                            observed_through=observed_through, series=obs)

    fractions = np.array([o.forest_fraction for o in usable])
    # (D) robust "forested" baseline = median of the upper half of the record
    baseline = float(np.median(np.sort(fractions)[len(fractions) // 2:]))

    # plot was never forest over the record → nothing to deforest
    if baseline < profile.forest_fraction_drop:  # baseline too low to even define a drop
        return ChangeResult(CLEAR, _clear_confidence(usable, gap),
                            "plot not forested over the observed record; no forest loss to detect",
                            baseline_fraction=baseline, n_usable=len(usable), max_gap_days=gap,
                            observed_through=observed_through, series=obs)

    cleared_level = baseline - profile.forest_fraction_drop

    # (E) earliest sustained drop: persistence_obs consecutive usable dates all below the level
    k = profile.persistence_obs
    start = None
    for i in range(len(usable) - k + 1):
        if all(usable[j].forest_fraction <= cleared_level for j in range(i, i + k)):
            start = i
            break

    if start is None:
        return ChangeResult(CLEAR, _clear_confidence(usable, gap),
                            "forest cover stable; no drop sustained across "
                            f"{k} consecutive observations", baseline_fraction=baseline,
                            n_usable=len(usable), max_gap_days=gap,
                            observed_through=observed_through, series=obs)

    # (F) clearing window: last still-forested date before the drop → first cleared date
    first_cleared = usable[start].date
    forested_level = baseline - profile.forest_fraction_drop / 2  # "still forested" band
    last_forest = usable[0].date
    for j in range(start - 1, -1, -1):
        if usable[j].forest_fraction >= forested_level:
            last_forest = usable[j].date
            break

    # (G) cleared area, filtered by the minimum mapping unit (min forest area)
    post = float(np.mean([o.forest_fraction for o in usable[start:]]))
    cleared_area_ha = max(0.0, baseline - post) * plot_area_ha
    if cleared_area_ha < profile.min_forest_area_ha:
        return ChangeResult(CLEAR, _clear_confidence(usable, gap),
                            f"forest-loss area {cleared_area_ha:.2f} ha is below the "
                            f"{profile.min_forest_area_ha} ha minimum mapping unit",
                            baseline_fraction=baseline, post_fraction=post, n_usable=len(usable),
                            max_gap_days=gap, observed_through=observed_through, series=obs)

    # (H) EUDR: only clearing AFTER the cutoff is a violation
    window = (last_forest.isoformat(), first_cleared.isoformat())
    if first_cleared <= cutoff:
        return ChangeResult(CLEAR, _clear_confidence(usable, gap),
                            f"forest loss detected but before the {cutoff.isoformat()} cutoff "
                            f"(pre-cutoff clearing is not a violation)",
                            clearing_window=window, cleared_area_ha=round(cleared_area_ha, 3),
                            baseline_fraction=baseline, post_fraction=post, n_usable=len(usable),
                            max_gap_days=gap, observed_through=observed_through, series=obs)

    return ChangeResult(FLAGGED, _flag_confidence(usable, start, baseline, post, gap, profile),
                        f"sustained forest loss confirmed over >= {k} observations, after the cutoff",
                        clearing_window=window, cleared_area_ha=round(cleared_area_ha, 3),
                        baseline_fraction=baseline, post_fraction=post, n_usable=len(usable),
                        max_gap_days=gap, observed_through=observed_through, series=obs)


# --- transparent confidence formulas (documented, not a model score) ---------
def _clear_confidence(usable, gap) -> float:
    density = min(1.0, len(usable) / 12.0)         # more observations → more trust
    freshness = 1.0 if gap <= 30 else 0.6          # small gaps → more trust
    return round(0.5 + 0.35 * density * freshness, 3)


def _flag_confidence(usable, start, baseline, post, gap, profile) -> float:
    drop_mag = min(1.0, (baseline - post) / (2 * profile.forest_fraction_drop))
    extra_persist = min(1.0, (len(usable) - start - profile.persistence_obs) / 3.0 + 0.0)
    density = min(1.0, len(usable) / 12.0)
    return round(min(0.95, 0.4 + 0.25 * drop_mag + 0.2 * max(0.0, extra_persist) + 0.15 * density), 3)
