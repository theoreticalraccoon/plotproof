"""Windowed reads, resampling to a fixed plot grid, SCL cloud/shadow masking, and
per-date over-plot metrics. This is where the fiddly geospatial correctness lives,
so the non-obvious bits (CRS, the L2A radiometric offset, band maths) are commented.

Design choice: one fixed output grid per run, in a single reference CRS, and every
scene is warped onto it. That keeps all dates pixel-aligned (so before/after tiles
are comparable) and transparently handles scenes that arrive in different UTM zones.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import rasterio
from pyproj import Transformer
from rasterio.features import geometry_mask
from rasterio.transform import from_origin
from rasterio.vrt import WarpedVRT
from rasterio.warp import Resampling
from shapely.geometry import box as shp_box
from shapely.geometry import mapping, shape
from shapely.ops import transform as shp_transform

import config
from cache import Cache
from stac import Scene

# GDAL knobs for efficient remote COG reads (only the needed window is fetched).
# Allow both .tif (Sentinel-2) and .tiff (Sentinel-1 RTC is `iw-vv.rtc.tiff`);
# restricting to .tif silently blocks the radar reads.
_RASTERIO_ENV = dict(
    GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",
    CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif,.tiff",
    GDAL_HTTP_MULTIPLEX="YES",
    VSI_CACHE="TRUE",
)


@dataclass
class Grid:
    crs: str
    transform: object   # affine.Affine (top-left origin)
    width: int
    height: int
    plot_utm: object     # shapely Polygon in `crs`
    plot_mask: np.ndarray  # bool, True inside the plot polygon

    @property
    def key(self) -> str:
        b = self.plot_utm.bounds
        return f"{self.crs}|{b[0]:.1f}|{b[3]:.1f}|{self.width}|{self.height}|{config.GRID_RES_M}"


def build_grid(geom_wgs84: dict, ref_crs: str) -> Grid:
    """Reproject the WGS84 plot into the reference CRS, buffer it, and snap a
    metre-aligned raster grid around it at GRID_RES_M."""
    poly = shape(geom_wgs84)
    to_ref = Transformer.from_crs("EPSG:4326", ref_crs, always_xy=True).transform
    poly_utm = shp_transform(to_ref, poly)

    res = config.GRID_RES_M
    minx, miny, maxx, maxy = poly_utm.bounds
    minx = np.floor((minx - config.AOI_BUFFER_M) / res) * res
    miny = np.floor((miny - config.AOI_BUFFER_M) / res) * res
    maxx = np.ceil((maxx + config.AOI_BUFFER_M) / res) * res
    maxy = np.ceil((maxy + config.AOI_BUFFER_M) / res) * res

    width = int(round((maxx - minx) / res))
    height = int(round((maxy - miny) / res))
    transform = from_origin(minx, maxy, res, res)  # north-up

    # True inside the plot polygon (invert=True → interior is True).
    plot_mask = geometry_mask(
        [mapping(poly_utm)], out_shape=(height, width), transform=transform, invert=True
    )
    return Grid(ref_crs, transform, width, height, poly_utm, plot_mask)


def utm_epsg(lon: float, lat: float) -> str:
    """The appropriate UTM CRS for a location — the local equal-area-ish grid a
    chip is built in (each chip uses its own zone, so chips anywhere on earth stay
    metric and square)."""
    zone = int((lon + 180) // 6) + 1
    return f"EPSG:{(32600 if lat >= 0 else 32700) + zone}"


def grid_from_center(lon: float, lat: float, size_px: int = config.CHIP_PX,
                     res: float = config.GRID_RES_M) -> Grid:
    """A size_px x size_px grid at `res` m centred on (lon, lat), in the local UTM.
    Used for training chips; the whole chip is the 'plot' (plot_mask all True)."""
    crs = utm_epsg(lon, lat)
    x, y = Transformer.from_crs("EPSG:4326", crs, always_xy=True).transform(lon, lat)
    half = size_px * res / 2.0
    minx = np.floor((x - half) / res) * res
    maxy = np.ceil((y + half) / res) * res
    transform = from_origin(minx, maxy, res, res)
    poly = shp_box(minx, maxy - size_px * res, minx + size_px * res, maxy)
    plot_mask = np.ones((size_px, size_px), dtype=bool)
    return Grid(crs, transform, size_px, size_px, poly, plot_mask)


def _read_to_grid(href: str, grid: Grid, resampling: Resampling) -> np.ndarray:
    """Warp one remote asset onto the fixed grid, reading only the needed window."""
    with rasterio.Env(**_RASTERIO_ENV):
        with rasterio.open(href) as src:
            with WarpedVRT(
                src,
                crs=grid.crs,
                transform=grid.transform,
                width=grid.width,
                height=grid.height,
                resampling=resampling,
            ) as vrt:
                return vrt.read(1)


def load_scene_arrays(scene: Scene, grid: Grid, cache: Cache) -> dict[str, np.ndarray]:
    """Return {asset: array} for a scene, from the on-disk cache when present and
    only downloading (and then caching) on a miss. A warm scene does no network I/O."""
    out: dict[str, np.ndarray] = {}
    for asset in config.BANDS + [config.SCL_BAND]:
        path = cache.array_path(scene.item_id, asset, grid.key)
        arr = cache.load_array(path)
        if arr is None:
            href = scene.assets.get(asset)
            if href is None:
                raise RuntimeError(
                    f"{scene.item_id}: asset {asset} not cached and no signed href "
                    f"available (a live search is needed to refresh it)."
                )
            # SCL is categorical → nearest; reflectance bands → bilinear.
            resampling = Resampling.nearest if asset == config.SCL_BAND else Resampling.bilinear
            arr = _read_to_grid(href, grid, resampling)
            cache.save_array(path, arr)
        out[asset] = arr
    return out


def scl_valid(scl: np.ndarray) -> np.ndarray:
    """Boolean grid: True where the pixel is usable (not cloud/shadow/nodata)."""
    invalid = np.isin(scl.astype(np.int16), list(config.SCL_INVALID))
    return ~invalid


def to_reflectance(dn: np.ndarray, baseline: float) -> np.ndarray:
    """Sentinel-2 L2A digital number → surface reflectance (0..1).

    Processing baseline >= 04.00 (scenes from 2022-01-25 on) carries a
    BOA_ADD_OFFSET of -1000, so reflectance = (DN - 1000) / 10000. Earlier scenes
    have no offset. Applying it matters here because the observation window spans
    that baseline change, and an uncorrected offset would shift NDVI across the cutoff.
    """
    offset = -1000.0 if baseline >= 4.0 else 0.0
    refl = (dn.astype(np.float32) + offset) / 10000.0
    return np.clip(refl, 0.0, 1.0)


@dataclass
class DateObservation:
    scene: Scene
    valid: np.ndarray          # bool grid, True = usable pixel
    valid_fraction: float      # usable fraction *over the plot*
    cloud_fraction: float      # 1 - valid_fraction, over the plot
    ndvi_mean: float           # mean NDVI over usable plot pixels (nan if none)
    rgb: np.ndarray            # (H, W, 3) reflectance for true-colour display
    usable: bool               # valid_fraction >= MIN_VALID_FRACTION


def observe(scene: Scene, arrays: dict[str, np.ndarray], grid: Grid) -> DateObservation:
    scl = arrays[config.SCL_BAND]
    valid = scl_valid(scl)

    plot = grid.plot_mask
    n_plot = int(plot.sum())
    valid_in_plot = int((valid & plot).sum())
    valid_fraction = valid_in_plot / n_plot if n_plot else 0.0

    baseline = scene.processing_baseline
    red = to_reflectance(arrays["B04"], baseline)
    green = to_reflectance(arrays["B03"], baseline)
    blue = to_reflectance(arrays["B02"], baseline)
    nir = to_reflectance(arrays["B08"], baseline)

    denom = nir + red
    ndvi = np.where(denom > 0, (nir - red) / denom, np.nan)
    sel = plot & valid
    ndvi_mean = float(np.nanmean(ndvi[sel])) if sel.any() else float("nan")

    rgb = np.dstack([red, green, blue])  # (H, W, 3), reflectance units
    return DateObservation(
        scene=scene,
        valid=valid,
        valid_fraction=valid_fraction,
        cloud_fraction=1.0 - valid_fraction,
        ndvi_mean=ndvi_mean,
        rgb=rgb,
        usable=valid_fraction >= config.MIN_VALID_FRACTION,
    )
