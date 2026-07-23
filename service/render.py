"""Renders the thing you actually look at: a time-series contact sheet of masked
true-colour chips (one per date, plot outlined, acquisition date + cloud/valid %
burned in, consistent scale) with an NDVI-over-plot trace beneath it. Cloud/shadow
pixels that SCL removed are tinted magenta so the masking is visible to the eye —
the whole point of this step is to confirm it by looking.
"""
from __future__ import annotations

from datetime import datetime

import matplotlib

matplotlib.use("Agg")  # headless; we write a PNG, never open a window
import matplotlib.pyplot as plt
import numpy as np
import rasterio.transform
from matplotlib.gridspec import GridSpec

from imagery import DateObservation, Grid

# Fixed reflectance scale so every chip uses the SAME stretch — before/after must
# be visually comparable, not each auto-scaled to itself.
_REFL_SCALE = 0.30
_MAGENTA = np.array([1.0, 0.0, 1.0], dtype=np.float32)
_CUTOFF = datetime(2020, 12, 31)  # EUDR assessment cutoff, drawn on the NDVI trace


def _display_rgb(obs: DateObservation) -> np.ndarray:
    disp = np.clip(obs.rgb / _REFL_SCALE, 0.0, 1.0).astype(np.float32)
    inv = ~obs.valid
    disp[inv] = 0.5 * disp[inv] + 0.5 * _MAGENTA  # tint masked pixels
    return disp


def _plot_outline_pixels(grid: Grid):
    xs, ys = grid.plot_utm.exterior.xy
    rows, cols = rasterio.transform.rowcol(grid.transform, list(xs), list(ys))
    return np.asarray(cols), np.asarray(rows)


def contact_sheet(
    sheet: list[DateObservation],
    series: list[DateObservation],
    grid: Grid,
    plot_id: str,
    out_path,
) -> None:
    ncols = min(4, max(1, len(sheet)))
    nrows = int(np.ceil(len(sheet) / ncols)) if sheet else 1

    fig = plt.figure(figsize=(3.2 * ncols, 3.0 * nrows + 3.0))
    gs = GridSpec(nrows + 1, ncols, figure=fig, height_ratios=[*([3] * nrows), 3])
    ox, oy = _plot_outline_pixels(grid)

    for i, obs in enumerate(sheet):
        ax = fig.add_subplot(gs[i // ncols, i % ncols])
        ax.imshow(_display_rgb(obs), interpolation="nearest")
        ax.plot(ox, oy, color="yellow", linewidth=1.4)
        ax.set_xticks([])
        ax.set_yticks([])
        usable = obs.usable
        ax.set_title(
            f"{obs.scene.date}\ncloud {obs.cloud_fraction * 100:.0f}%  "
            f"valid {obs.valid_fraction * 100:.0f}%",
            fontsize=9,
            color="black" if usable else "firebrick",
        )

    # --- NDVI trace over the whole usable series ---
    ax = fig.add_subplot(gs[nrows, :])
    if series:
        xs = [datetime.fromisoformat(o.scene.date) for o in series]
        ys = [o.ndvi_mean for o in series]
        ax.plot(xs, ys, "-o", color="green", markersize=4)
        ax.axvline(_CUTOFF, color="red", linestyle="--", linewidth=1)
        ax.text(_CUTOFF, ax.get_ylim()[1], " EUDR cutoff 2020-12-31",
                color="red", fontsize=8, va="top")
        ax.set_ylabel("mean NDVI over plot")
        ax.set_ylim(-0.1, 1.0)
        ax.grid(True, alpha=0.3)
    ax.set_title("Forest-greenness proxy (NDVI) over the plot — usable dates only", fontsize=10)

    fig.suptitle(
        f"Sentinel-2 L2A time series · plot {plot_id} · magenta = SCL-masked cloud/shadow",
        fontsize=12,
    )
    fig.tight_layout(rect=(0, 0, 1, 0.98))
    fig.savefig(out_path, dpi=130)
    plt.close(fig)


def _edges_from_rgb(rgb: np.ndarray) -> np.ndarray:
    """Bright optical edges (roads, field/forest boundaries) as a boolean mask —
    the features whose position must match on the radar image if aligned."""
    lum = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
    gy, gx = np.gradient(lum)
    mag = np.hypot(gx, gy)
    return mag >= np.nanpercentile(mag, 85)


def alignment_figure(pairs: list[dict], grid: Grid, out_path) -> None:
    """One row per optical/radar date pair: optical true colour, radar VV (dB),
    and the radar image with optical edges drawn on top in red. If the pipeline is
    aligned the red edges sit exactly on the matching radar features; a shift of
    even a pixel or two shows up here — which is the point, since it is invisible
    in the numbers until much later.
    """
    n = len(pairs)
    fig = plt.figure(figsize=(11, 3.5 * n))
    gs = GridSpec(n, 3, figure=fig)
    ox, oy = _plot_outline_pixels(grid)

    for r, p in enumerate(pairs):
        # optical true colour
        ax = fig.add_subplot(gs[r, 0])
        ax.imshow(np.clip(p["opt_rgb"] / _REFL_SCALE, 0, 1), interpolation="nearest")
        ax.plot(ox, oy, color="yellow", linewidth=1.2)
        ax.set_xticks([]); ax.set_yticks([])
        ax.set_title(f"optical {p['opt_date']}", fontsize=9)

        # radar VV in dB
        ax = fig.add_subplot(gs[r, 1])
        ax.imshow(p["vv_db"], cmap="gray", vmin=-22, vmax=-2, interpolation="nearest")
        ax.plot(ox, oy, color="yellow", linewidth=1.2)
        ax.set_xticks([]); ax.set_yticks([])
        gap = p.get("day_gap")
        gap_txt = "" if gap is None else f"  Δ{gap}d"
        ax.set_title(f"S1 RTC VV dB {p['rad_date']} ({p['rad_orbit']}){gap_txt}", fontsize=9)

        # overlay: optical edges (red) on radar
        ax = fig.add_subplot(gs[r, 2])
        ax.imshow(p["vv_db"], cmap="gray", vmin=-22, vmax=-2, interpolation="nearest")
        edges = _edges_from_rgb(p["opt_rgb"])
        overlay = np.zeros((*edges.shape, 4), dtype=np.float32)
        overlay[edges] = (1.0, 0.0, 0.0, 0.9)
        ax.imshow(overlay, interpolation="nearest")
        ax.plot(ox, oy, color="yellow", linewidth=1.2)
        ax.set_xticks([]); ax.set_yticks([])
        ax.set_title("overlay: optical edges (red) on radar", fontsize=9)

    fig.suptitle(
        "Sentinel-1 RTC vs Sentinel-2 alignment — red optical edges must sit on the "
        "same pixels in the radar",
        fontsize=12,
    )
    fig.tight_layout(rect=(0, 0, 1, 0.97))
    fig.savefig(out_path, dpi=140)
    plt.close(fig)


def before_after_tile(rgb, grid, acquisition_date, cloud_fraction, sensor, role, out_path) -> None:
    """One evidence-pack tile: full-bleed true colour, the plot outlined, and the
    acquisition date/role/cloud/sensor burned into the corner. Uses the SAME fixed
    reflectance stretch (_REFL_SCALE) as its pair so before and after are directly
    comparable — auto-scaling each to itself would make an unchanged plot look changed.
    """
    fig = plt.figure(figsize=(4, 4))
    ax = fig.add_axes((0, 0, 1, 1))  # full bleed, no margins
    ax.imshow(np.clip(rgb / _REFL_SCALE, 0.0, 1.0), interpolation="nearest")
    ox, oy = _plot_outline_pixels(grid)
    ax.plot(ox, oy, color="yellow", linewidth=2.0)
    ax.set_axis_off()
    ax.text(
        0.02, 0.98, f"{role.upper()}   {acquisition_date}   {sensor}   cloud {cloud_fraction*100:.0f}%",
        transform=ax.transAxes, va="top", ha="left", fontsize=11, color="white",
        bbox=dict(facecolor="black", alpha=0.6, pad=3, edgecolor="none"),
    )
    fig.savefig(out_path, dpi=150)
    plt.close(fig)
