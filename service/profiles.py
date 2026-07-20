"""Country profiles — the forest definition and detection knobs, as CONFIGURATION,
never global constants (ML.md, and D-002/D-003 in the web app's DECISIONS.md). A
country can change its forest definition and old verdicts must stay reproducible, so
these are immutable records; the production system versions them.

IMPORTANT: the forest-definition numbers below are placeholders to be VERIFIED
against each country's official national forest definition before any real verdict.
The app never invents law — these are marked for confirmation, not asserted as fact.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CountryProfile:
    code: str
    name: str
    # --- national forest definition (VERIFY per country) ---
    canopy_cover_pct: float      # min canopy cover to be "forest"
    min_forest_area_ha: float    # minimum mapping unit — patches/clearings smaller are ignored
    min_tree_height_m: float     # part of the definition; recorded for the PDF, but NOT
                                 # enforceable from S2/S1 (we can't measure height) — stated plainly
    deforestation_cutoff: str    # assessment date (EUDR default 2020-12-31; per-country override allowed)
    # --- detection knobs (still country-tunable) ---
    forest_prob_threshold: float # per-pixel: model forest probability >= this = forest pixel
    forest_fraction_drop: float  # a sustained drop of this many fraction-points signals clearing
    persistence_obs: int         # consecutive confirming observations required before flagging
    min_valid_fraction: float    # a date counts as usable if this much of the plot is cloud-free
    max_bridge_gap_days: int     # gap between usable obs larger than this (even with radar) → insufficient_data
    min_plot_area_ha: float = 0.2  # below this → insufficient_data (edge of 10 m resolution)


# Detection defaults shared across countries (tune per country as needed).
_DETECTION = dict(
    forest_prob_threshold=0.5,
    forest_fraction_drop=0.25,
    persistence_obs=3,
    min_valid_fraction=0.5,
    max_bridge_gap_days=45,
    min_plot_area_ha=0.2,
)

PROFILES: dict[str, CountryProfile] = {
    # canopy/area/height values below are PLACEHOLDERS — verify against the national
    # forest definition each country submitted for EUDR.
    "LK": CountryProfile("LK", "Sri Lanka", canopy_cover_pct=20, min_forest_area_ha=0.5,
                         min_tree_height_m=5, deforestation_cutoff="2020-12-31", **_DETECTION),
    "ID": CountryProfile("ID", "Indonesia", canopy_cover_pct=30, min_forest_area_ha=0.5,
                         min_tree_height_m=5, deforestation_cutoff="2020-12-31", **_DETECTION),
    "VN": CountryProfile("VN", "Vietnam", canopy_cover_pct=10, min_forest_area_ha=0.5,
                         min_tree_height_m=5, deforestation_cutoff="2020-12-31", **_DETECTION),
}

DEFAULT = PROFILES["LK"]


def get_profile(code: str) -> CountryProfile:
    return PROFILES.get((code or "").upper(), DEFAULT)
