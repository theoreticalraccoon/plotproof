"""STAC search against the configured source, behind a thin interface so the
source can be swapped (Planetary Computer now; Copernicus Data Space later)
without touching callers. Returns lightweight Scene descriptors. Asset hrefs are
signed here (Planetary Computer requires a short-lived SAS token) and are only
used immediately for a download — they are never cached.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict

import planetary_computer as pc
from pystac_client import Client

import config


@dataclass
class Scene:
    item_id: str
    datetime: str            # full ISO timestamp
    date: str                # YYYY-MM-DD (acquisition day)
    cloud_cover: float       # scene-level eo:cloud_cover (%)
    processing_baseline: float  # drives the L2A radiometric offset (see imagery.py)
    crs: str | None          # scene CRS, e.g. "EPSG:32644", from proj:epsg
    assets: dict             # asset key -> signed href (empty when loaded from cache)

    # metadata-only view for the search cache (hrefs deliberately dropped)
    def meta(self) -> dict:
        d = asdict(self)
        d["assets"] = sorted(self.assets.keys())
        return d

    @classmethod
    def from_meta(cls, d: dict) -> "Scene":
        return cls(
            item_id=d["item_id"],
            datetime=d["datetime"],
            date=d["date"],
            cloud_cover=d["cloud_cover"],
            processing_baseline=d["processing_baseline"],
            crs=d.get("crs"),
            assets={},  # no hrefs from cache; only used when arrays are already on disk
        )


@dataclass
class S1Scene:
    """A Sentinel-1 RTC scene (radiometrically terrain-corrected gamma-0)."""
    item_id: str
    datetime: str
    date: str
    orbit_state: str          # ascending / descending — affects viewing geometry
    relative_orbit: int | None
    crs: str | None
    assets: dict              # vv / vh -> signed href (empty when loaded from cache)

    def meta(self) -> dict:
        d = asdict(self)
        d["assets"] = sorted(self.assets.keys())
        return d

    @classmethod
    def from_meta(cls, d: dict) -> "S1Scene":
        return cls(
            item_id=d["item_id"], datetime=d["datetime"], date=d["date"],
            orbit_state=d["orbit_state"], relative_orbit=d.get("relative_orbit"),
            crs=d.get("crs"), assets={},
        )


def _client() -> Client:
    # sign_inplace rewrites each asset href with a SAS token as items stream in.
    return Client.open(config.STAC_ENDPOINT, modifier=pc.sign_inplace)


def search_s1_rtc(bbox, date_range: str) -> list[S1Scene]:
    """Live search of the Sentinel-1 RTC collection. RTC is already terrain
    corrected and gridded in UTM at 10 m, so downstream we only warp it onto the
    optical grid — no DEM/Range-Doppler step of our own."""
    search = _client().search(collections=["sentinel-1-rtc"], bbox=bbox, datetime=date_range)
    scenes: list[S1Scene] = []
    for it in search.items():
        p = it.properties
        epsg = p.get("proj:epsg")
        scenes.append(
            S1Scene(
                item_id=it.id,
                datetime=it.datetime.isoformat(),
                date=it.datetime.date().isoformat(),
                orbit_state=p.get("sat:orbit_state", "?"),
                relative_orbit=p.get("sat:relative_orbit"),
                crs=f"EPSG:{epsg}" if epsg else None,
                assets={k: it.assets[k].href for k in ("vv", "vh") if k in it.assets},
            )
        )
    scenes.sort(key=lambda s: s.datetime)
    return scenes


def search_scenes(bbox, date_range: str, cloud_lt: float) -> list[Scene]:
    """Live STAC search. Sorted by acquisition date ascending (client-side, so we
    don't depend on the server honouring a sortby)."""
    search = _client().search(
        collections=[config.COLLECTION],
        bbox=bbox,
        datetime=date_range,
        query={"eo:cloud_cover": {"lt": cloud_lt}},
    )
    scenes: list[Scene] = []
    need = set(config.BANDS + [config.SCL_BAND])
    for it in search.items():
        # s2:processing_baseline as a float; >= 4.00 means the +1000 offset applies.
        baseline = float(it.properties.get("s2:processing_baseline", 0) or 0)
        epsg = it.properties.get("proj:epsg")
        scenes.append(
            Scene(
                item_id=it.id,
                datetime=it.datetime.isoformat(),
                date=it.datetime.date().isoformat(),
                cloud_cover=float(it.properties.get("eo:cloud_cover", -1)),
                processing_baseline=baseline,
                crs=f"EPSG:{epsg}" if epsg else None,
                assets={k: it.assets[k].href for k in need if k in it.assets},
            )
        )
    scenes.sort(key=lambda s: s.datetime)
    return scenes
