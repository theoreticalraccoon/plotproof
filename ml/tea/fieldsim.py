"""Turn a studio photograph of a picked leaf into something that looks like a photograph taken in
a tea field."""

from __future__ import annotations

import io
import math
import random

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

# The studio background across all three corpora is bright and grey-ish.
_BG_MIN_VALUE = 118     # 0-255; paper is brighter than this
_BG_MAX_SATURATION = 74  # 0-255; paper is greyer than this
# Longest side the mask is computed at, before being scaled back up.
_MASK_WORK = 96
# A studio leaf photo mattes to roughly 0.12-0.55 of the frame.
_DONOR_MIN_COVER = 0.08
_DONOR_MAX_COVER = 0.72


def leaf_mask(img: Image.Image) -> np.ndarray:
    """Alpha for the leaf, as float32 in [0, 1]."""
    full_w, full_h = img.size
    # The border-connected flood fill below is the entire cost of this function and it is
    # quadratic in image side.
    work = img if max(full_w, full_h) <= _MASK_WORK else img.copy()
    if max(full_w, full_h) > _MASK_WORK:
        work.thumbnail((_MASK_WORK, _MASK_WORK), Image.BILINEAR)

    hsv = np.asarray(work.convert("HSV"), dtype=np.uint8)
    sat, val = hsv[..., 1], hsv[..., 2]
    bg = (val >= _BG_MIN_VALUE) & (sat <= _BG_MAX_SATURATION)

    # Keep only background connected to the border, by flood-filling inwards.
    h, w = bg.shape
    reach = np.zeros_like(bg)
    reach[0, :] = bg[0, :]
    reach[-1, :] = bg[-1, :]
    reach[:, 0] = bg[:, 0]
    reach[:, -1] = bg[:, -1]
    for _ in range(max(h, w) // 2):
        prev = reach
        grown = reach.copy()
        grown[1:, :] |= reach[:-1, :]
        grown[:-1, :] |= reach[1:, :]
        grown[:, 1:] |= reach[:, :-1]
        grown[:, :-1] |= reach[:, 1:]
        reach = grown & bg
        if reach.sum() == prev.sum():
            break

    alpha = (~reach).astype(np.float32)
    if alpha.mean() < 0.04 or alpha.mean() > 0.98:
        # Either nothing was found or everything was: the image does not look like the studio
        # setup this assumes.
        return np.ones((full_h, full_w), dtype=np.float32)

    # Feather, so the leaf does not sit on the canopy with a cut-out edge.
    soft = Image.fromarray((alpha * 255).astype(np.uint8))
    if soft.size != (full_w, full_h):
        soft = soft.resize((full_w, full_h), Image.BILINEAR)
    soft = soft.filter(ImageFilter.GaussianBlur(1.6))
    return np.asarray(soft, dtype=np.float32) / 255.0


def _paste_soft(base: Image.Image, patch: Image.Image, alpha: np.ndarray, xy: tuple[int, int]) -> None:
    a = Image.fromarray((np.clip(alpha, 0, 1) * 255).astype(np.uint8), mode="L")
    base.paste(patch, xy, a)


def _mottled(size: int, rgb: tuple[int, int, int], rng: random.Random) -> Image.Image:
    """A low-frequency colour field: shade under a canopy is never flat."""
    small = max(4, size // 24)
    gen = np.random.default_rng(rng.randrange(1 << 30))
    # Mostly luminance, a little chroma. Independent per-channel noise produced magenta and cyan
    # blotches that exist in no tea field.
    lum = gen.normal(0, 22, (small, small, 1))
    chroma = gen.normal(0, 5, (small, small, 3))
    base = np.clip(np.array(rgb, dtype=np.float32) + lum + chroma, 0, 255).astype(np.uint8)
    return Image.fromarray(base).resize((size, size), Image.BICUBIC).filter(
        ImageFilter.GaussianBlur(size / 26)
    )


def _place_leaf(canvas: Image.Image, donor: Image.Image, size: int, rng: random.Random,
                scale: tuple[float, float], blur: tuple[float, float],
                bright: tuple[float, float], alpha_scale: float = 1.0) -> None:
    """Paste ONE matted donor leaf somewhere on the canvas."""
    s = rng.uniform(*scale)
    side = max(12, int(size * s))
    leaf = donor.resize((side, side), Image.BILINEAR)
    m = leaf_mask(leaf)
    cover = float(m.mean())
    if cover < _DONOR_MIN_COVER or cover > _DONOR_MAX_COVER:
        return  # matte not trustworthy; skip rather than paste a paper rectangle
    ang = rng.uniform(0, 360)
    leaf = leaf.rotate(ang, expand=True, resample=Image.BILINEAR)
    m = np.asarray(
        Image.fromarray((m * 255).astype(np.uint8)).rotate(ang, expand=True, resample=Image.BILINEAR),
        dtype=np.float32,
    ) / 255.0
    leaf = ImageEnhance.Brightness(leaf).enhance(rng.uniform(*bright))
    b = rng.uniform(*blur)
    if b > 0:
        leaf = leaf.filter(ImageFilter.GaussianBlur(b))
        m = np.asarray(
            Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(b)),
            dtype=np.float32,
        ) / 255.0
    _paste_soft(canvas, leaf, m * alpha_scale,
                (rng.randint(-leaf.width // 2, size - leaf.width // 4),
                 rng.randint(-leaf.height // 2, size - leaf.height // 4)))


def _foliage_background(size: int, donors: list[Image.Image], rng: random.Random) -> Image.Image:
    """An out-of-focus tea canopy, built from matted donor leaves over shade."""
    # Base: the colour under a canopy, deep green through to leaf litter brown.
    if rng.random() < 0.75:
        base_rgb = (rng.randint(18, 70), rng.randint(45, 105), rng.randint(20, 60))
    else:
        base_rgb = (rng.randint(60, 110), rng.randint(50, 85), rng.randint(35, 65))
    bg = _mottled(size, base_rgb, rng)

    for d in donors:
        for _ in range(rng.randint(3, 7)):
            _place_leaf(bg, d, size, rng, scale=(0.3, 1.1), blur=(2.0, 6.0), bright=(0.3, 0.8))

    return bg.filter(ImageFilter.GaussianBlur(rng.uniform(0.6, 2.2)))


def _sunlight(img: Image.Image, rng: random.Random) -> Image.Image:
    """Directional shading plus sunflecks through the canopy."""
    w, h = img.size
    arr = np.asarray(img, dtype=np.float32)

    # A linear gradient at an arbitrary angle: one side of the leaf in shade.
    ang = rng.uniform(0, 2 * math.pi)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    g = (xx / w) * math.cos(ang) + (yy / h) * math.sin(ang)
    g = (g - g.min()) / max(float(g.max() - g.min()), 1e-6)
    depth = rng.uniform(0.15, 0.6)
    arr *= (1.0 - depth / 2 + depth * g)[..., None]

    # Sunflecks: small blown-out ellipses, the thing that makes canopy photos hard and that a
    # studio light never produces.
    if rng.random() < 0.65:
        fleck = Image.new("L", (w, h), 0)
        d = ImageDraw.Draw(fleck)
        for _ in range(rng.randint(1, 4)):
            cx, cy = rng.randint(0, w), rng.randint(0, h)
            rx, ry = rng.randint(w // 12, w // 3), rng.randint(h // 12, h // 3)
            d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=rng.randint(90, 255))
        fmask = np.asarray(fleck.filter(ImageFilter.GaussianBlur(w / 14)), dtype=np.float32) / 255.0
        arr += fmask[..., None] * rng.uniform(40, 120)

    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


def _camera(img: Image.Image, rng: random.Random) -> Image.Image:
    """The phone between the leaf and the file."""
    w, h = img.size

    # Auto white balance guessing wrong under a green canopy.
    if rng.random() < 0.8:
        arr = np.asarray(img, dtype=np.float32)
        arr *= np.array([rng.uniform(0.86, 1.16), rng.uniform(0.9, 1.1), rng.uniform(0.84, 1.2)], dtype=np.float32)
        img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))

    # Gamma: under- and over-exposure.
    if rng.random() < 0.7:
        gamma = rng.uniform(0.62, 1.6)
        lut = [min(255, int(255 * ((i / 255) ** gamma))) for i in range(256)]
        img = img.point(lut * 3)

    if rng.random() < 0.35:
        img = img.filter(ImageFilter.GaussianBlur(rng.uniform(0.5, 2.0)))  # missed focus / motion

    # A phone photo downscaled by the app, not a 256px publisher crop.
    if rng.random() < 0.6:
        s = rng.uniform(0.35, 0.8)
        img = img.resize((max(32, int(w * s)), max(32, int(h * s))), Image.BILINEAR).resize((w, h), Image.BICUBIC)

    if rng.random() < 0.5:
        arr = np.asarray(img, dtype=np.float32) + np.random.normal(0, rng.uniform(2, 11), (h, w, 3))
        img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))

    if rng.random() < 0.6:
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=rng.randint(28, 80))
        buf.seek(0)
        img = Image.open(buf).convert("RGB")

    return img


def to_field(img: Image.Image, donors: list[Image.Image], rng: random.Random) -> Image.Image:
    """One studio photograph, rendered as if taken on the bush."""
    size = max(img.size)
    img = img.convert("RGB")
    alpha = leaf_mask(img)

    bg = _foliage_background(size, donors, rng)
    canvas = bg.copy()

    # Some distractor leaves sit behind the subject, sharper than the canopy but not in focus, so
    # the subject is not the only crisp leaf in the frame.
    for d in donors[: rng.randint(0, 2)]:
        _place_leaf(canvas, d, size, rng, scale=(0.4, 0.9), blur=(0.8, 2.5), bright=(0.5, 0.95))

    # The subject: smaller than the frame, because a farmer steps back.
    s = rng.uniform(0.45, 0.95)
    sw, sh = max(16, int(img.width * s)), max(16, int(img.height * s))
    subject = img.resize((sw, sh), Image.BICUBIC)
    sub_alpha = np.asarray(
        Image.fromarray((alpha * 255).astype(np.uint8)).resize((sw, sh), Image.BILINEAR),
        dtype=np.float32,
    ) / 255.0
    ox = rng.randint(0, max(0, size - sw))
    oy = rng.randint(0, max(0, size - sh))
    _paste_soft(canvas, subject, sub_alpha, (ox, oy))

    # And one leaf in front, partly occluding, a farmer's hand pushing the canopy aside rarely
    # produces a clean view.
    if donors and rng.random() < 0.45:
        _place_leaf(canvas, donors[rng.randrange(len(donors))], size, rng,
                    scale=(0.5, 1.1), blur=(1.0, 3.5), bright=(0.6, 1.05),
                    alpha_scale=rng.uniform(0.6, 1.0))

    return _camera(_sunlight(canvas, rng), rng)


# The description written into the model card, so the artifact carries the recipe rather than
# pointing at a file that may have moved on.
SPEC = [
    "leaf matted from the studio background (bright + unsaturated + border-connected), feathered",
    "composited onto an out-of-focus canopy: 3-7 MATTED donor leaves per donor, blurred and darkened, over a mottled shade/litter base",
    "0-2 distractor leaves behind the subject, 45% chance of one partly occluding in front",
    "subject scaled to 45-95% of frame and randomly placed, so the leaf does not fill the image",
    "directional shading gradient (depth 0.15-0.6) plus 1-4 blown-out sunflecks (65%)",
    "per-channel white balance 0.84-1.20 (80%), gamma 0.62-1.60 (70%)",
    "defocus/motion blur 0.5-2.0px (35%), downscale 0.35-0.8x then upscale (60%)",
    "Gaussian sensor noise sigma 2-11 (50%), JPEG quality 28-80 (60%)",
]


class FieldSimulator:
    """`to_field` with the repeated work done once."""

    def __init__(self, donor_paths, size: int = 256, backgrounds: int = 192,
                 donors: int = 160, seed: int = 0):
        rng = random.Random(seed)
        self.size = size
        self.rng_seed = seed

        self.donors: list[tuple[Image.Image, np.ndarray]] = []
        for path in rng.sample(list(donor_paths), min(donors, len(donor_paths))):
            try:
                with Image.open(path) as im:
                    leaf = im.convert("RGB")
                    leaf.thumbnail((size, size), Image.BILINEAR)
                    leaf = leaf.copy()
            except Exception:
                continue
            m = leaf_mask(leaf)
            cover = float(m.mean())
            if _DONOR_MIN_COVER <= cover <= _DONOR_MAX_COVER:
                self.donors.append((leaf, m))
        if not self.donors:
            raise RuntimeError("no donor leaf could be matted; check the dataset path")

        self.backgrounds = [
            self._build_background(random.Random(rng.randrange(1 << 30)))
            for _ in range(backgrounds)
        ]

    # -- construction -------------------------------------------------------

    def _blit(self, canvas: Image.Image, rng: random.Random, scale, blur, bright,
              alpha_scale: float = 1.0) -> None:
        leaf, m = self.donors[rng.randrange(len(self.donors))]
        side = max(12, int(self.size * rng.uniform(*scale)))
        leaf = leaf.resize((side, side), Image.BILINEAR)
        mm = np.asarray(
            Image.fromarray((m * 255).astype(np.uint8)).resize((side, side), Image.BILINEAR),
            dtype=np.float32,
        ) / 255.0
        ang = rng.uniform(0, 360)
        leaf = leaf.rotate(ang, expand=True, resample=Image.BILINEAR)
        mm = np.asarray(
            Image.fromarray((mm * 255).astype(np.uint8)).rotate(ang, expand=True, resample=Image.BILINEAR),
            dtype=np.float32,
        ) / 255.0
        leaf = ImageEnhance.Brightness(leaf).enhance(rng.uniform(*bright))
        b = rng.uniform(*blur)
        if b > 0:
            leaf = leaf.filter(ImageFilter.GaussianBlur(b))
            mm = np.asarray(
                Image.fromarray((mm * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(b)),
                dtype=np.float32,
            ) / 255.0
        _paste_soft(canvas, leaf, mm * alpha_scale,
                    (rng.randint(-leaf.width // 2, self.size - leaf.width // 4),
                     rng.randint(-leaf.height // 2, self.size - leaf.height // 4)))

    def _build_background(self, rng: random.Random) -> Image.Image:
        if rng.random() < 0.75:
            base_rgb = (rng.randint(18, 70), rng.randint(45, 105), rng.randint(20, 60))
        else:
            base_rgb = (rng.randint(60, 110), rng.randint(50, 85), rng.randint(35, 65))
        bg = _mottled(self.size, base_rgb, rng)
        for _ in range(rng.randint(5, 12)):
            self._blit(bg, rng, scale=(0.3, 1.1), blur=(2.0, 6.0), bright=(0.3, 0.8))
        return bg.filter(ImageFilter.GaussianBlur(rng.uniform(0.6, 2.2)))

    # -- use ----------------------------------------------------------------

    def apply(self, img: Image.Image, rng: random.Random) -> Image.Image:
        """One studio photograph, rendered as if taken on the bush."""
        img = img.convert("RGB")
        size = self.size
        canvas = self.backgrounds[rng.randrange(len(self.backgrounds))].copy()

        for _ in range(rng.randint(0, 2)):
            self._blit(canvas, rng, scale=(0.4, 0.9), blur=(0.8, 2.5), bright=(0.5, 0.95))

        alpha = leaf_mask(img)
        s = rng.uniform(0.45, 0.95)
        sw, sh = max(16, int(size * s)), max(16, int(size * s * img.height / img.width))
        subject = img.resize((sw, sh), Image.BICUBIC)
        sub_alpha = np.asarray(
            Image.fromarray((alpha * 255).astype(np.uint8)).resize((sw, sh), Image.BILINEAR),
            dtype=np.float32,
        ) / 255.0
        _paste_soft(canvas, subject, sub_alpha,
                    (rng.randint(min(0, size - sw), max(0, size - sw)),
                     rng.randint(min(0, size - sh), max(0, size - sh))))

        # One leaf in front, partly occluding: a hand pushing the canopy aside rarely produces a
        # clean view of the leaf you wanted.
        if rng.random() < 0.45:
            self._blit(canvas, rng, scale=(0.5, 1.1), blur=(1.0, 3.5), bright=(0.6, 1.05),
                       alpha_scale=rng.uniform(0.6, 1.0))

        return _camera(_sunlight(canvas, rng), rng)
